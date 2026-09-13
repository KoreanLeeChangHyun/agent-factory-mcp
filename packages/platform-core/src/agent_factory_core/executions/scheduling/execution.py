from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime, timedelta
from uuid import UUID

from agent_factory_core.executions.scheduling.domain import (
    Job,
    JobStatus,
    retry_delay,
)
from agent_factory_core.identity.authorization import AuthorizedContext
from agent_factory_core.shared.errors import PermissionDeniedError

from .ports import (
    ExecutionAuthorizer,
    ExecutionLease,
    ExecutionLeaseFactory,
    Handler,
    JobLifecycle,
    JobPublisher,
    SchedulingRepository,
)


class ExecuteJob:
    def __init__(
        self,
        leases: ExecutionLeaseFactory,
        handlers: dict[str, Handler],
        authorizer: ExecutionAuthorizer,
        lifecycle: JobLifecycle | None = None,
        *,
        retry_publisher: JobPublisher | None = None,
        retry_base_seconds: int = 30,
        retry_max_seconds: int = 3600,
    ) -> None:
        self.leases = leases
        self.handlers = handlers
        self.authorizer = authorizer
        self.lifecycle = lifecycle
        self.retry_publisher = retry_publisher
        self.retry_base_seconds = retry_base_seconds
        self.retry_max_seconds = retry_max_seconds

    async def execute(self, job_id: UUID) -> Job | None:
        lease_context = await self.leases.acquire(job_id)
        if lease_context is None:
            return None
        async with lease_context as lease:
            job = lease.job
            if job.status == JobStatus.CANCELLED:
                return job
            if job.status in {JobStatus.SUCCEEDED, JobStatus.FAILED, JobStatus.DEAD}:
                return None
            try:
                context = await self.authorizer.authorize(job)
            except PermissionDeniedError as error:
                await lease.establish_durable_identity()
                return await self._authorization_denied(lease.repository, job, error)
            await lease.establish(context)
            repository = lease.repository
            current = await repository.get_job(job.workspace_id, job_id, lock=True)
            if current is None:
                return None
            if current.status == JobStatus.CANCEL_REQUESTED:
                return await self._finish_cancel(repository, current)
            if current.status not in {JobStatus.QUEUED, JobStatus.RETRY, JobStatus.RUNNING}:
                return None
            now = datetime.now(UTC)
            if (
                current.status == JobStatus.RETRY
                and current.next_attempt_at
                and current.next_attempt_at > now
            ):
                return None
            running = current
            if current.status != JobStatus.RUNNING:
                running = await repository.replace_job(
                    replace(
                        current,
                        status=JobStatus.RUNNING,
                        started_at=now,
                        attempt_count=current.attempt_count + 1,
                    )
                )
                await repository.append_event(
                    running, "job.running", {"attempt": running.attempt_count}
                )
            # The advisory execution lease remains held across handler work; end
            # the row-lock transaction for both new and recovered RUNNING Jobs.
            await repository.commit()
            handler = self.handlers.get(running.task_type)
            if handler is None:
                await lease.establish(context)
                return await self._fail(
                    repository,
                    running,
                    "unsupported_task_type",
                    "No handler is registered",
                    retryable=False,
                )
            try:
                result = await handler(
                    running,
                    context,
                    lambda: self._cancel_requested(lease, running),
                )
            except Exception as error:  # noqa: BLE001 -- handler failures enter durable retry policy.
                try:
                    context = await self.authorizer.authorize(running)
                except PermissionDeniedError as authorization_error:
                    await lease.establish_durable_identity()
                    return await self._authorization_denied(
                        repository, running, authorization_error
                    )
                await lease.establish(context)
                return await self._fail(
                    repository,
                    running,
                    str(getattr(error, "code", None) or str(error) or type(error).__name__),
                    str(error),
                    retryable=bool(getattr(error, "retryable", True)),
                    retry_after=getattr(error, "retry_after", None),
                )
            try:
                context = await self.authorizer.authorize(running)
            except PermissionDeniedError as authorization_error:
                await lease.establish_durable_identity()
                return await self._authorization_denied(repository, running, authorization_error)
            await lease.establish(context)
            latest = await repository.get_job(running.workspace_id, job_id, lock=True)
            if latest is None:
                return None
            if latest.status == JobStatus.CANCEL_REQUESTED:
                return await self._finish_cancel(repository, latest)
            if latest.status in {
                JobStatus.RETRY,
                JobStatus.CANCELLED,
                JobStatus.FAILED,
                JobStatus.DEAD,
                JobStatus.SUCCEEDED,
            }:
                return await self._preserve_handler_outcome(repository, latest, result, context)
            finished = await repository.replace_job(
                replace(
                    latest,
                    status=JobStatus.SUCCEEDED,
                    result=result,
                    finished_at=datetime.now(UTC),
                )
            )
            await repository.append_event(finished, "job.succeeded", result)
            await repository.commit()
            await self._notify(finished, context)
            return finished

    async def _preserve_handler_outcome(
        self,
        repository: SchedulingRepository,
        job: Job,
        result: dict[str, object],
        context: AuthorizedContext,
    ) -> Job:
        preserved = job
        if job.status == JobStatus.SUCCEEDED:
            preserved = await repository.replace_job(replace(job, result=result))
        await repository.append_event(
            preserved,
            f"job.{preserved.status.value}",
            result if preserved.status == JobStatus.SUCCEEDED else {},
        )
        await repository.commit()
        if preserved.status == JobStatus.RETRY and self.retry_publisher is not None:
            delay = retry_delay(
                preserved.attempt_count,
                self.retry_base_seconds,
                self.retry_max_seconds,
            )
            if preserved.next_attempt_at is not None:
                remaining = (preserved.next_attempt_at - datetime.now(UTC)).total_seconds()
                delay = max(delay, max(0, int(remaining + 0.999)))
            try:
                task_id = self.retry_publisher.publish(preserved, countdown=delay)
                preserved = await repository.replace_job(replace(preserved, broker_task_id=task_id))
                await repository.commit()
            except Exception:  # noqa: BLE001 -- the committed retry row is the outbox.
                await repository.rollback()
        elif preserved.status in {
            JobStatus.SUCCEEDED,
            JobStatus.FAILED,
            JobStatus.DEAD,
            JobStatus.CANCELLED,
        }:
            await self._notify(preserved, context)
        return preserved

    async def _cancel_requested(self, lease: ExecutionLease, job: Job) -> bool:
        context = await self.authorizer.authorize(job)
        await lease.establish(context)
        current = await lease.repository.get_job(job.workspace_id, job.id)
        return current is None or current.status == JobStatus.CANCEL_REQUESTED

    async def _authorization_denied(
        self, repository: SchedulingRepository, job: Job, error: PermissionDeniedError
    ) -> Job:
        failed = await repository.replace_job(
            replace(
                job,
                status=JobStatus.FAILED,
                error_code="authorization_denied",
                error_message=error.message,
                finished_at=datetime.now(UTC),
            )
        )
        await repository.append_event(failed, "job.failed", {"code": "authorization_denied"})
        await repository.commit()
        await self._notify(failed, None)
        return failed

    async def _finish_cancel(self, repository: SchedulingRepository, job: Job) -> Job:
        finished = await repository.replace_job(
            replace(job, status=JobStatus.CANCELLED, finished_at=datetime.now(UTC))
        )
        await repository.append_event(finished, "job.cancelled", {})
        await repository.commit()
        await self._notify(finished, None)
        return finished

    async def _fail(
        self,
        repository: SchedulingRepository,
        job: Job,
        code: str,
        message: str,
        *,
        retryable: bool,
        retry_after: float | None = None,
    ) -> Job:
        now = datetime.now(UTC)
        exhausted = job.attempt_count >= job.max_attempts
        status = (
            JobStatus.RETRY
            if retryable and not exhausted
            else JobStatus.DEAD
            if exhausted
            else JobStatus.FAILED
        )
        delay = retry_delay(job.attempt_count, self.retry_base_seconds, self.retry_max_seconds)
        if retry_after is not None and retry_after >= 0:
            delay = max(delay, int(retry_after + 0.999))
        failed = await repository.replace_job(
            replace(
                job,
                status=status,
                error_code=code,
                error_message=message[:20_000],
                next_attempt_at=now + timedelta(seconds=delay)
                if status == JobStatus.RETRY
                else None,
                dead_lettered_at=now if status == JobStatus.DEAD else None,
                finished_at=now if status != JobStatus.RETRY else None,
            )
        )
        await repository.append_event(failed, f"job.{status.value}", {"code": code})
        await repository.commit()
        if status == JobStatus.RETRY and self.retry_publisher is not None:
            try:
                task_id = self.retry_publisher.publish(failed, countdown=delay)
                failed = await repository.replace_job(replace(failed, broker_task_id=task_id))
                await repository.commit()
            except Exception:  # noqa: BLE001 -- committed retry row is the durable outbox.
                await repository.rollback()
        if status != JobStatus.RETRY:
            await self._notify(failed, None)
        return failed

    async def _notify(self, job: Job, context: AuthorizedContext | None) -> None:
        if self.lifecycle is not None:
            await self.lifecycle.finalized(job, context)
