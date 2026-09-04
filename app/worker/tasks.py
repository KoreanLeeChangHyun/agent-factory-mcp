"""Celery tasks backed by transactionally managed Job records."""

import asyncio
from collections.abc import Awaitable
from datetime import UTC, datetime, timedelta
from uuid import UUID

from app.core.config import settings
from app.db.session import dispose_engine, get_session_factory
from app.db.tenant import TenantContext, apply_tenant_context
from app.infrastructure.job_queue import CeleryJobPublisher
from app.modules.schedule.models import Job, JobStatus
from app.modules.schedule.repository import ScheduleRepository
from app.modules.schedule.service import calculate_next_run, retry_delay
from app.worker.celery_app import celery_app
from app.worker.handlers import PermanentJobError, get_job_handler

SYSTEM_USER_ID = UUID("00000000-0000-4000-8000-000000000000")
SYSTEM_ORGANIZATION_ID = UUID("00000000-0000-4000-8000-000000000000")


def _run_task[Result](awaitable: Awaitable[Result]) -> Result:
    async def run_and_dispose() -> Result:
        try:
            return await awaitable
        finally:
            await dispose_engine()

    return asyncio.run(run_and_dispose())


@celery_app.task(name="agent_factory.execute_job")
def execute_job(job_id: str, organization_id: str, workspace_id: str, user_id: str) -> str:
    return _run_task(
        _execute_job(UUID(job_id), UUID(organization_id), UUID(workspace_id), UUID(user_id))
    )


async def _execute_job(
    job_id: UUID, organization_id: UUID, workspace_id: UUID, user_id: UUID
) -> str:
    publisher = CeleryJobPublisher()
    async with get_session_factory()() as session:
        await apply_tenant_context(session, TenantContext(user_id, organization_id, workspace_id))
        repository = ScheduleRepository(session)
        job = await repository.claim_job(workspace_id, job_id)
        if job is None:
            return "ignored"
        await repository.commit()
        handler = get_job_handler(job.task_type)
        try:
            if handler is None:
                raise PermanentJobError(f"unsupported job type: {job.task_type}")
            result = await handler(job.payload)
        except Exception as exc:  # noqa: BLE001 - durable job boundary records all failures
            await apply_tenant_context(
                session, TenantContext(user_id, organization_id, workspace_id)
            )
            session.expire_all()
            current = await repository.get_job(workspace_id, job_id, lock=True)
            if current is None:
                return "missing"
            current.error_code = type(exc).__name__
            current.error_message = str(exc)[:4000]
            if isinstance(exc, PermanentJobError):
                current.status = JobStatus.FAILED
                current.finished_at = datetime.now(UTC)
                await repository.append_event(current, "job.failed", {})
            elif current.attempt_count >= current.max_attempts:
                current.status = JobStatus.DEAD
                current.dead_lettered_at = datetime.now(UTC)
                current.finished_at = current.dead_lettered_at
                await repository.append_event(current, "job.dead", {})
            else:
                delay = retry_delay(
                    current.attempt_count,
                    settings.job_retry_base_seconds,
                    settings.job_retry_max_seconds,
                )
                current.status = JobStatus.RETRY
                current.next_attempt_at = datetime.now(UTC).replace(microsecond=0)
                current.next_attempt_at += timedelta(seconds=delay)
                await repository.append_event(current, "job.retry", {"delay_seconds": delay})
            await repository.commit()
            if current.status == JobStatus.RETRY:
                current.celery_task_id = publisher.publish(current, countdown=delay)
                await repository.commit()
            return current.status.value

        await apply_tenant_context(session, TenantContext(user_id, organization_id, workspace_id))
        session.expire_all()
        current = await repository.get_job(workspace_id, job_id, lock=True)
        if current is None:
            return "missing"
        if current.status == JobStatus.CANCEL_REQUESTED:
            current.status = JobStatus.CANCELLED
            event = "job.cancelled"
        else:
            current.status = JobStatus.SUCCEEDED
            current.result = result
            event = "job.succeeded"
        current.finished_at = datetime.now(UTC)
        await repository.append_event(current, event, {})
        await repository.commit()
        return current.status.value


@celery_app.task(name="agent_factory.dispatch_due_schedules")
def dispatch_due_schedules() -> int:
    return _run_task(_dispatch_due_schedules())


async def _dispatch_due_schedules() -> int:
    publisher = CeleryJobPublisher()
    now = datetime.now(UTC)
    created: list[Job] = []
    async with get_session_factory()() as session:
        await apply_tenant_context(
            session,
            TenantContext(SYSTEM_USER_ID, SYSTEM_ORGANIZATION_ID, None, is_platform_admin=True),
        )
        repository = ScheduleRepository(session)
        for schedule in await repository.due_schedules(now):
            scheduled_for = schedule.next_run_at
            job = Job(
                organization_id=schedule.organization_id,
                workspace_id=schedule.workspace_id,
                schedule_id=schedule.id,
                requested_by_user_id=schedule.created_by_user_id,
                task_type=schedule.task_type,
                queue=schedule.queue,
                priority=5,
                idempotency_key=f"schedule:{schedule.id}:{scheduled_for.isoformat()}",
                payload=schedule.payload,
                max_attempts=settings.job_max_attempts,
            )
            await repository.create_job(job)
            schedule.last_run_at = scheduled_for
            schedule.next_run_at = calculate_next_run(
                scheduled_for,
                schedule.cron_expression,
                schedule.interval_seconds,
                schedule.timezone,
            )
            created.append(job)
        await repository.commit()
        for job in created:
            job.celery_task_id = publisher.publish(job)
        await repository.commit()
    return len(created)


@celery_app.task(name="agent_factory.dispatch_due_retries")
def dispatch_due_retries() -> int:
    return _run_task(_dispatch_due_retries())


async def _dispatch_due_retries() -> int:
    publisher = CeleryJobPublisher()
    async with get_session_factory()() as session:
        await apply_tenant_context(
            session,
            TenantContext(SYSTEM_USER_ID, SYSTEM_ORGANIZATION_ID, None, is_platform_admin=True),
        )
        repository = ScheduleRepository(session)
        jobs = await repository.due_retry_jobs(datetime.now(UTC))
        for job in jobs:
            job.celery_task_id = publisher.publish(job)
        await repository.commit()
        return len(jobs)
