from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from hashlib import sha256
from pathlib import PurePath
from uuid import UUID, uuid4

from .domain import (
    Document,
    DocumentRevision,
    DocumentStatus,
    DocumentType,
    EmbeddingProfile,
    KnowledgeActor,
    Provenance,
    ProvenanceRelation,
    SearchHit,
)
from .errors import (
    KnowledgeCommitUnknownError,
    KnowledgeNotFoundError,
    KnowledgePermissionError,
    KnowledgeProviderError,
    KnowledgeValidationError,
    KnowledgeWriteRolledBackError,
)
from .ports import EmbeddingProvider, KnowledgeRepository, ObjectStorage, SearchRepository

SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
ALLOWED_MEDIA_TYPES = frozenset(
    {
        "text/plain",
        "text/markdown",
        "text/csv",
        "text/html",
        "application/json",
        "application/pdf",
        "application/zip",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp",
    }
)


def require(actor: KnowledgeActor, permission: str) -> None:
    if permission not in actor.permissions:
        raise KnowledgePermissionError("permission_denied", f"{permission} is required")


def validate_path(metadata: Mapping[str, object]) -> None:
    path = metadata.get("path")
    if path is None:
        return
    if (
        not isinstance(path, str)
        or len(path) > 1024
        or path.startswith("/")
        or "\\" in path
        or any(ord(char) < 32 for char in path)
        or len(path.split("/")) > 32
        or any(part in {"", ".", ".."} for part in path.split("/"))
    ):
        raise KnowledgeValidationError(
            "invalid_document_path",
            "metadata.path must be a safe relative path with at most 32 components",
        )


class DocumentUseCases:
    def __init__(
        self, repository: KnowledgeRepository, storage: ObjectStorage, *, max_upload_bytes: int
    ) -> None:
        self.repository, self.storage, self.max_upload_bytes = repository, storage, max_upload_bytes

    async def list(
        self, actor: KnowledgeActor, document_type: DocumentType | None = None
    ) -> Sequence[Document]:
        require(actor, "document.read")
        return await self.repository.list_documents(actor, document_type)

    async def get(self, actor: KnowledgeActor, document_id: UUID) -> Document:
        require(actor, "document.read")
        record = await self.repository.get_document(actor, document_id)
        if record is None:
            raise KnowledgeNotFoundError("document_not_found", "Document not found")
        return record

    async def create(
        self,
        actor: KnowledgeActor,
        *,
        title: str,
        slug: str,
        document_type: DocumentType,
        metadata: Mapping[str, object],
    ) -> Document:
        require(actor, "document.create")
        title = title.strip()
        if not title or len(title) > 300 or not SLUG.fullmatch(slug) or len(slug) > 160:
            raise KnowledgeValidationError("invalid_document", "Document title or slug is invalid")
        validate_path(metadata)
        return await self.repository.create_document(
            actor, title=title, slug=slug, document_type=document_type, metadata=metadata
        )

    async def update(
        self,
        actor: KnowledgeActor,
        document_id: UUID,
        *,
        title: str,
        status: DocumentStatus,
        metadata: Mapping[str, object],
        expected_revision: int,
    ) -> Document:
        require(actor, "document.update")
        current = await self.repository.get_document(actor, document_id)
        if current is None:
            raise KnowledgeNotFoundError("document_not_found", "Document not found")
        title = title.strip()
        if not title or len(title) > 300:
            raise KnowledgeValidationError("invalid_document_title", "Document title is invalid")
        validate_path(metadata)
        safe_metadata = dict(metadata)
        safe_metadata.pop("cloud_pair_revision", None)
        if "cloud_pair_revision" in current.metadata:
            safe_metadata["cloud_pair_revision"] = current.metadata["cloud_pair_revision"]
        return await self.repository.update_document(
            actor,
            document_id,
            title=title,
            status=status,
            metadata=safe_metadata,
            expected_revision=expected_revision,
        )

    async def delete(self, actor: KnowledgeActor, document_id: UUID) -> None:
        require(actor, "document.delete")
        if not await self.repository.delete_document(actor, document_id):
            raise KnowledgeNotFoundError("document_not_found", "Document not found")

    async def add_revision(
        self,
        actor: KnowledgeActor,
        document_id: UUID,
        *,
        filename: str,
        media_type: str,
        content: bytes,
        metadata: Mapping[str, object] | None = None,
    ) -> DocumentRevision:
        require(actor, "document.update")
        document = await self.repository.get_document(actor, document_id)
        if document is None:
            raise KnowledgeNotFoundError("document_not_found", "Document not found")
        if document.document_type is DocumentType.SPECIFICATION:
            raise KnowledgeValidationError(
                "pair_required", "Specification content requires paired publication"
            )
        safe_filename = PurePath(filename).name
        if (
            not safe_filename
            or safe_filename in {".", ".."}
            or media_type not in ALLOWED_MEDIA_TYPES
            or not content
            or len(content) > self.max_upload_bytes
        ):
            raise KnowledgeValidationError(
                "invalid_revision", "Revision filename, media type, or content is invalid"
            )
        key = f"workspaces/{actor.workspace_id}/documents/{document_id}/revisions/pending/{uuid4().hex}-{safe_filename}"
        await self.storage.put(key, content, media_type)
        try:
            return await self.repository.reserve_revision(
                actor,
                document_id,
                storage_key=key,
                filename=safe_filename,
                media_type=media_type,
                content_sha256=sha256(content).hexdigest(),
                size_bytes=len(content),
                metadata=metadata or {},
            )
        except KnowledgeWriteRolledBackError:
            await self.storage.delete(key)
            raise
        except KnowledgeCommitUnknownError:
            # The immutable revision may already be authoritative. Retain its
            # uniquely keyed bytes unless PostgreSQL confirms the committed row.
            reconciled = await self.repository.reconcile_revision(actor, document_id, key)
            if reconciled is not None:
                return reconciled
            raise

    async def revisions(
        self, actor: KnowledgeActor, document_id: UUID
    ) -> Sequence[DocumentRevision]:
        await self.get(actor, document_id)
        return await self.repository.list_revisions(actor, document_id)

    async def download(
        self, actor: KnowledgeActor, document_id: UUID, revision_number: int
    ) -> tuple[DocumentRevision, bytes]:
        require(actor, "document.export")
        revision = await self.repository.get_revision(actor, document_id, revision_number)
        if revision is None:
            raise KnowledgeNotFoundError(
                "document_revision_not_found", "Document revision not found"
            )
        content = await self.storage.get(revision.storage_key)
        if len(content) != revision.size_bytes or sha256(content).hexdigest() != revision.sha256:
            raise KnowledgeValidationError(
                "document_digest_mismatch", "Stored revision no longer matches its immutable digest"
            )
        return revision, content

    async def add_provenance(
        self,
        actor: KnowledgeActor,
        *,
        source_document_id: UUID,
        target_document_id: UUID,
        relation: ProvenanceRelation,
        metadata: Mapping[str, object],
    ) -> Provenance:
        require(actor, "document.update")
        if source_document_id == target_document_id:
            raise KnowledgeValidationError(
                "invalid_provenance", "A document cannot derive from itself"
            )
        source = await self.repository.get_document(actor, source_document_id)
        target = await self.repository.get_document(actor, target_document_id)
        if source is None or target is None:
            raise KnowledgeNotFoundError(
                "document_not_found", "Provenance endpoint document not found"
            )
        expected = {
            ProvenanceRelation.PROCESSED_FROM: (DocumentType.ORIGINAL, DocumentType.PROCESSED),
            ProvenanceRelation.SPECIFIES: (DocumentType.PROCESSED, DocumentType.SPECIFICATION),
        }.get(relation)
        if expected and expected != (source.document_type, target.document_type):
            raise KnowledgeValidationError(
                "invalid_provenance_types", "Document types do not match provenance relation"
            )
        return await self.repository.add_provenance(
            actor,
            source_document_id=source_document_id,
            target_document_id=target_document_id,
            relation=relation,
            metadata=metadata,
        )

    async def provenance(self, actor: KnowledgeActor, document_id: UUID) -> Sequence[Provenance]:
        await self.get(actor, document_id)
        return await self.repository.list_provenance(actor, document_id)


def split_text(text: str, size: int, overlap: int) -> list[str]:
    if size < 1 or overlap < 0 or overlap >= size:
        raise ValueError("chunk size must be positive and overlap smaller than size")
    normalized = "\n".join(line.rstrip() for line in text.strip().splitlines())
    if not normalized:
        raise KnowledgeValidationError("empty_document", "Document content is empty")
    chunks, start = [], 0
    while start < len(normalized):
        end = min(start + size, len(normalized))
        if end < len(normalized):
            boundary = normalized.rfind("\n", start + size // 2, end)
            if boundary > start:
                end = boundary
        chunks.append(normalized[start:end].strip())
        if end == len(normalized):
            break
        start = end - overlap
    return [chunk for chunk in chunks if chunk]


class SearchUseCases:
    def __init__(
        self,
        repository: SearchRepository,
        documents: KnowledgeRepository,
        storage: ObjectStorage,
        provider: EmbeddingProvider,
        *,
        provider_name: str,
        model: str,
        chunk_size: int,
        chunk_overlap: int,
    ) -> None:
        self.repository, self.documents, self.storage, self.provider = (
            repository,
            documents,
            storage,
            provider,
        )
        self.provider_name, self.model, self.chunk_size, self.chunk_overlap = (
            provider_name,
            model,
            chunk_size,
            chunk_overlap,
        )

    async def profiles(self, actor: KnowledgeActor) -> Sequence[EmbeddingProfile]:
        require(actor, "document.read")
        return await self.repository.list_profiles(actor)

    async def create_profile(
        self, actor: KnowledgeActor, *, name: str, provider: str, model: str, dimensions: int
    ) -> EmbeddingProfile:
        require(actor, "document.update")
        if (
            provider != self.provider_name
            or model != self.model
            or dimensions != self.provider.dimensions
        ):
            raise KnowledgeProviderError(
                "embedding_profile_mismatch",
                "Profile must match the configured server-side embedding provider",
            )
        return await self.repository.create_profile(
            actor, name=name, provider=provider, model=model, dimensions=dimensions
        )

    async def index(
        self, actor: KnowledgeActor, *, document_id: UUID, revision_number: int, profile_id: UUID
    ) -> int:
        require(actor, "document.update")
        profile = await self.repository.get_profile(actor, profile_id)
        revision = await self.documents.get_revision(actor, document_id, revision_number)
        if profile is None or revision is None:
            raise KnowledgeNotFoundError(
                "search_input_not_found", "Embedding profile or revision not found"
            )
        if not (
            revision.media_type.startswith("text/") or revision.media_type == "application/json"
        ):
            raise KnowledgeValidationError(
                "document_extraction_required",
                "Binary documents require a text Processed Document before indexing",
            )
        content = (await self.storage.get(revision.storage_key)).decode("utf-8")
        chunks = split_text(content, self.chunk_size, self.chunk_overlap)
        vectors = await self.provider.embed(chunks)
        if len(vectors) != len(chunks) or any(
            len(vector) != profile.dimensions for vector in vectors
        ):
            raise KnowledgeProviderError(
                "invalid_embedding_response", "Embedding provider returned invalid dimensions"
            )
        await self.repository.replace_chunks(
            actor,
            document_id=document_id,
            revision_id=revision.id,
            profile_id=profile_id,
            contents=chunks,
            vectors=vectors,
        )
        return len(chunks)

    async def search(
        self, actor: KnowledgeActor, *, profile_id: UUID, query: str, limit: int
    ) -> Sequence[SearchHit]:
        require(actor, "document.read")
        query = query.strip()
        if not query or len(query) > 2000 or not 1 <= limit <= 50:
            raise KnowledgeValidationError("invalid_search", "Search query or limit is invalid")
        profile = await self.repository.get_profile(actor, profile_id)
        if profile is None:
            raise KnowledgeNotFoundError(
                "embedding_profile_not_found", "Embedding profile not found"
            )
        vectors = await self.provider.embed([query])
        if len(vectors) != 1 or len(vectors[0]) != profile.dimensions:
            raise KnowledgeProviderError(
                "invalid_embedding_response", "Embedding provider returned invalid dimensions"
            )
        return await self.repository.hybrid_search(
            actor, profile_id=profile_id, query=query, vector=vectors[0], limit=limit
        )
