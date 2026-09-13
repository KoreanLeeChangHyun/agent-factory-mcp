"""Authorized, integrity-checked access to immutable Document packages."""

from uuid import UUID

from .domain import DocumentRevision, KnowledgeActor
from .errors import KnowledgeNotFoundError, KnowledgePermissionError
from .packages import PackageLimits, digest, safe_package_path, unpack_package
from .ports import KnowledgeRepository, ObjectStorage


class DocumentPackageQueries:
    def __init__(
        self, repository: KnowledgeRepository, storage: ObjectStorage, limits: PackageLimits
    ) -> None:
        self.repository = repository
        self.storage = storage
        self.limits = limits

    async def read(
        self, actor: KnowledgeActor, document_id: UUID, revision_number: int
    ) -> tuple[DocumentRevision, dict[str, bytes]]:
        if "document.read" not in actor.permissions:
            raise KnowledgePermissionError("permission_denied", "Document permission is required")
        document = await self.repository.get_document(actor, document_id)
        revision = await self.repository.get_revision(actor, document_id, revision_number)
        if document is None or revision is None:
            raise KnowledgeNotFoundError("document_revision_not_found", "Revision not found")
        content = await self.storage.get(revision.storage_key)
        if len(content) != revision.size_bytes or digest(content) != revision.sha256:
            raise KnowledgeNotFoundError("source_hash_mismatch", "Stored revision integrity failed")
        return revision, unpack_package(
            content, revision.media_type, revision.filename, self.limits
        )

    async def member(
        self, actor: KnowledgeActor, document_id: UUID, revision_number: int, path: str
    ) -> bytes:
        safe_package_path(path)
        if "document.export" not in actor.permissions:
            raise KnowledgePermissionError("permission_denied", "Document export is required")
        _, files = await self.read(actor, document_id, revision_number)
        if path not in files:
            raise KnowledgeNotFoundError("package_member_not_found", "Member not found")
        return files[path]
