from __future__ import annotations

import json
from collections.abc import Mapping
from datetime import datetime
from uuid import UUID, uuid4

from agent_factory_core.knowledge.cloud import CloudImportCommand
from agent_factory_core.knowledge.delivery import UploadIntent
from agent_factory_core.knowledge.domain import DocumentType, KnowledgeActor
from agent_factory_core.knowledge.errors import KnowledgeConflictError
from agent_factory_core.knowledge.specification_pair import PairReview, SpecificationPair
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from .audit import append_knowledge_audit


def _command_payload(command: CloudImportCommand) -> dict[str, object]:
    pair: dict[str, object] | None = None
    if command.pair:
        pair = {
            "specification_id": command.pair.specification_id,
            "ai_root": command.pair.ai_root,
            "human_root": command.pair.human_root,
            "git_repository": command.pair.git_repository,
            "git_commit": command.pair.git_commit,
            "review": {
                "reviewer": command.pair.review.reviewer,
                "evidence": command.pair.review.evidence,
                "authority_reference": command.pair.review.authority_reference,
                "ai_sha256": command.pair.review.ai_sha256,
                "human_sha256": command.pair.review.human_sha256,
                "verdict": command.pair.review.verdict,
            },
        }
    return {
        "idempotency_key": command.idempotency_key,
        "document_id": str(command.document_id) if command.document_id else None,
        "expected_revision": command.expected_revision,
        "title": command.title,
        "slug": command.slug,
        "document_type": command.document_type.value,
        "filename": command.filename,
        "media_type": command.media_type,
        "source_sha256": command.source_sha256,
        "source_identity": command.source_identity,
        "collection_context": command.collection_context,
        "pair": pair,
    }


def _command(value: Mapping[str, object]) -> CloudImportCommand:
    pair_value = value.get("pair")
    pair = None
    if isinstance(pair_value, Mapping):
        review = pair_value["review"]
        if not isinstance(review, Mapping):
            raise TypeError("stored pair review is invalid")
        pair = SpecificationPair(
            str(pair_value["specification_id"]),
            str(pair_value["ai_root"]),
            str(pair_value["human_root"]),
            str(pair_value["git_repository"]),
            str(pair_value["git_commit"]),
            PairReview(
                str(review["reviewer"]),
                str(review["evidence"]),
                str(review["authority_reference"]),
                str(review["ai_sha256"]),
                str(review["human_sha256"]),
                str(review["verdict"]),
            ),
        )
    document_id = value.get("document_id")
    return CloudImportCommand(
        str(value["idempotency_key"]),
        UUID(str(document_id)) if document_id else None,
        int(str(value["expected_revision"])),
        str(value["title"]),
        str(value["slug"]),
        DocumentType(str(value["document_type"])),
        str(value["filename"]),
        str(value["media_type"]),
        str(value["source_sha256"]),
        str(value["source_identity"]),
        str(value["collection_context"]),
        pair,
    )


class PostgresUploadIntentRepository:
    def __init__(
        self, session: AsyncSession, *, request_id: str | None = None, source: str = "http"
    ) -> None:
        self.session, self.request_id, self.source = session, request_id, source

    async def _context(self, actor: KnowledgeActor) -> None:
        for key, value in (
            ("app.current_user_id", actor.user_id),
            ("app.current_organization_id", actor.organization_id),
            ("app.current_workspace_id", actor.workspace_id),
        ):
            await self.session.execute(
                text("SELECT set_config(:key, :value, true)"), {"key": key, "value": str(value)}
            )
        await self.session.execute(
            text("SELECT set_config('app.is_platform_admin', 'false', true)")
        )

    @staticmethod
    def _intent(row: Mapping[str, object]) -> UploadIntent:
        metadata = row["metadata_payload"]
        if not isinstance(metadata, Mapping):
            raise TypeError("stored upload metadata is invalid")
        raw_command = metadata.get("command")
        if not isinstance(raw_command, Mapping):
            raise TypeError("stored upload command is invalid")
        return UploadIntent(
            UUID(str(row["id"])),
            UUID(str(row["workspace_id"])),
            UUID(str(row["user_id"])),
            _command(raw_command),
            str(row["request_sha256"]),
            str(row["capability_sha256"]),
            row["expires_at"]
            if isinstance(row["expires_at"], datetime)
            else datetime.fromisoformat(str(row["expires_at"])),
            int(str(metadata["size_bytes"])),
            bool(row["uploaded"]),
            bool(row["finalized"]),
        )

    async def prepare(
        self,
        actor: KnowledgeActor,
        *,
        command: CloudImportCommand,
        request_sha256: str,
        capability_sha256: str,
        expires_at: datetime,
        size_bytes: int,
    ) -> UploadIntent:
        await self._context(actor)
        lock = int.from_bytes(bytes.fromhex(request_sha256)[:8], "big", signed=True)
        await self.session.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock})
        row = (
            (
                await self.session.execute(
                    text(
                        "SELECT id, workspace_id, user_id, request_sha256, capability_sha256, "
                        "metadata_payload, expires_at, uploaded, finalized FROM document_uploads "
                        "WHERE workspace_id=:workspace_id AND idempotency_key=:key FOR UPDATE"
                    ),
                    {"workspace_id": actor.workspace_id, "key": command.idempotency_key},
                )
            )
            .mappings()
            .one_or_none()
        )
        payload = json.dumps(
            {"command": _command_payload(command), "size_bytes": size_bytes}, separators=(",", ":")
        )
        if row:
            if row["request_sha256"] != request_sha256 or row["user_id"] != actor.user_id:
                raise KnowledgeConflictError(
                    "upload_payload_conflict", "Upload intent has different content or owner"
                )
            upload_id = UUID(str(row["id"]))
            row = (
                (
                    await self.session.execute(
                        text(
                            "UPDATE document_uploads SET capability_sha256=:capability, "
                            "expires_at=:expires, updated_at=now() WHERE id=:id RETURNING id, "
                            "workspace_id, user_id, request_sha256, capability_sha256, "
                            "metadata_payload, expires_at, uploaded, finalized"
                        ),
                        {"capability": capability_sha256, "expires": expires_at, "id": upload_id},
                    )
                )
                .mappings()
                .one()
            )
        else:
            upload_id = uuid4()
            row = (
                (
                    await self.session.execute(
                        text(
                            "INSERT INTO document_uploads (id, workspace_id, user_id, idempotency_key, "
                            "request_sha256, capability_sha256, metadata_payload, expires_at, uploaded, "
                            "finalized, created_at, updated_at) VALUES (:id, :workspace_id, :user_id, "
                            ":key, :request_sha256, :capability, CAST(:payload AS jsonb), :expires, "
                            "false, false, now(), now()) RETURNING id, workspace_id, user_id, "
                            "request_sha256, capability_sha256, metadata_payload, expires_at, uploaded, finalized"
                        ),
                        {
                            "id": upload_id,
                            "workspace_id": actor.workspace_id,
                            "user_id": actor.user_id,
                            "key": command.idempotency_key,
                            "request_sha256": request_sha256,
                            "capability": capability_sha256,
                            "payload": payload,
                            "expires": expires_at,
                        },
                    )
                )
                .mappings()
                .one()
            )
        await append_knowledge_audit(
            self.session,
            actor,
            action="document.upload.prepare",
            target_type="document_upload",
            target_id=upload_id,
            request_id=self.request_id,
            source=self.source,
        )
        await self.session.commit()
        return self._intent(row)

    async def get_for_update(self, actor: KnowledgeActor, upload_id: UUID) -> UploadIntent | None:
        await self._context(actor)
        row = (
            (
                await self.session.execute(
                    text(
                        "SELECT id, workspace_id, user_id, request_sha256, capability_sha256, "
                        "metadata_payload, expires_at, uploaded, finalized FROM document_uploads "
                        "WHERE workspace_id=:workspace_id AND id=:id AND user_id=:user_id FOR UPDATE"
                    ),
                    {"workspace_id": actor.workspace_id, "id": upload_id, "user_id": actor.user_id},
                )
            )
            .mappings()
            .one_or_none()
        )
        return self._intent(row) if row else None

    async def _mark(self, actor: KnowledgeActor, upload_id: UUID, column: str) -> None:
        if column not in {"uploaded", "finalized"}:
            raise ValueError("invalid upload transition")
        await self._context(actor)
        changed = await self.session.scalar(
            text(
                f"UPDATE document_uploads SET {column}=true, updated_at=now() "
                f"WHERE workspace_id=:workspace_id AND id=:id AND user_id=:user_id "
                f"AND {column}=false RETURNING 1"
            ),
            {"workspace_id": actor.workspace_id, "id": upload_id, "user_id": actor.user_id},
        )
        if changed:
            await append_knowledge_audit(
                self.session,
                actor,
                action=f"document.upload.{column}",
                target_type="document_upload",
                target_id=upload_id,
                request_id=self.request_id,
                source=self.source,
            )
        await self.session.commit()

    async def mark_uploaded(self, actor: KnowledgeActor, upload_id: UUID) -> None:
        await self._mark(actor, upload_id, "uploaded")

    async def mark_finalized(self, actor: KnowledgeActor, upload_id: UUID) -> None:
        await self._mark(actor, upload_id, "finalized")
