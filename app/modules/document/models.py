"""Workspace Document metadata, immutable revisions, and loose provenance."""

from enum import StrEnum
from uuid import UUID

from pgvector.sqlalchemy import Vector
from sqlalchemy import JSON, BigInteger, Computed, Enum, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, RevisionMixin, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


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


class Document(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, RevisionMixin, Base):
    __tablename__ = "documents"
    __table_args__ = (UniqueConstraint("workspace_id", "slug"),)

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    document_type: Mapped[DocumentType] = mapped_column(
        Enum(
            DocumentType,
            native_enum=False,
            values_callable=lambda values: [v.value for v in values],
        )
    )
    title: Mapped[str] = mapped_column(String(300))
    slug: Mapped[str] = mapped_column(String(160))
    status: Mapped[DocumentStatus] = mapped_column(
        Enum(
            DocumentStatus,
            native_enum=False,
            values_callable=lambda values: [v.value for v in values],
        ),
        default=DocumentStatus.ACTIVE,
    )
    document_metadata: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    current_revision_number: Mapped[int] = mapped_column(default=0)


class DocumentRevision(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "document_revisions"
    __table_args__ = (UniqueConstraint("document_id", "revision_number"),)

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    document_id: Mapped[UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), index=True
    )
    revision_number: Mapped[int]
    storage_key: Mapped[str] = mapped_column(String(1024), unique=True)
    filename: Mapped[str] = mapped_column(String(255))
    media_type: Mapped[str] = mapped_column(String(255))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    sha256: Mapped[str] = mapped_column(String(64))
    created_by_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    revision_metadata: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)


class DocumentProvenance(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "document_provenance"
    __table_args__ = (UniqueConstraint("source_document_id", "target_document_id", "relation"),)

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    source_document_id: Mapped[UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), index=True
    )
    target_document_id: Mapped[UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), index=True
    )
    relation: Mapped[ProvenanceRelation] = mapped_column(
        Enum(
            ProvenanceRelation,
            native_enum=False,
            values_callable=lambda values: [v.value for v in values],
        )
    )
    provenance_metadata: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)


class EmbeddingProfile(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "embedding_profiles"
    __table_args__ = (UniqueConstraint("workspace_id", "name"),)

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(100))
    provider: Mapped[str] = mapped_column(String(80))
    model: Mapped[str] = mapped_column(String(200))
    dimensions: Mapped[int]
    is_active: Mapped[bool] = mapped_column(default=True)


class DocumentChunk(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "document_chunks"
    __table_args__ = (
        UniqueConstraint("document_revision_id", "embedding_profile_id", "chunk_index"),
    )

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    document_id: Mapped[UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), index=True
    )
    document_revision_id: Mapped[UUID] = mapped_column(
        ForeignKey("document_revisions.id", ondelete="CASCADE"), index=True
    )
    embedding_profile_id: Mapped[UUID] = mapped_column(
        ForeignKey("embedding_profiles.id", ondelete="CASCADE"), index=True
    )
    chunk_index: Mapped[int]
    content: Mapped[str] = mapped_column(Text)
    token_count: Mapped[int | None]
    embedding: Mapped[list[float]] = mapped_column(Vector(1536))
    search_vector: Mapped[object] = mapped_column(
        TSVECTOR,
        Computed("to_tsvector('simple', content)", persisted=True),
    )
    chunk_metadata: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
