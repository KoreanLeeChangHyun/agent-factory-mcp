from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from datetime import datetime
from uuid import UUID, uuid4

from agent_factory_core.knowledge.domain import (
    Document,
    DocumentRevision,
    DocumentStatus,
    DocumentType,
    KnowledgeActor,
    Provenance,
    ProvenanceRelation,
)
from agent_factory_core.knowledge.errors import (
    KnowledgeCommitUnknownError,
    KnowledgeConflictError,
    KnowledgeNotFoundError,
    KnowledgeWriteRolledBackError,
)
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from .audit import append_knowledge_audit


class PostgresKnowledgeRepository:
    """PostgreSQL adapter for authoritative Document metadata and immutable revisions."""

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
    def _document(row: Mapping[str, object]) -> Document:
        return Document(
            id=UUID(str(row["id"])),
            workspace_id=UUID(str(row["workspace_id"])),
            document_type=DocumentType(str(row["document_type"])),
            title=str(row["title"]),
            slug=str(row["slug"]),
            status=DocumentStatus(str(row["status"])),
            metadata=dict(
                row["document_metadata"] if isinstance(row["document_metadata"], Mapping) else {}
            ),
            current_revision_number=int(str(row["current_revision_number"])),
            revision=int(str(row["revision"])),
            created_at=row["created_at"]
            if isinstance(row["created_at"], datetime)
            else datetime.fromisoformat(str(row["created_at"])),
            updated_at=row["updated_at"]
            if isinstance(row["updated_at"], datetime)
            else datetime.fromisoformat(str(row["updated_at"])),
        )

    @staticmethod
    def _revision(row: Mapping[str, object]) -> DocumentRevision:
        return DocumentRevision(
            id=UUID(str(row["id"])),
            workspace_id=UUID(str(row["workspace_id"])),
            document_id=UUID(str(row["document_id"])),
            revision_number=int(str(row["revision_number"])),
            storage_key=str(row["storage_key"]),
            filename=str(row["filename"]),
            media_type=str(row["media_type"]),
            size_bytes=int(str(row["size_bytes"])),
            sha256=str(row["sha256"]),
            created_by_user_id=UUID(str(row["created_by_user_id"])),
            metadata=dict(
                row["revision_metadata"] if isinstance(row["revision_metadata"], Mapping) else {}
            ),
            created_at=row["created_at"]
            if isinstance(row["created_at"], datetime)
            else datetime.fromisoformat(str(row["created_at"])),
        )

    @staticmethod
    def _provenance(row: Mapping[str, object]) -> Provenance:
        return Provenance(
            id=UUID(str(row["id"])),
            workspace_id=UUID(str(row["workspace_id"])),
            source_document_id=UUID(str(row["source_document_id"])),
            target_document_id=UUID(str(row["target_document_id"])),
            relation=ProvenanceRelation(str(row["relation"])),
            metadata=dict(
                row["provenance_metadata"]
                if isinstance(row["provenance_metadata"], Mapping)
                else {}
            ),
            created_at=row["created_at"]
            if isinstance(row["created_at"], datetime)
            else datetime.fromisoformat(str(row["created_at"])),
        )

    async def _audit(self, actor: KnowledgeActor, action: str, target_id: UUID) -> None:
        await append_knowledge_audit(
            self.session,
            actor,
            action=action,
            target_type="document",
            target_id=target_id,
            request_id=self.request_id,
            source=self.source,
        )

    async def list_documents(
        self, actor: KnowledgeActor, document_type: DocumentType | None
    ) -> Sequence[Document]:
        await self._context(actor)
        clause = " AND document_type = :document_type" if document_type else ""
        rows = (
            (
                await self.session.execute(
                    text(
                        "SELECT id, workspace_id, document_type, title, slug, status, document_metadata, current_revision_number, revision, created_at, updated_at FROM documents WHERE workspace_id = :workspace_id AND deleted_at IS NULL"
                        + clause
                        + " ORDER BY updated_at DESC"
                    ),
                    {
                        "workspace_id": actor.workspace_id,
                        "document_type": document_type.value if document_type else None,
                    },
                )
            )
            .mappings()
            .all()
        )
        return [self._document(row) for row in rows]

    async def get_document(self, actor: KnowledgeActor, document_id: UUID) -> Document | None:
        await self._context(actor)
        row = (
            (
                await self.session.execute(
                    text(
                        "SELECT id, workspace_id, document_type, title, slug, status, document_metadata, current_revision_number, revision, created_at, updated_at FROM documents WHERE workspace_id = :workspace_id AND id = :id AND deleted_at IS NULL"
                    ),
                    {"workspace_id": actor.workspace_id, "id": document_id},
                )
            )
            .mappings()
            .one_or_none()
        )
        return self._document(row) if row else None

    async def create_document(
        self,
        actor: KnowledgeActor,
        *,
        title: str,
        slug: str,
        document_type: DocumentType,
        metadata: Mapping[str, object],
    ) -> Document:
        await self._context(actor)
        document_id = uuid4()
        try:
            row = (
                (
                    await self.session.execute(
                        text(
                            "INSERT INTO documents (id, workspace_id, document_type, title, slug, status, document_metadata, current_revision_number, revision, created_at, updated_at) VALUES (:id, :workspace_id, :document_type, :title, :slug, 'active', CAST(:metadata AS jsonb), 0, 1, now(), now()) RETURNING id, workspace_id, document_type, title, slug, status, document_metadata, current_revision_number, revision, created_at, updated_at"
                        ),
                        {
                            "id": document_id,
                            "workspace_id": actor.workspace_id,
                            "document_type": document_type.value,
                            "title": title,
                            "slug": slug,
                            "metadata": json.dumps(dict(metadata), separators=(",", ":")),
                        },
                    )
                )
                .mappings()
                .one()
            )
            await self._audit(actor, "document.create", document_id)
            await self.session.commit()
            return self._document(row)
        except IntegrityError as error:
            await self.session.rollback()
            raise KnowledgeConflictError(
                "document_slug_conflict", "Document slug already exists"
            ) from error

    async def update_document(
        self,
        actor: KnowledgeActor,
        document_id: UUID,
        *,
        title: str,
        status: DocumentStatus,
        metadata: Mapping[str, object],
        expected_revision: int,
    ) -> Document:
        await self._context(actor)
        row = (
            (
                await self.session.execute(
                    text(
                        "UPDATE documents SET title=:title, status=:status, document_metadata=CAST(:metadata AS jsonb), revision=revision+1, updated_at=now() WHERE workspace_id=:workspace_id AND id=:id AND revision=:revision AND deleted_at IS NULL RETURNING id, workspace_id, document_type, title, slug, status, document_metadata, current_revision_number, revision, created_at, updated_at"
                    ),
                    {
                        "title": title,
                        "status": status.value,
                        "metadata": json.dumps(dict(metadata), separators=(",", ":")),
                        "workspace_id": actor.workspace_id,
                        "id": document_id,
                        "revision": expected_revision,
                    },
                )
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            await self.session.rollback()
            raise KnowledgeConflictError(
                "document_revision_conflict", "Document changed concurrently"
            )
        await self._audit(actor, "document.update", document_id)
        await self.session.commit()
        return self._document(row)

    async def delete_document(self, actor: KnowledgeActor, document_id: UUID) -> bool:
        await self._context(actor)
        result = await self.session.execute(
            text(
                "UPDATE documents SET deleted_at=now(), revision=revision+1, updated_at=now() WHERE workspace_id=:workspace_id AND id=:id AND deleted_at IS NULL"
            ),
            {"workspace_id": actor.workspace_id, "id": document_id},
        )
        if not result.rowcount:
            await self.session.rollback()
            return False
        await self._audit(actor, "document.delete", document_id)
        await self.session.commit()
        return True

    async def reserve_revision(
        self,
        actor: KnowledgeActor,
        document_id: UUID,
        *,
        storage_key: str,
        filename: str,
        media_type: str,
        content_sha256: str,
        size_bytes: int,
        metadata: Mapping[str, object],
    ) -> DocumentRevision:
        await self._context(actor)
        try:
            current = await self.session.scalar(
                text(
                    "SELECT current_revision_number FROM documents WHERE workspace_id=:workspace_id AND id=:id AND deleted_at IS NULL FOR UPDATE"
                ),
                {"workspace_id": actor.workspace_id, "id": document_id},
            )
            if current is None:
                raise KnowledgeNotFoundError("document_not_found", "Document not found")
            revision_number, revision_id = int(current) + 1, uuid4()
            row = (
                (
                    await self.session.execute(
                        text(
                            "INSERT INTO document_revisions (id, workspace_id, document_id, revision_number, storage_key, filename, media_type, size_bytes, sha256, created_by_user_id, revision_metadata, created_at, updated_at) VALUES (:id, :workspace_id, :document_id, :revision_number, :storage_key, :filename, :media_type, :size_bytes, :sha256, :user_id, CAST(:metadata AS jsonb), now(), now()) RETURNING id, workspace_id, document_id, revision_number, storage_key, filename, media_type, size_bytes, sha256, created_by_user_id, revision_metadata, created_at"
                        ),
                        {
                            "id": revision_id,
                            "workspace_id": actor.workspace_id,
                            "document_id": document_id,
                            "revision_number": revision_number,
                            "storage_key": storage_key,
                            "filename": filename,
                            "media_type": media_type,
                            "size_bytes": size_bytes,
                            "sha256": content_sha256,
                            "user_id": actor.user_id,
                            "metadata": json.dumps(dict(metadata), separators=(",", ":")),
                        },
                    )
                )
                .mappings()
                .one()
            )
            await self.session.execute(
                text(
                    "UPDATE documents SET current_revision_number=:number, revision=revision+1, updated_at=now() WHERE id=:id AND workspace_id=:workspace_id"
                ),
                {
                    "number": revision_number,
                    "id": document_id,
                    "workspace_id": actor.workspace_id,
                },
            )
            await self._audit(actor, "document.revision.create", document_id)
        except KnowledgeNotFoundError:
            await self.session.rollback()
            raise
        except Exception as error:
            await self.session.rollback()
            raise KnowledgeWriteRolledBackError(
                "revision_write_rolled_back", "Revision transaction did not commit"
            ) from error
        try:
            await self.session.commit()
        except Exception as error:
            raise KnowledgeCommitUnknownError(
                "revision_commit_unknown",
                "Revision commit acknowledgement was lost; retain staged bytes",
            ) from error
        return self._revision(row)

    async def reconcile_revision(
        self, actor: KnowledgeActor, document_id: UUID, storage_key: str
    ) -> DocumentRevision | None:
        # Clear any locally failed transaction before inspecting the server's
        # authoritative outcome using the unique object key.
        await self.session.rollback()
        await self._context(actor)
        row = (
            (
                await self.session.execute(
                    text(
                        "SELECT id, workspace_id, document_id, revision_number, storage_key, "
                        "filename, media_type, size_bytes, sha256, created_by_user_id, "
                        "revision_metadata, created_at FROM document_revisions "
                        "WHERE workspace_id=:workspace_id AND document_id=:document_id "
                        "AND storage_key=:storage_key"
                    ),
                    {
                        "workspace_id": actor.workspace_id,
                        "document_id": document_id,
                        "storage_key": storage_key,
                    },
                )
            )
            .mappings()
            .one_or_none()
        )
        return self._revision(row) if row else None

    async def list_revisions(
        self, actor: KnowledgeActor, document_id: UUID
    ) -> Sequence[DocumentRevision]:
        await self._context(actor)
        rows = (
            (
                await self.session.execute(
                    text(
                        "SELECT id, workspace_id, document_id, revision_number, storage_key, filename, media_type, size_bytes, sha256, created_by_user_id, revision_metadata, created_at FROM document_revisions WHERE workspace_id=:workspace_id AND document_id=:document_id ORDER BY revision_number DESC"
                    ),
                    {"workspace_id": actor.workspace_id, "document_id": document_id},
                )
            )
            .mappings()
            .all()
        )
        return [self._revision(row) for row in rows]

    async def get_revision(
        self, actor: KnowledgeActor, document_id: UUID, revision_number: int
    ) -> DocumentRevision | None:
        await self._context(actor)
        row = (
            (
                await self.session.execute(
                    text(
                        "SELECT id, workspace_id, document_id, revision_number, storage_key, filename, media_type, size_bytes, sha256, created_by_user_id, revision_metadata, created_at FROM document_revisions WHERE workspace_id=:workspace_id AND document_id=:document_id AND revision_number=:revision_number"
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
        return self._revision(row) if row else None

    async def add_provenance(
        self,
        actor: KnowledgeActor,
        *,
        source_document_id: UUID,
        target_document_id: UUID,
        relation: ProvenanceRelation,
        metadata: Mapping[str, object],
    ) -> Provenance:
        await self._context(actor)
        provenance_id = uuid4()
        try:
            row = (
                (
                    await self.session.execute(
                        text(
                            "INSERT INTO document_provenance (id, workspace_id, source_document_id, target_document_id, relation, provenance_metadata, created_at, updated_at) SELECT :id, :workspace_id, :source, :target, :relation, CAST(:metadata AS jsonb), now(), now() WHERE EXISTS (SELECT 1 FROM documents WHERE id=:source AND workspace_id=:workspace_id AND deleted_at IS NULL) AND EXISTS (SELECT 1 FROM documents WHERE id=:target AND workspace_id=:workspace_id AND deleted_at IS NULL) RETURNING id, workspace_id, source_document_id, target_document_id, relation, provenance_metadata, created_at"
                        ),
                        {
                            "id": provenance_id,
                            "workspace_id": actor.workspace_id,
                            "source": source_document_id,
                            "target": target_document_id,
                            "relation": relation.value,
                            "metadata": json.dumps(dict(metadata), separators=(",", ":")),
                        },
                    )
                )
                .mappings()
                .one_or_none()
            )
            if row is None:
                raise KnowledgeNotFoundError(
                    "document_not_found", "Provenance endpoint document not found"
                )
            await self._audit(actor, "document.provenance.create", target_document_id)
            await self.session.commit()
            return self._provenance(row)
        except IntegrityError as error:
            await self.session.rollback()
            raise KnowledgeConflictError(
                "provenance_exists", "Provenance relationship already exists"
            ) from error

    async def list_provenance(
        self, actor: KnowledgeActor, document_id: UUID
    ) -> Sequence[Provenance]:
        await self._context(actor)
        rows = (
            (
                await self.session.execute(
                    text(
                        "SELECT id, workspace_id, source_document_id, target_document_id, relation, provenance_metadata, created_at FROM document_provenance WHERE workspace_id=:workspace_id AND (source_document_id=:document_id OR target_document_id=:document_id) ORDER BY created_at"
                    ),
                    {"workspace_id": actor.workspace_id, "document_id": document_id},
                )
            )
            .mappings()
            .all()
        )
        return [self._provenance(row) for row in rows]
