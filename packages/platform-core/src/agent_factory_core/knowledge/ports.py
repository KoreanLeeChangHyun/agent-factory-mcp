from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Protocol
from uuid import UUID

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


class KnowledgeRepository(Protocol):
    async def list_documents(
        self, actor: KnowledgeActor, document_type: DocumentType | None
    ) -> Sequence[Document]: ...
    async def get_document(self, actor: KnowledgeActor, document_id: UUID) -> Document | None: ...
    async def create_document(
        self,
        actor: KnowledgeActor,
        *,
        title: str,
        slug: str,
        document_type: DocumentType,
        metadata: Mapping[str, object],
    ) -> Document: ...
    async def update_document(
        self,
        actor: KnowledgeActor,
        document_id: UUID,
        *,
        title: str,
        status: DocumentStatus,
        metadata: Mapping[str, object],
        expected_revision: int,
    ) -> Document: ...
    async def delete_document(self, actor: KnowledgeActor, document_id: UUID) -> bool: ...
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
    ) -> DocumentRevision: ...
    async def reconcile_revision(
        self, actor: KnowledgeActor, document_id: UUID, storage_key: str
    ) -> DocumentRevision | None: ...
    async def list_revisions(
        self, actor: KnowledgeActor, document_id: UUID
    ) -> Sequence[DocumentRevision]: ...
    async def get_revision(
        self, actor: KnowledgeActor, document_id: UUID, revision_number: int
    ) -> DocumentRevision | None: ...
    async def add_provenance(
        self,
        actor: KnowledgeActor,
        *,
        source_document_id: UUID,
        target_document_id: UUID,
        relation: ProvenanceRelation,
        metadata: Mapping[str, object],
    ) -> Provenance: ...
    async def list_provenance(
        self, actor: KnowledgeActor, document_id: UUID
    ) -> Sequence[Provenance]: ...


class ObjectStorage(Protocol):
    async def put(self, key: str, content: bytes, media_type: str) -> None: ...
    async def get(self, key: str) -> bytes: ...
    async def delete(self, key: str) -> None: ...


class EmbeddingProvider(Protocol):
    @property
    def dimensions(self) -> int: ...
    async def embed(self, texts: Sequence[str]) -> Sequence[Sequence[float]]: ...


class SearchRepository(Protocol):
    async def create_profile(
        self, actor: KnowledgeActor, *, name: str, provider: str, model: str, dimensions: int
    ) -> EmbeddingProfile: ...
    async def list_profiles(self, actor: KnowledgeActor) -> Sequence[EmbeddingProfile]: ...
    async def get_profile(
        self, actor: KnowledgeActor, profile_id: UUID
    ) -> EmbeddingProfile | None: ...
    async def replace_chunks(
        self,
        actor: KnowledgeActor,
        *,
        document_id: UUID,
        revision_id: UUID,
        profile_id: UUID,
        contents: Sequence[str],
        vectors: Sequence[Sequence[float]],
    ) -> None: ...
    async def hybrid_search(
        self,
        actor: KnowledgeActor,
        *,
        profile_id: UUID,
        query: str,
        vector: Sequence[float],
        limit: int,
    ) -> Sequence[SearchHit]: ...
