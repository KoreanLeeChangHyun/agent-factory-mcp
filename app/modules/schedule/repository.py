"""Durable schedule and job persistence operations."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.schedule.models import Job, JobEvent, JobStatus, Schedule


class ScheduleRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_schedules(self, workspace_id: UUID) -> list[Schedule]:
        return list(
            await self.session.scalars(
                select(Schedule)
                .where(Schedule.workspace_id == workspace_id, Schedule.deleted_at.is_(None))
                .order_by(Schedule.name)
            )
        )

    async def create_schedule(self, schedule: Schedule) -> None:
        self.session.add(schedule)
        await self.session.flush()

    async def due_schedules(self, now: datetime, limit: int = 100) -> list[Schedule]:
        return list(
            await self.session.scalars(
                select(Schedule)
                .where(
                    Schedule.is_enabled.is_(True),
                    Schedule.deleted_at.is_(None),
                    Schedule.next_run_at <= now,
                )
                .order_by(Schedule.next_run_at)
                .with_for_update(skip_locked=True)
                .limit(limit)
            )
        )

    async def find_job(self, workspace_id: UUID, idempotency_key: str) -> Job | None:
        return await self.session.scalar(
            select(Job).where(
                Job.workspace_id == workspace_id, Job.idempotency_key == idempotency_key
            )
        )

    async def create_job(self, job: Job) -> None:
        self.session.add(job)
        await self.session.flush()
        await self.append_event(job, "job.queued", {})

    async def list_jobs(self, workspace_id: UUID, limit: int = 100) -> list[Job]:
        return list(
            await self.session.scalars(
                select(Job)
                .where(Job.workspace_id == workspace_id)
                .order_by(Job.created_at.desc())
                .limit(limit)
            )
        )

    async def get_job(self, workspace_id: UUID, job_id: UUID, *, lock: bool = False) -> Job | None:
        statement = select(Job).where(Job.id == job_id, Job.workspace_id == workspace_id)
        if lock:
            statement = statement.with_for_update()
        return await self.session.scalar(statement)

    async def claim_job(self, workspace_id: UUID, job_id: UUID) -> Job | None:
        job = await self.get_job(workspace_id, job_id, lock=True)
        now = datetime.now(UTC)
        if job is None or job.status not in {JobStatus.QUEUED, JobStatus.RETRY}:
            return None
        if job.next_attempt_at is not None and job.next_attempt_at > now:
            return None
        job.status = JobStatus.RUNNING
        job.started_at = now
        job.attempt_count += 1
        await self.append_event(job, "job.running", {"attempt": job.attempt_count})
        return job

    async def due_retry_jobs(self, now: datetime, limit: int = 100) -> list[Job]:
        return list(
            await self.session.scalars(
                select(Job)
                .where(
                    or_(
                        (Job.status == JobStatus.RETRY) & (Job.next_attempt_at <= now),
                        (Job.status == JobStatus.QUEUED) & (Job.celery_task_id.is_(None)),
                    )
                )
                .order_by(Job.next_attempt_at)
                .with_for_update(skip_locked=True)
                .limit(limit)
            )
        )

    async def append_event(self, job: Job, event_type: str, payload: dict[str, object]) -> JobEvent:
        current = await self.session.scalar(
            select(func.coalesce(func.max(JobEvent.sequence), 0)).where(JobEvent.job_id == job.id)
        )
        event = JobEvent(
            workspace_id=job.workspace_id,
            job_id=job.id,
            sequence=int(current or 0) + 1,
            event_type=event_type,
            payload=payload,
        )
        self.session.add(event)
        await self.session.flush()
        return event

    async def list_events(self, workspace_id: UUID, job_id: UUID) -> list[JobEvent]:
        return list(
            await self.session.scalars(
                select(JobEvent)
                .where(JobEvent.workspace_id == workspace_id, JobEvent.job_id == job_id)
                .order_by(JobEvent.sequence)
            )
        )

    async def recoverable_jobs(self, before: datetime, limit: int = 100) -> list[Job]:
        return list(
            await self.session.scalars(
                select(Job)
                .where(
                    or_(
                        (Job.status == JobStatus.RUNNING) & (Job.started_at < before),
                        (Job.status == JobStatus.CANCEL_REQUESTED) & (Job.started_at < before),
                    )
                )
                .with_for_update(skip_locked=True)
                .limit(limit)
            )
        )

    async def commit(self) -> None:
        await self.session.commit()

    async def rollback(self) -> None:
        await self.session.rollback()
