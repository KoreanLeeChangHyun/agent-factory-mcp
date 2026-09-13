from __future__ import annotations

from dataclasses import dataclass, field, replace
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from agent_factory_core.shared.errors import ApplicationError, ConflictError
from croniter import croniter


class JobStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    RETRY = "retry"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCEL_REQUESTED = "cancel_requested"
    CANCELLED = "cancelled"
    DEAD = "dead"


TASK_QUEUES = {
    "agent.run": "agents",
    "document.index": "documents",
    "integration.sync": "integrations",
    "webhook.process": "integrations",
    "system.noop": "default",
}


@dataclass(frozen=True, slots=True)
class Schedule:
    id: UUID
    organization_id: UUID
    workspace_id: UUID
    name: str
    task_type: str
    queue: str
    payload: dict[str, object]
    cron_expression: str | None
    interval_seconds: int | None
    timezone: str
    is_enabled: bool
    next_run_at: datetime
    last_run_at: datetime | None
    created_by_user_id: UUID
    execution_user_id: UUID | None
    revision: int = 1


@dataclass(frozen=True, slots=True)
class ScheduleDraft:
    name: str
    task_type: str
    queue: str
    payload: dict[str, object] = field(default_factory=dict)
    cron_expression: str | None = None
    interval_seconds: int | None = None
    timezone: str = "UTC"


@dataclass(frozen=True, slots=True)
class Job:
    id: UUID
    organization_id: UUID
    workspace_id: UUID
    requested_by_user_id: UUID
    task_type: str
    queue: str
    priority: int
    idempotency_key: str
    payload: dict[str, object]
    status: JobStatus = JobStatus.QUEUED
    schedule_id: UUID | None = None
    result: dict[str, object] | None = None
    attempt_count: int = 0
    max_attempts: int = 5
    next_attempt_at: datetime | None = None
    broker_task_id: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    dead_lettered_at: datetime | None = None
    error_code: str | None = None
    error_message: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    def request_cancel(self, now: datetime) -> Job:
        if self.status in {JobStatus.QUEUED, JobStatus.RETRY}:
            return replace(self, status=JobStatus.CANCELLED, finished_at=now)
        if self.status == JobStatus.RUNNING:
            return replace(self, status=JobStatus.CANCEL_REQUESTED)
        raise ConflictError("job_not_cancellable", "Job is not cancellable")


@dataclass(frozen=True, slots=True)
class JobEvent:
    id: UUID
    workspace_id: UUID
    job_id: UUID
    sequence: int
    event_type: str
    payload: dict[str, object]
    created_at: datetime


def calculate_next_run(
    now: datetime, cron_expression: str | None, interval_seconds: int | None, timezone: str
) -> datetime:
    if (cron_expression is None) == (interval_seconds is None):
        raise ApplicationError("invalid_schedule", "Exactly one schedule expression is required")
    if interval_seconds is not None:
        if interval_seconds < 60:
            raise ApplicationError("invalid_interval", "Minimum interval is 60 seconds")
        return now + timedelta(seconds=interval_seconds)
    try:
        zone = ZoneInfo(timezone)
    except ZoneInfoNotFoundError as error:
        raise ApplicationError("invalid_timezone", "Unknown schedule timezone") from error
    if not croniter.is_valid(cron_expression):
        raise ApplicationError("invalid_cron", "Invalid five-field cron expression")
    if len(cron_expression.split()) != 5:
        raise ApplicationError("invalid_cron", "A five-field cron expression is required")
    return croniter(cron_expression, now.astimezone(zone)).get_next(datetime).astimezone(UTC)


def validate_task_queue(task_type: str, queue: str) -> None:
    expected = TASK_QUEUES.get(task_type)
    if expected is None:
        raise ApplicationError("unsupported_task_type", "Unsupported job task type")
    if queue != expected:
        raise ApplicationError(
            "invalid_task_queue", f"Task type {task_type} must use the {expected} queue"
        )


def retry_delay(attempt: int, base_seconds: int, maximum_seconds: int) -> int:
    return min(base_seconds * 2 ** max(attempt - 1, 0), maximum_seconds)


def new_job(
    *,
    organization_id: UUID,
    workspace_id: UUID,
    user_id: UUID,
    task_type: str,
    queue: str,
    payload: dict[str, object],
    idempotency_key: str,
    priority: int,
    max_attempts: int,
    schedule_id: UUID | None = None,
) -> Job:
    validate_task_queue(task_type, queue)
    if not 0 <= priority <= 9:
        raise ApplicationError("invalid_priority", "Job priority must be between 0 and 9")
    return Job(
        uuid4(),
        organization_id,
        workspace_id,
        user_id,
        task_type,
        queue,
        priority,
        idempotency_key,
        dict(payload),
        max_attempts=max_attempts,
        schedule_id=schedule_id,
    )
