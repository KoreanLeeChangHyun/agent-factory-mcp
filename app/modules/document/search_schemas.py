"""Embedding profile, indexing, and hybrid search schemas."""

from uuid import UUID

from pydantic import BaseModel, Field


class EmbeddingProfileCreate(BaseModel):
    name: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=100)
    provider: str = Field(min_length=1, max_length=80)
    model: str = Field(min_length=1, max_length=200)
    dimensions: int = Field(default=1536, ge=1, le=2000)


class EmbeddingProfileResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    name: str
    provider: str
    model: str
    dimensions: int
    is_active: bool


class IndexDocumentRequest(BaseModel):
    document_revision_id: UUID


class IndexDocumentResponse(BaseModel):
    chunks_indexed: int


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    embedding_profile_id: UUID
    limit: int = Field(default=10, ge=1, le=50)


class SearchHit(BaseModel):
    chunk_id: UUID
    document_id: UUID
    document_revision_id: UUID
    content: str
    score: float
    semantic_score: float
    lexical_score: float
    metadata: dict[str, object]
