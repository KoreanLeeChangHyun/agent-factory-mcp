"""Domains, features and implementation issues, distinct from execution schedules."""

from datetime import date
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, RevisionMixin, TimestampMixin, UUIDPrimaryKeyMixin


class PlanItem(UUIDPrimaryKeyMixin, TimestampMixin, RevisionMixin, Base):
    __tablename__ = "plan_items"
    __table_args__ = (
        UniqueConstraint("workspace_id", "id"),
        ForeignKeyConstraint(
            ["workspace_id", "parent_id"],
            ["plan_items.workspace_id", "plan_items.id"],
            ondelete="RESTRICT",
        ),
        CheckConstraint("kind IN ('domain', 'feature', 'issue')", name="plan_kind"),
        CheckConstraint("status IN ('pending', 'active', 'done')", name="plan_status"),
        CheckConstraint(
            "(kind = 'domain' AND parent_id IS NULL) OR "
            "(kind <> 'domain' AND parent_id IS NOT NULL)",
            name="plan_parent",
        ),
        CheckConstraint(
            "start_date IS NULL OR target_date IS NULL OR start_date <= target_date",
            name="plan_dates",
        ),
    )

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    parent_id: Mapped[UUID | None] = mapped_column(index=True)
    kind: Mapped[str] = mapped_column(String(12))
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    acceptance: Mapped[str] = mapped_column(Text, default="")
    assignee: Mapped[str] = mapped_column(String(160), default="")
    status: Mapped[str] = mapped_column(String(12), default="pending")
    blocked_reason: Mapped[str] = mapped_column(Text, default="")
    start_date: Mapped[date | None]
    target_date: Mapped[date | None]


class PlanSettings(TimestampMixin, RevisionMixin, Base):
    __tablename__ = "plan_settings"

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), primary_key=True
    )
    launch_date: Mapped[date | None]
