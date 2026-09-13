from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from uuid import UUID, uuid4

from agent_factory_core.knowledge.cloud import (
    CloudImportCommand,
    CloudImportReceipt,
    CloudRevisionSource,
    LexicalHit,
)
from agent_factory_core.knowledge.domain import KnowledgeActor
from agent_factory_core.knowledge.errors import (
    KnowledgeCommitUnknownError,
    KnowledgeConflictError,
    KnowledgeNotFoundError,
)
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from .audit import append_knowledge_audit


class PostgresCloudKnowledgeRepository:
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

    async def get_revision_source(
        self, actor: KnowledgeActor, *, document_id: UUID, revision_number: int
    ) -> CloudRevisionSource | None:
        await self._context(actor)
        row = (
            (
                await self.session.execute(
                    text(
                        "SELECT r.id, r.document_id, r.revision_number, r.storage_key, "
                        "r.filename, r.media_type, r.size_bytes, r.sha256 "
                        "FROM document_revisions r JOIN documents d "
                        "ON d.id=r.document_id AND d.workspace_id=r.workspace_id "
                        "WHERE r.workspace_id=:workspace_id AND r.document_id=:document_id "
                        "AND r.revision_number=:revision_number AND d.deleted_at IS NULL"
                    ),
                    {
                        "workspace_id": actor.workspace_id,
                        "document_id": document_id,
                        "revision_number": revision_number,
                    },
                )
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            return None
        return CloudRevisionSource(
            UUID(str(row["document_id"])),
            UUID(str(row["id"])),
            int(str(row["revision_number"])),
            str(row["storage_key"]),
            str(row["filename"]),
            str(row["media_type"]),
            int(str(row["size_bytes"])),
            str(row["sha256"]),
        )

    async def publish_import(
        self,
        actor: KnowledgeActor,
        *,
        command: CloudImportCommand,
        command_sha256: str,
        document_id: UUID,
        revision_id: UUID,
        storage_key: str,
        size_bytes: int,
        revision_metadata: Mapping[str, object],
        chunks: Sequence[tuple[str, str]],
    ) -> CloudImportReceipt:
        await self._context(actor)
        lock = int.from_bytes(bytes.fromhex(command_sha256)[:8], byteorder="big", signed=True)
        await self.session.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock})
        previous = (
            (
                await self.session.execute(
                    text(
                        "SELECT request_sha256, document_id, revision_id, revision_number "
                        "FROM document_imports WHERE workspace_id=:workspace_id "
                        "AND idempotency_key=:idempotency_key"
                    ),
                    {
                        "workspace_id": actor.workspace_id,
                        "idempotency_key": command.idempotency_key,
                    },
                )
            )
            .mappings()
            .one_or_none()
        )
        if previous:
            if previous["request_sha256"] != command_sha256:
                raise KnowledgeConflictError(
                    "import_payload_conflict", "Idempotency key has different content"
                )
            active = await self.session.scalar(
                text(
                    "SELECT 1 FROM documents WHERE workspace_id=:workspace_id "
                    "AND id=:document_id AND deleted_at IS NULL"
                ),
                {
                    "workspace_id": actor.workspace_id,
                    "document_id": previous["document_id"],
                },
            )
            if not active:
                raise KnowledgeConflictError(
                    "import_target_deleted", "Previously imported document is unavailable"
                )
            return CloudImportReceipt(
                UUID(str(previous["document_id"])),
                UUID(str(previous["revision_id"])),
                int(str(previous["revision_number"])),
                command_sha256,
            )

        if command.document_id:
            current = (
                (
                    await self.session.execute(
                        text(
                            "SELECT document_type, slug, current_revision_number FROM documents "
                            "WHERE workspace_id=:workspace_id AND id=:document_id "
                            "AND deleted_at IS NULL FOR UPDATE"
                        ),
                        {"workspace_id": actor.workspace_id, "document_id": command.document_id},
                    )
                )
                .mappings()
                .one_or_none()
            )
            if current is None:
                raise KnowledgeNotFoundError("document_not_found", "Document not found")
            if (
                current["document_type"] != command.document_type.value
                or current["slug"] != command.slug
            ):
                raise KnowledgeConflictError(
                    "document_identity_conflict", "Document identity must be preserved"
                )
            if int(str(current["current_revision_number"])) != command.expected_revision:
                raise KnowledgeConflictError(
                    "document_revision_conflict", "Document changed concurrently"
                )
        else:
            if command.expected_revision != 0:
                raise KnowledgeConflictError(
                    "document_revision_conflict", "New documents require revision zero"
                )
            await self.session.execute(
                text(
                    "INSERT INTO documents (id, workspace_id, document_type, title, slug, status, "
                    "document_metadata, current_revision_number, revision, created_at, updated_at) "
                    "VALUES (:id, :workspace_id, :document_type, :title, :slug, 'active', "
                    "CAST('{}' AS jsonb), 0, 1, now(), now())"
                ),
                {
                    "id": document_id,
                    "workspace_id": actor.workspace_id,
                    "document_type": command.document_type.value,
                    "title": command.title,
                    "slug": command.slug,
                },
            )
        revision_number = command.expected_revision + 1
        await self.session.execute(
            text(
                "INSERT INTO document_revisions (id, workspace_id, document_id, revision_number, "
                "storage_key, filename, media_type, size_bytes, sha256, created_by_user_id, "
                "revision_metadata, created_at, updated_at) VALUES (:id, :workspace_id, "
                ":document_id, :revision_number, :storage_key, :filename, :media_type, "
                ":size_bytes, :sha256, :user_id, CAST(:metadata AS jsonb), now(), now())"
            ),
            {
                "id": revision_id,
                "workspace_id": actor.workspace_id,
                "document_id": document_id,
                "revision_number": revision_number,
                "storage_key": storage_key,
                "filename": command.filename,
                "media_type": command.media_type,
                "size_bytes": size_bytes,
                "sha256": command.source_sha256,
                "user_id": actor.user_id,
                "metadata": json.dumps(dict(revision_metadata), separators=(",", ":")),
            },
        )
        document_metadata = (
            {"cloud_pair_revision": revision_number}
            if command.document_type.value == "specification"
            else {}
        )
        await self.session.execute(
            text(
                "UPDATE documents SET title=:title, current_revision_number=:revision_number, "
                "revision=revision+1, updated_at=now(), "
                "document_metadata=CAST(CAST(document_metadata AS jsonb) "
                "|| CAST(:metadata AS jsonb) AS json) "
                "WHERE workspace_id=:workspace_id AND id=:document_id"
            ),
            {
                "title": command.title,
                "revision_number": revision_number,
                "metadata": json.dumps(document_metadata, separators=(",", ":")),
                "workspace_id": actor.workspace_id,
                "document_id": document_id,
            },
        )
        for index, (path, content) in enumerate(chunks):
            await self.session.execute(
                text(
                    "INSERT INTO document_texts (id, workspace_id, document_id, revision_id, "
                    "chunk_index, source_path, content) VALUES (:id, :workspace_id, "
                    ":document_id, :revision_id, :chunk_index, :source_path, :content)"
                ),
                {
                    "id": uuid4(),
                    "workspace_id": actor.workspace_id,
                    "document_id": document_id,
                    "revision_id": revision_id,
                    "chunk_index": index,
                    "source_path": path,
                    "content": content,
                },
            )
        await self.session.execute(
            text(
                "INSERT INTO document_imports (id, workspace_id, idempotency_key, request_sha256, "
                "document_id, revision_id, revision_number, created_at, updated_at) VALUES "
                "(:id, :workspace_id, :key, :sha256, :document_id, :revision_id, "
                ":revision_number, now(), now())"
            ),
            {
                "id": uuid4(),
                "workspace_id": actor.workspace_id,
                "key": command.idempotency_key,
                "sha256": command_sha256,
                "document_id": document_id,
                "revision_id": revision_id,
                "revision_number": revision_number,
            },
        )
        await append_knowledge_audit(
            self.session,
            actor,
            action="document.import",
            target_type="document",
            target_id=document_id,
            request_id=self.request_id,
            source=self.source,
            metadata={"revision_number": revision_number},
        )
        try:
            await self.session.commit()
        except Exception as error:
            raise KnowledgeCommitUnknownError(
                "import_commit_unknown", "Import acknowledgement was lost; retain staged bytes"
            ) from error
        return CloudImportReceipt(document_id, revision_id, revision_number, command_sha256)

    async def replace_lexical_chunks(
        self,
        actor: KnowledgeActor,
        *,
        document_id: UUID,
        revision_number: int,
        chunks: Sequence[tuple[str, str]],
    ) -> int:
        await self._context(actor)
        revision_id = await self.session.scalar(
            text(
                "SELECT id FROM document_revisions WHERE workspace_id=:workspace_id "
                "AND document_id=:document_id AND revision_number=:revision_number"
            ),
            {
                "workspace_id": actor.workspace_id,
                "document_id": document_id,
                "revision_number": revision_number,
            },
        )
        if revision_id is None:
            raise KnowledgeNotFoundError("document_revision_not_found", "Revision not found")
        await self.session.execute(
            text("DELETE FROM document_texts WHERE workspace_id=:workspace_id AND revision_id=:id"),
            {"workspace_id": actor.workspace_id, "id": revision_id},
        )
        for index, (path, content) in enumerate(chunks):
            await self.session.execute(
                text(
                    "INSERT INTO document_texts (id, workspace_id, document_id, revision_id, "
                    "chunk_index, source_path, content) VALUES (:id, :workspace_id, "
                    ":document_id, :revision_id, :index, :path, :content)"
                ),
                {
                    "id": uuid4(),
                    "workspace_id": actor.workspace_id,
                    "document_id": document_id,
                    "revision_id": revision_id,
                    "index": index,
                    "path": path,
                    "content": content,
                },
            )
        await append_knowledge_audit(
            self.session,
            actor,
            action="document.lexical_index.replace",
            target_type="document",
            target_id=document_id,
            request_id=self.request_id,
            source=self.source,
            metadata={"revision_number": revision_number, "chunks": len(chunks)},
        )
        await self.session.commit()
        return len(chunks)

    async def lexical_search(
        self, actor: KnowledgeActor, *, terms: Sequence[str], limit: int
    ) -> Sequence[LexicalHit]:
        await self._context(actor)
        predicates = "".join(
            f" AND position(lower(:term_{index}) in lower(t.content)) > 0"
            for index in range(len(terms))
        )
        parameters: dict[str, object] = {
            "workspace_id": actor.workspace_id,
            "limit": limit,
            **{f"term_{index}": term for index, term in enumerate(terms)},
        }
        rows = (
            (
                await self.session.execute(
                    text(
                        "SELECT t.document_id, t.revision_id, t.source_path, t.content "
                        "FROM document_texts t JOIN documents d ON d.id=t.document_id "
                        "AND d.workspace_id=t.workspace_id AND d.deleted_at IS NULL "
                        "JOIN document_revisions r ON r.id=t.revision_id "
                        "AND r.revision_number=d.current_revision_number "
                        "WHERE t.workspace_id=:workspace_id"
                        + predicates
                        + " ORDER BY d.updated_at DESC, t.document_id, t.chunk_index LIMIT :limit"
                    ),
                    parameters,
                )
            )
            .mappings()
            .all()
        )
        return [
            LexicalHit(
                UUID(str(row["document_id"])),
                UUID(str(row["revision_id"])),
                str(row["source_path"]),
                str(row["content"]),
            )
            for row in rows
        ]
