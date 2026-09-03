"""Document lifecycle, immutable content revisions, and provenance rules."""

from __future__ import annotations

from hashlib import sha256
from pathlib import PurePath
from uuid import UUID, uuid4

from sqlalchemy.exc import IntegrityError

from app.common.errors import ApplicationError, ConflictError, NotFoundError
from app.core.config import Settings
from app.infrastructure.object_storage import ObjectStorage
from app.modules.auth.authorization import AuthorizedContext
from app.modules.document.models import (
    Document,
    DocumentProvenance,
    DocumentRevision,
    DocumentStatus,
    DocumentType,
    ProvenanceRelation,
)
from app.modules.document.repository import DocumentRepository

ALLOWED_MEDIA_TYPES = {
    "application/json",
    "application/pdf",
    "application/zip",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/csv",
    "text/markdown",
    "text/plain",
}


class DocumentService:
    def __init__(
        self, repository: DocumentRepository, storage: ObjectStorage, settings: Settings
    ) -> None:
        self.repository = repository
        self.storage = storage
        self.settings = settings

    async def list(
        self, context: AuthorizedContext, document_type: DocumentType | None = None
    ) -> list[Document]:
        return await self.repository.list(_workspace_id(context), document_type)

    async def get(self, context: AuthorizedContext, document_id: UUID) -> Document:
        record = await self.repository.get(_workspace_id(context), document_id)
        if record is None:
            raise NotFoundError("document_not_found", "Document not found")
        return record

    async def create(
        self,
        context: AuthorizedContext,
        title: str,
        slug: str,
        document_type: DocumentType,
        metadata: dict[str, object],
    ) -> Document:
        try:
            record = await self.repository.create(
                _workspace_id(context), title.strip(), slug, document_type, metadata
            )
            await self.repository.commit()
            return record
        except IntegrityError as exc:
            await self.repository.rollback()
            raise ConflictError("document_slug_conflict", "Document slug already exists") from exc

    async def update(
        self,
        context: AuthorizedContext,
        document_id: UUID,
        title: str,
        status: DocumentStatus,
        metadata: dict[str, object],
        revision: int,
    ) -> Document:
        record = await self.repository.update(
            _workspace_id(context), document_id, title.strip(), status, metadata, revision
        )
        if record is None:
            raise ConflictError("document_revision_conflict", "Document changed concurrently")
        await self.repository.commit()
        return record

    async def add_revision(
        self,
        context: AuthorizedContext,
        document_id: UUID,
        filename: str,
        media_type: str,
        content: bytes,
        metadata: dict[str, object] | None = None,
    ) -> DocumentRevision:
        await self.get(context, document_id)
        safe_filename = PurePath(filename).name
        if not safe_filename or safe_filename in {".", ".."}:
            raise ApplicationError("invalid_filename", "A valid filename is required", 400)
        if media_type not in ALLOWED_MEDIA_TYPES:
            raise ApplicationError("unsupported_media_type", "Unsupported document media type", 415)
        if not content:
            raise ApplicationError("empty_document", "Document content is empty", 400)
        if len(content) > self.settings.document_max_upload_bytes:
            raise ApplicationError("document_too_large", "Document exceeds upload limit", 413)

        revision_number = await self.repository.next_revision_number(document_id)
        workspace_id = _workspace_id(context)
        storage_key = (
            f"workspaces/{workspace_id}/documents/{document_id}/"
            f"revisions/{revision_number}/{uuid4().hex}-{safe_filename}"
        )
        record = DocumentRevision(
            workspace_id=workspace_id,
            document_id=document_id,
            revision_number=revision_number,
            storage_key=storage_key,
            filename=safe_filename,
            media_type=media_type,
            size_bytes=len(content),
            sha256=sha256(content).hexdigest(),
            created_by_user_id=context.principal.user_id,
            revision_metadata=metadata or {},
        )
        await self.storage.put(storage_key, content, media_type)
        try:
            await self.repository.add_revision(record)
            await self.repository.commit()
        except Exception:
            await self.repository.rollback()
            await self.storage.delete(storage_key)
            raise
        return record

    async def list_revisions(
        self, context: AuthorizedContext, document_id: UUID
    ) -> list[DocumentRevision]:
        await self.get(context, document_id)
        return await self.repository.list_revisions(_workspace_id(context), document_id)

    async def download(
        self, context: AuthorizedContext, document_id: UUID, revision_number: int
    ) -> tuple[DocumentRevision, bytes]:
        record = await self.repository.get_revision(
            _workspace_id(context), document_id, revision_number
        )
        if record is None:
            raise NotFoundError("document_revision_not_found", "Document revision not found")
        return record, await self.storage.get(record.storage_key)

    async def add_provenance(
        self,
        context: AuthorizedContext,
        source_document_id: UUID,
        target_document_id: UUID,
        relation: ProvenanceRelation,
        metadata: dict[str, object],
    ) -> DocumentProvenance:
        if source_document_id == target_document_id:
            raise ApplicationError(
                "invalid_provenance", "A document cannot derive from itself", 400
            )
        source = await self.get(context, source_document_id)
        target = await self.get(context, target_document_id)
        _validate_relation(source.document_type, target.document_type, relation)
        try:
            record = await self.repository.add_provenance(
                _workspace_id(context),
                source_document_id,
                target_document_id,
                relation,
                metadata,
            )
            await self.repository.commit()
            return record
        except IntegrityError as exc:
            await self.repository.rollback()
            raise ConflictError(
                "provenance_exists", "Provenance relationship already exists"
            ) from exc

    async def list_provenance(
        self, context: AuthorizedContext, document_id: UUID
    ) -> list[DocumentProvenance]:
        await self.get(context, document_id)
        return await self.repository.list_provenance(_workspace_id(context), document_id)

    async def delete(self, context: AuthorizedContext, document_id: UUID) -> None:
        if not await self.repository.soft_delete(_workspace_id(context), document_id):
            raise NotFoundError("document_not_found", "Document not found")
        await self.repository.commit()


def _validate_relation(
    source_type: DocumentType, target_type: DocumentType, relation: ProvenanceRelation
) -> None:
    expected = {
        ProvenanceRelation.PROCESSED_FROM: (DocumentType.ORIGINAL, DocumentType.PROCESSED),
        ProvenanceRelation.SPECIFIES: (DocumentType.PROCESSED, DocumentType.SPECIFICATION),
    }
    types = expected.get(relation)
    if types is not None and types != (source_type, target_type):
        raise ApplicationError(
            "invalid_provenance_types", "Document types do not match provenance relation", 400
        )


def _workspace_id(context: AuthorizedContext) -> UUID:
    if context.scope.workspace_id is None:
        raise ApplicationError("workspace_scope_required", "Workspace scope is required", 400)
    return context.scope.workspace_id
