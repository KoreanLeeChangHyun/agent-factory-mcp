"""Schedule calculation and durable job lifecycle."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Protocol
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from croniter import croniter
from sqlalchemy.exc import IntegrityError

from app.common.errors import ApplicationError, ConflictError, NotFoundError
from app.core.config import Settings
from app.modules.auth.authorization import AuthorizedContext
from app.modules.schedule.models import Job, JobStatus, Schedule
from app.modules.schedule.repository import ScheduleRepository

TASK_QUEUES = {
    "agent.run": "agents",
    "document.index": "documents",
    "integration.sync": "integrations",
    "webhook.process": "integrations",
    "system.noop": "default",
}


class JobPublisher(Protocol):
    def publish(self, job: Job, *, countdown: int = 0) -> str: ...


class ScheduleService:
    def __init__(
        self, repository: ScheduleRepository, publisher: JobPublisher, settings: Settings
    ) -> None:
        self.repository = repository
        self.publisher = publisher
        self.settings = settings

    async def list_schedules(self, context: AuthorizedContext) -> list[Schedule]:
        return await self.repository.list_schedules(_workspace_id(context))

    async def create_schedule(
        self,
        context: AuthorizedContext,
        name: str,
        task_type: str,
        queue: str,
        payload: dict[str, object],
        cron_expression: str | None,
        interval_seconds: int | None,
        timezone: str,
    ) -> Schedule:
        validate_task_queue(task_type, queue)
        now = datetime.now(UTC)
        next_run = calculate_next_run(now, cron_expression, interval_seconds, timezone)
        record = Schedule(
            organization_id=context.scope.organization_id,
            workspace_id=_workspace_id(context),
            name=name.strip(),
            task_type=task_type,
            queue=queue,
            payload=payload,
            cron_expression=cron_expression,
            interval_seconds=interval_seconds,
            timezone=timezone,
            next_run_at=next_run,
            created_by_user_id=context.principal.user_id,
        )
        try:
            await self.repository.create_schedule(record)
            await self.repository.commit()
            return record
        except IntegrityError as exc:
            await self.repository.rollback()
            raise ConflictError("schedule_exists", "Schedule name already exists") from exc

    async def enqueue(
        self,
        context: AuthorizedContext,
        task_type: str,
        queue: str,
        payload: dict[str, object],
        idempotency_key: str,
        priority: int = 5,
    ) -> Job:
        validate_task_queue(task_type, queue)
        workspace_id = _workspace_id(context)
        existing = await self.repository.find_job(workspace_id, idempotency_key)
        if existing is not None:
            return existing
        job = Job(
            organization_id=context.scope.organization_id,
            workspace_id=workspace_id,
            requested_by_user_id=context.principal.user_id,
            task_type=task_type,
            queue=queue,
            priority=priority,
            idempotency_key=idempotency_key,
            payload=payload,
            max_attempts=self.settings.job_max_attempts,
        )
        try:
            await self.repository.create_job(job)
            await self.repository.commit()
        except IntegrityError:
            await self.repository.rollback()
            existing = await self.repository.find_job(workspace_id, idempotency_key)
            if existing is None:
                raise
            return existing
        job.celery_task_id = self.publisher.publish(job)
        await self.repository.commit()
        return job

    async def list_jobs(self, context: AuthorizedContext) -> list[Job]:
        return await self.repository.list_jobs(_workspace_id(context))

    async def get_job(self, context: AuthorizedContext, job_id: UUID) -> Job:
        job = await self.repository.get_job(_workspace_id(context), job_id)
        if job is None:
            raise NotFoundError("job_not_found", "Job not found")
        return job

    async def cancel(self, context: AuthorizedContext, job_id: UUID) -> Job:
        job = await self.get_job(context, job_id)
        if job.status in {JobStatus.QUEUED, JobStatus.RETRY}:
            job.status = JobStatus.CANCELLED
            job.finished_at = datetime.now(UTC)
            await self.repository.append_event(job, "job.cancelled", {})
        elif job.status == JobStatus.RUNNING:
            job.status = JobStatus.CANCEL_REQUESTED
            await self.repository.append_event(job, "job.cancel_requested", {})
        else:
            raise ConflictError("job_not_cancellable", "Job is not cancellable")
        await self.repository.commit()
        return job

    async def retry(self, context: AuthorizedContext, job_id: UUID) -> Job:
        original = await self.get_job(context, job_id)
        if original.status not in {JobStatus.FAILED, JobStatus.DEAD, JobStatus.CANCELLED}:
            raise ConflictError("job_not_retryable", "Job is not retryable")
        return await self.enqueue(
            context,
            original.task_type,
            original.queue,
            original.payload,
            f"manual-retry:{original.id}:{uuid4().hex}",
            original.priority,
        )


def calculate_next_run(
    now: datetime,
    cron_expression: str | None,
    interval_seconds: int | None,
    timezone: str,
) -> datetime:
    if (cron_expression is None) == (interval_seconds is None):
        raise ApplicationError(
            "invalid_schedule", "Exactly one schedule expression is required", 400
        )
    if interval_seconds is not None:
        if interval_seconds < 60:
            raise ApplicationError("invalid_interval", "Minimum interval is 60 seconds", 400)
        return now + timedelta(seconds=interval_seconds)
    try:
        zone = ZoneInfo(timezone)
    except ZoneInfoNotFoundError as exc:
        raise ApplicationError("invalid_timezone", "Unknown schedule timezone", 400) from exc
    if not croniter.is_valid(cron_expression):
        raise ApplicationError("invalid_cron", "Invalid cron expression", 400)
    local_now = now.astimezone(zone)
    return croniter(cron_expression, local_now).get_next(datetime).astimezone(UTC)


def retry_delay(attempt: int, base_seconds: int, maximum_seconds: int) -> int:
    return min(base_seconds * (2 ** max(attempt - 1, 0)), maximum_seconds)


def validate_task_queue(task_type: str, queue: str) -> None:
    expected = TASK_QUEUES.get(task_type)
    if expected is None:
        raise ApplicationError("unsupported_task_type", "Unsupported job task type", 400)
    if queue != expected:
        raise ApplicationError(
            "invalid_task_queue", f"Task type {task_type} must use the {expected} queue", 400
        )


def _workspace_id(context: AuthorizedContext) -> UUID:
    if context.scope.workspace_id is None:
        raise ApplicationError("workspace_scope_required", "Workspace scope is required", 400)
    return context.scope.workspace_id
