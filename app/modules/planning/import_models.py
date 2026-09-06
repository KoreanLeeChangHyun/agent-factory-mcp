"""Durable import previews and source identities for repeatable ingestion."""

from uuid import UUID

from sqlalchemy import ForeignKey, ForeignKeyConstraint, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class PlanImport(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "plan_imports"
    __table_args__ = (UniqueConstraint("workspace_id", "request_key"),)

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    request_key: Mapped[str] = mapped_column(String(160))
    proposal: Mapped[dict] = mapped_column(JSONB)
    preview: Mapped[dict] = mapped_column(JSONB)
    baseline: Mapped[str] = mapped_column(String(64))
    digest: Mapped[str] = mapped_column(String(64))
    result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)


class PlanSourceLink(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "plan_source_links"
    __table_args__ = (
        UniqueConstraint("workspace_id", "provider", "source", "source_id"),
        ForeignKeyConstraint(
            ["workspace_id", "item_id"],
            ["plan_items.workspace_id", "plan_items.id"],
            ondelete="CASCADE",
        ),
    )

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    provider: Mapped[str] = mapped_column(String(30))
    source: Mapped[str] = mapped_column(String(500))
    source_id: Mapped[str] = mapped_column(String(500))
    item_id: Mapped[UUID]
