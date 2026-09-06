"""Durable single-target upload intent; never stores a plaintext capability."""
from datetime import datetime
from uuid import UUID
from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin

class DocumentUpload(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "document_uploads"
    __table_args__ = (UniqueConstraint("workspace_id", "idempotency_key"),)
    workspace_id: Mapped[UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[UUID]
    idempotency_key: Mapped[str] = mapped_column(String(160))
    request_sha256: Mapped[str] = mapped_column(String(64))
    capability_sha256: Mapped[str] = mapped_column(String(64))
    metadata_payload: Mapped[dict] = mapped_column(JSONB)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    uploaded: Mapped[bool] = mapped_column(default=False)
    finalized: Mapped[bool] = mapped_column(default=False)
