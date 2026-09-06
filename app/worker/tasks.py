"""Celery tasks backed by transactionally managed Job records."""

import asyncio
import math
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
from app.worker.integration_handlers import integration_sync
from app.worker.authority import (authorize_job, cancellation_probe, control_scope, job_guard, reconcile_collection)
from app.modules.integration.cloud_http import ProviderError
from sqlalchemy import select
from app.common.errors import ApplicationError

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
    # Legacy queue identity arguments are retained for transport compatibility only.
    del organization_id, workspace_id, user_id
    async with get_session_factory()() as lookup:
        async with job_guard(lookup.bind, job_id) as acquired:
            if not acquired:
                return "ignored"
            await control_scope(lookup)
            job = await lookup.scalar(select(Job).where(Job.id == job_id))
            if job is None:
                return "missing"
            identity = (job.organization_id, job.workspace_id, job.requested_by_user_id)
            await lookup.rollback()
            return await _execute_claimed(job_id, *identity)


async def _execute_claimed(job_id, organization_id, workspace_id, user_id):
    publisher = CeleryJobPublisher()
    async with get_session_factory()() as session:
        await control_scope(session)
        repository = ScheduleRepository(session)
        current = await repository.get_job(workspace_id, job_id, lock=True)
        if current is None:
            return "missing"
        # Owning the process-lifetime advisory claim proves no live worker holds it.
        if current.status == JobStatus.CANCEL_REQUESTED:
            current.status, current.finished_at = JobStatus.CANCELLED, datetime.now(UTC)
            await reconcile_collection(session, current)
            await repository.append_event(current, "job.cancelled", {})
            await repository.commit()
            return "cancelled"
        if current.status == JobStatus.RUNNING:
            current.status = JobStatus.RETRY
            current.next_attempt_at = datetime.now(UTC)
            await repository.append_event(current, "job.recovered", {})
        if current.status == JobStatus.CANCELLED:
            await reconcile_collection(session, current)
            await repository.commit()
            return "cancelled"
        job = await repository.claim_job(workspace_id, job_id)
        if job is None:
            return "ignored"
        await repository.commit()
        try:
            if job.attempt_count > job.max_attempts:
                raise PermanentJobError("job_attempts_exhausted")
            if job.task_type == "integration.sync":
                context = await authorize_job(session, job)
                async def cancelled():
                    return await cancellation_probe(job_id, organization_id, workspace_id, user_id)
                # A separate session keeps domain transaction hooks out of job finalization.
                async with get_session_factory()() as domain_session:
                    result = await integration_sync(job.payload, session=domain_session,
                        context=context, job_id=job.id, cancelled=cancelled)
            else:
                await authorize_job(session, job)
                handler = get_job_handler(job.task_type)
                if handler is None:
                    raise PermanentJobError("unsupported_job_type")
                result = await handler(job.payload)
        except Exception as exc:  # durable boundary; never retain provider bodies or secrets
            await session.rollback()
            await control_scope(session)
            session.expire_all()
            current = await repository.get_job(workspace_id, job_id, lock=True)
            if current is None:
                return "missing"
            if current.status in {JobStatus.CANCEL_REQUESTED, JobStatus.CANCELLED}:
                current.status, current.finished_at = JobStatus.CANCELLED, datetime.now(UTC)
                await repository.append_event(current, "job.cancelled", {})
            else:
                current.error_code = (exc.code if isinstance(exc, ProviderError) else
                                      "job_authorization_denied" if isinstance(exc, ApplicationError) else
                                      "job_permanent_failure" if isinstance(exc, PermanentJobError) else "job_execution_failed")
                current.error_message = current.error_code
                if isinstance(exc, (PermanentJobError, ApplicationError)) or (isinstance(exc, ProviderError) and not exc.retryable):
                    current.status, current.finished_at = JobStatus.FAILED, datetime.now(UTC)
                elif current.attempt_count >= current.max_attempts:
                    current.status = JobStatus.DEAD
                    current.dead_lettered_at = current.finished_at = datetime.now(UTC)
                else:
                    delay = retry_delay(current.attempt_count, settings.job_retry_base_seconds, settings.job_retry_max_seconds)
                    if isinstance(exc, ProviderError) and math.isfinite(exc.retry_after or 0):
                        delay = max(delay, exc.retry_after or 0)
                    current.status = JobStatus.RETRY
                    current.next_attempt_at = datetime.now(UTC) + timedelta(seconds=delay)
                await repository.append_event(current, "job." + current.status.value, {})
            await reconcile_collection(session, current)
            await repository.commit()
            if current.status == JobStatus.RETRY:
                await control_scope(session)
                current.celery_task_id = publisher.publish(current, countdown=delay)
                await repository.commit()
            return current.status.value

        await session.rollback()
        await control_scope(session)
        session.expire_all()
        current = await repository.get_job(workspace_id, job_id, lock=True)
        if current is None:
            return "missing"
        if current.status in {JobStatus.CANCEL_REQUESTED, JobStatus.CANCELLED} or (
            current.task_type == "integration.sync" and result.get("status") == "cancelled"
        ):
            current.status = JobStatus.CANCELLED
        else:
            current.status = JobStatus.SUCCEEDED
            current.result = result
        current.finished_at = datetime.now(UTC)
        await reconcile_collection(session, current)
        await repository.append_event(current, "job." + current.status.value, {})
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
                requested_by_user_id=schedule.execution_user_id or schedule.created_by_user_id,
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
        await control_scope(session)
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
        now = datetime.now(UTC)
        jobs = await repository.due_retry_jobs(now)
        # Dispatch only; execute_job acquires the lifetime claim before recovering.
        jobs += await repository.recoverable_jobs(
            now - timedelta(seconds=settings.worker_time_limit_seconds))
        for job in jobs:
            job.celery_task_id = publisher.publish(job)
        await repository.commit()
        return len(jobs)
