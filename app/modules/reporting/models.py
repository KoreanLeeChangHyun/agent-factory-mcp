"""Durable external configuration, task state and append-only reports."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, RevisionMixin, TimestampMixin, UUIDPrimaryKeyMixin


class ReportAgent(UUIDPrimaryKeyMixin, TimestampMixin, RevisionMixin, Base):
    __tablename__ = "report_agents"
    __table_args__ = (
        UniqueConstraint("workspace_id", "id"),
        ForeignKeyConstraint(
            ["workspace_id", "parent_id"], ["report_agents.workspace_id", "report_agents.id"]
        ),
        CheckConstraint("parent_id IS NULL OR parent_id <> id", name="report_agent_self_parent"),
    )
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    owner_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    parent_id: Mapped[UUID | None]
    name: Mapped[str] = mapped_column(String(160))
    role: Mapped[str] = mapped_column(String(160))
    responsibilities: Mapped[str] = mapped_column(Text)
    last_report_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ReportTask(UUIDPrimaryKeyMixin, TimestampMixin, RevisionMixin, Base):
    __tablename__ = "report_tasks"
    __table_args__ = (
        UniqueConstraint("workspace_id", "id"),
        ForeignKeyConstraint(
            ["workspace_id", "agent_id"], ["report_agents.workspace_id", "report_agents.id"]
        ),
        ForeignKeyConstraint(
            ["workspace_id", "parent_id"], ["report_tasks.workspace_id", "report_tasks.id"]
        ),
        ForeignKeyConstraint(
            ["workspace_id", "plan_item_id"], ["plan_items.workspace_id", "plan_items.id"]
        ),
        CheckConstraint(
            "status IN ('pending','in_progress','input_required','completed','failed','cancelled')",
            name="report_task_status",
        ),
        CheckConstraint(
            "progress IS NULL OR (progress >= 0 AND progress <= 100)", name="report_progress"
        ),
        CheckConstraint("parent_id IS NULL OR parent_id <> id", name="report_task_self_parent"),
    )
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    agent_id: Mapped[UUID]
    parent_id: Mapped[UUID | None]
    plan_item_id: Mapped[UUID | None]
    runtime_binding: Mapped[dict | None] = mapped_column(JSON(none_as_null=True))
    runtime_observation: Mapped[dict | None] = mapped_column(JSON(none_as_null=True))
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    progress: Mapped[int | None]
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_report_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class TaskReport(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "task_reports"
    __table_args__ = (
        UniqueConstraint("workspace_id", "id"),
        UniqueConstraint(
            "workspace_id", "task_id", "revision", name="uq_task_reports_task_revision"
        ),
        ForeignKeyConstraint(
            ["workspace_id", "audit_event_id"], ["audit_events.workspace_id", "audit_events.id"]
        ),
        ForeignKeyConstraint(
            ["workspace_id", "task_id"], ["report_tasks.workspace_id", "report_tasks.id"]
        ),
    )
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    task_id: Mapped[UUID]
    revision: Mapped[int]
    reporter_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    connection_id: Mapped[UUID | None]  # Historical identity survives credential revocation.
    audit_event_id: Mapped[UUID]
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20))
    progress: Mapped[int | None]
    message: Mapped[str] = mapped_column(Text)


class ReportResult(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "report_results"
    __table_args__ = (
        ForeignKeyConstraint(
            ["workspace_id", "report_id"], ["task_reports.workspace_id", "task_reports.id"]
        ),
        ForeignKeyConstraint(
            ["workspace_id", "document_id"], ["documents.workspace_id", "documents.id"]
        ),
    )
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    report_id: Mapped[UUID]
    label: Mapped[str] = mapped_column(String(200))
    summary: Mapped[str] = mapped_column(Text)
    document_id: Mapped[UUID | None]
    url: Mapped[str | None] = mapped_column(String(2048))


class ReportReceipt(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "report_receipts"
    __table_args__ = (UniqueConstraint("workspace_id", "reporter_user_id", "key"),)
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    reporter_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    key: Mapped[str] = mapped_column(String(120))
    payload_hash: Mapped[str] = mapped_column(String(64))
    response: Mapped[dict] = mapped_column(JSON)
