from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from types import MappingProxyType
from uuid import UUID


class DocumentType(StrEnum):
    ORIGINAL = "original"
    PROCESSED = "processed"
    SPECIFICATION = "specification"


class DocumentStatus(StrEnum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class ProvenanceRelation(StrEnum):
    DERIVED_FROM = "derived_from"
    PROCESSED_FROM = "processed_from"
    SPECIFIES = "specifies"


@dataclass(frozen=True, slots=True)
class KnowledgeActor:
    user_id: UUID
    organization_id: UUID
    workspace_id: UUID
    permissions: frozenset[str]


@dataclass(frozen=True, slots=True)
class Document:
    id: UUID
    workspace_id: UUID
    document_type: DocumentType
    title: str
    slug: str
    status: DocumentStatus
    metadata: Mapping[str, object]
    current_revision_number: int
    revision: int
    created_at: datetime
    updated_at: datetime

    def __post_init__(self) -> None:
        object.__setattr__(self, "metadata", MappingProxyType(dict(self.metadata)))


@dataclass(frozen=True, slots=True)
class DocumentRevision:
    id: UUID
    workspace_id: UUID
    document_id: UUID
    revision_number: int
    storage_key: str
    filename: str
    media_type: str
    size_bytes: int
    sha256: str
    created_by_user_id: UUID
    metadata: Mapping[str, object]
    created_at: datetime

    def __post_init__(self) -> None:
        object.__setattr__(self, "metadata", MappingProxyType(dict(self.metadata)))


@dataclass(frozen=True, slots=True)
class Provenance:
    id: UUID
    workspace_id: UUID
    source_document_id: UUID
    target_document_id: UUID
    relation: ProvenanceRelation
    metadata: Mapping[str, object]
    created_at: datetime

    def __post_init__(self) -> None:
        object.__setattr__(self, "metadata", MappingProxyType(dict(self.metadata)))


@dataclass(frozen=True, slots=True)
class EmbeddingProfile:
    id: UUID
    workspace_id: UUID
    name: str
    provider: str
    model: str
    dimensions: int
    active: bool


@dataclass(frozen=True, slots=True)
class SearchHit:
    chunk_id: UUID
    document_id: UUID
    document_revision_id: UUID
    content: str
    score: float
    semantic_score: float
    lexical_score: float
    metadata: Mapping[str, object] = field(default_factory=dict)

    def __post_init__(self) -> None:
        object.__setattr__(self, "metadata", MappingProxyType(dict(self.metadata)))
