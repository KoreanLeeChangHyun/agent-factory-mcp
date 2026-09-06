"""Document-only cloud metadata; register in shared model registry at integration."""
from uuid import UUID
from sqlalchemy import ForeignKey, ForeignKeyConstraint, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin

class DocumentImport(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "document_imports"
    __table_args__ = (
        UniqueConstraint("workspace_id", "idempotency_key"),
        ForeignKeyConstraint(["workspace_id", "document_id"], ["documents.workspace_id", "documents.id"], ondelete="CASCADE"),
    )
    workspace_id: Mapped[UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    idempotency_key: Mapped[str] = mapped_column(String(160))
    request_sha256: Mapped[str] = mapped_column(String(64))
    document_id: Mapped[UUID]
    revision_id: Mapped[UUID] = mapped_column(ForeignKey("document_revisions.id", ondelete="CASCADE"))
    revision_number: Mapped[int]

class DocumentText(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "document_texts"
    __table_args__ = (
        UniqueConstraint("revision_id", "chunk_index"),
        ForeignKeyConstraint(["workspace_id", "document_id"], ["documents.workspace_id", "documents.id"], ondelete="CASCADE"),
    )
    workspace_id: Mapped[UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    document_id: Mapped[UUID]
    revision_id: Mapped[UUID] = mapped_column(ForeignKey("document_revisions.id", ondelete="CASCADE"), index=True)
    chunk_index: Mapped[int]
    source_path: Mapped[str] = mapped_column(String(1024))
    content: Mapped[str] = mapped_column(Text)
