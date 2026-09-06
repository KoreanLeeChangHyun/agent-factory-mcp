"""Durable schedules, jobs, and lifecycle events."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, RevisionMixin, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class JobStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    RETRY = "retry"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCEL_REQUESTED = "cancel_requested"
    CANCELLED = "cancelled"
    DEAD = "dead"


class Schedule(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, RevisionMixin, Base):
    __tablename__ = "schedules"
    __table_args__ = (UniqueConstraint("workspace_id", "name"),)

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(160))
    task_type: Mapped[str] = mapped_column(String(120), index=True)
    queue: Mapped[str] = mapped_column(String(80), default="default")
    cron_expression: Mapped[str | None] = mapped_column(String(120))
    interval_seconds: Mapped[int | None]
    timezone: Mapped[str] = mapped_column(String(80), default="UTC")
    payload: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    is_enabled: Mapped[bool] = mapped_column(default=True)
    next_run_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    execution_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT")
    )


class Job(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "jobs"
    __table_args__ = (UniqueConstraint("workspace_id", "idempotency_key"),)

    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    schedule_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("schedules.id", ondelete="SET NULL")
    )
    requested_by_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    task_type: Mapped[str] = mapped_column(String(120), index=True)
    queue: Mapped[str] = mapped_column(String(80))
    status: Mapped[JobStatus] = mapped_column(
        Enum(
            JobStatus, native_enum=False, values_callable=lambda values: [v.value for v in values]
        ),
        default=JobStatus.QUEUED,
        index=True,
    )
    priority: Mapped[int] = mapped_column(default=5)
    idempotency_key: Mapped[str] = mapped_column(String(200))
    payload: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    result: Mapped[dict[str, object] | None] = mapped_column(JSON)
    attempt_count: Mapped[int] = mapped_column(default=0)
    max_attempts: Mapped[int] = mapped_column(default=5)
    next_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    celery_task_id: Mapped[str | None] = mapped_column(String(255))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    dead_lettered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error_code: Mapped[str | None] = mapped_column(String(120))
    error_message: Mapped[str | None] = mapped_column(Text)


class JobEvent(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "job_events"
    __table_args__ = (UniqueConstraint("job_id", "sequence"),)

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    job_id: Mapped[UUID] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), index=True)
    sequence: Mapped[int]
    event_type: Mapped[str] = mapped_column(String(120))
    payload: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
