"""Rebuildable document indexing and hybrid retrieval use cases."""

from __future__ import annotations

from app.modules.auth.authorization import require_context

from uuid import UUID

from sqlalchemy.exc import IntegrityError

from app.common.errors import ApplicationError, ConflictError, NotFoundError
from app.core.config import Settings
from app.infrastructure.embeddings import EmbeddingProvider
from app.infrastructure.object_storage import ObjectStorage
from app.modules.auth.authorization import AuthorizedContext
from app.modules.document.models import EmbeddingProfile
from app.modules.document.search_repository import SearchRepository
from app.modules.document.search_schemas import SearchHit


class DocumentSearchService:
    def __init__(
        self,
        repository: SearchRepository,
        provider: EmbeddingProvider,
        storage: ObjectStorage,
        settings: Settings,
    ) -> None:
        self.repository = repository
        self.provider = provider
        self.storage = storage
        self.settings = settings

    async def create_profile(
        self,
        context: AuthorizedContext,
        name: str,
        provider: str,
        model: str,
        dimensions: int,
    ) -> EmbeddingProfile:
        require_context(context, "document.update")
        if self.settings.embedding_provider == "disabled":
            raise ApplicationError(
                "embedding_provider_unconfigured", "Embedding provider is not configured", 503
            )
        if provider != self.settings.embedding_provider or model != self.settings.embedding_model:
            raise ApplicationError(
                "embedding_profile_mismatch",
                "Profile provider and model must match the configured deployment provider",
                400,
            )
        if (
            dimensions != self.settings.embedding_dimensions
            or dimensions != self.provider.dimensions
        ):
            raise ApplicationError(
                "embedding_dimensions_mismatch",
                f"This deployment requires {self.settings.embedding_dimensions} dimensions",
                400,
            )
        try:
            profile = await self.repository.create_profile(
                _workspace_id(context), name, provider, model, dimensions
            )
            await self.repository.commit()
            return profile
        except IntegrityError as exc:
            await self.repository.rollback()
            raise ConflictError(
                "embedding_profile_exists", "Embedding profile already exists"
            ) from exc

    async def list_profiles(self, context: AuthorizedContext) -> list[EmbeddingProfile]:
        require_context(context, "document.read")
        return await self.repository.list_profiles(_workspace_id(context))

    async def index_document(
        self,
        context: AuthorizedContext,
        document_id: UUID,
        revision_id: UUID,
        profile_id: UUID,
    ) -> int:
        require_context(context, "document.update")
        workspace_id = _workspace_id(context)
        profile = await self._profile(workspace_id, profile_id)
        revision = await self.repository.get_revision(workspace_id, document_id, revision_id)
        if revision is None:
            raise NotFoundError("document_revision_not_found", "Document revision not found")
        if (
            not revision.media_type.startswith("text/")
            and revision.media_type != "application/json"
        ):
            raise ApplicationError(
                "document_extraction_required",
                "This document format must be extracted to text before indexing",
                409,
            )
        raw_content = await self.storage.get(revision.storage_key)
        try:
            content = raw_content.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise ApplicationError(
                "invalid_document_encoding", "Searchable document content must be UTF-8", 400
            ) from exc
        chunks = split_text(
            content,
            self.settings.document_chunk_characters,
            self.settings.document_chunk_overlap,
        )
        vectors = await self.provider.embed(chunks)
        if any(len(vector) != profile.dimensions for vector in vectors):
            raise ApplicationError(
                "invalid_embedding_response", "Embedding provider returned invalid dimensions", 502
            )
        try:
            await self.repository.replace_chunks(
                workspace_id, document_id, revision.id, profile.id, chunks, vectors
            )
            await self.repository.commit()
        except Exception:
            await self.repository.rollback()
            raise
        return len(chunks)

    async def search(
        self,
        context: AuthorizedContext,
        profile_id: UUID,
        query: str,
        limit: int,
    ) -> list[SearchHit]:
        require_context(context, "document.read")
        workspace_id = _workspace_id(context)
        await self._profile(workspace_id, profile_id)
        vector = (await self.provider.embed([query.strip()]))[0]
        rows = await self.repository.hybrid_search(
            workspace_id, profile_id, query.strip(), vector, limit
        )
        return [
            SearchHit(
                chunk_id=chunk.id,
                document_id=chunk.document_id,
                document_revision_id=chunk.document_revision_id,
                content=chunk.content,
                score=(semantic * 0.7) + (lexical * 0.3),
                semantic_score=semantic,
                lexical_score=lexical,
                metadata=chunk.chunk_metadata,
            )
            for chunk, semantic, lexical in rows
        ]

    async def _profile(self, workspace_id: UUID, profile_id: UUID) -> EmbeddingProfile:
        profile = await self.repository.get_profile(workspace_id, profile_id)
        if profile is None:
            raise NotFoundError("embedding_profile_not_found", "Embedding profile not found")
        return profile


def split_text(text: str, size: int, overlap: int) -> list[str]:
    if size < 1 or overlap < 0 or overlap >= size:
        raise ValueError("chunk size must be positive and overlap smaller than size")
    normalized = "\n".join(line.rstrip() for line in text.strip().splitlines())
    if not normalized:
        raise ApplicationError("empty_document", "Document content is empty", 400)
    chunks: list[str] = []
    start = 0
    while start < len(normalized):
        end = min(start + size, len(normalized))
        if end < len(normalized):
            boundary = normalized.rfind("\n", start + (size // 2), end)
            if boundary > start:
                end = boundary
        chunks.append(normalized[start:end].strip())
        if end == len(normalized):
            break
        start = end - overlap
    return [chunk for chunk in chunks if chunk]


def _workspace_id(context: AuthorizedContext) -> UUID:
    if context.scope.workspace_id is None:
        raise ApplicationError("workspace_scope_required", "Workspace scope is required", 400)
    return context.scope.workspace_id
