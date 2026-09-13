from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime
from uuid import UUID, uuid4

from agent_factory_core.identity.authorization import (
    AuthorizedContext,
    require_context,
    require_workspace_id,
)
from agent_factory_core.shared.errors import ConflictError, NotFoundError

from .domain import (
    Job,
    JobEvent,
    JobStatus,
    Schedule,
    ScheduleDraft,
    calculate_next_run,
    new_job,
    validate_task_queue,
)
from .ports import JobPublisher, SchedulingRepository


class SchedulingUseCases:
    def __init__(
        self, repository: SchedulingRepository, publisher: JobPublisher, *, max_attempts: int = 5
    ) -> None:
        self.repository = repository
        self.publisher = publisher
        self.max_attempts = max_attempts

    async def schedules(self, context: AuthorizedContext) -> list[Schedule]:
        require_context(context, "schedule.read")
        return await self.repository.list_schedules(require_workspace_id(context))

    async def create_schedule(self, context: AuthorizedContext, draft: ScheduleDraft) -> Schedule:
        require_context(context, "schedule.create")
        self._authorize_task(context, draft.task_type)
        validate_task_queue(draft.task_type, draft.queue)
        record = Schedule(
            uuid4(),
            context.scope.organization_id,
            require_workspace_id(context),
            draft.name.strip(),
            draft.task_type,
            draft.queue,
            dict(draft.payload),
            draft.cron_expression,
            draft.interval_seconds,
            draft.timezone,
            True,
            calculate_next_run(
                datetime.now(UTC), draft.cron_expression, draft.interval_seconds, draft.timezone
            ),
            None,
            context.principal.user_id,
            context.principal.user_id,
        )
        try:
            result = await self.repository.insert_schedule(record)
            await self.repository.commit()
            return result
        except BaseException:
            await self.repository.rollback()
            raise

    async def update_schedule(
        self,
        context: AuthorizedContext,
        schedule_id: UUID,
        draft: ScheduleDraft,
        expected_revision: int,
    ) -> Schedule:
        require_context(context, "schedule.update")
        self._authorize_task(context, draft.task_type)
        validate_task_queue(draft.task_type, draft.queue)
        current = await self._schedule(context, schedule_id, lock=True)
        updated = replace(
            current,
            name=draft.name.strip(),
            task_type=draft.task_type,
            queue=draft.queue,
            payload=dict(draft.payload),
            cron_expression=draft.cron_expression,
            interval_seconds=draft.interval_seconds,
            timezone=draft.timezone,
            execution_user_id=context.principal.user_id,
            next_run_at=calculate_next_run(
                datetime.now(UTC), draft.cron_expression, draft.interval_seconds, draft.timezone
            ),
            revision=current.revision + 1,
        )
        return await self._save_schedule(updated, expected_revision)

    async def set_enabled(
        self, context: AuthorizedContext, schedule_id: UUID, enabled: bool, expected_revision: int
    ) -> Schedule:
        require_context(context, "schedule.toggle")
        current = await self._schedule(context, schedule_id, lock=True)
        if enabled:
            self._authorize_task(context, current.task_type)
        updated = replace(
            current,
            is_enabled=enabled,
            execution_user_id=context.principal.user_id if enabled else current.execution_user_id,
            next_run_at=calculate_next_run(
                datetime.now(UTC),
                current.cron_expression,
                current.interval_seconds,
                current.timezone,
            )
            if enabled
            else current.next_run_at,
            revision=current.revision + 1,
        )
        return await self._save_schedule(updated, expected_revision)

    async def delete_schedule(
        self, context: AuthorizedContext, schedule_id: UUID, expected_revision: int
    ) -> None:
        require_context(context, "schedule.delete")
        if not await self.repository.delete_schedule(
            require_workspace_id(context), schedule_id, expected_revision
        ):
            await self.repository.rollback()
            raise ConflictError("schedule_revision_conflict", "Schedule changed; reload and retry")
        await self.repository.commit()

    async def enqueue(
        self,
        context: AuthorizedContext,
        *,
        task_type: str,
        queue: str,
        payload: dict[str, object],
        idempotency_key: str,
        priority: int = 5,
    ) -> Job:
        require_context(context, "agent.execute" if task_type == "agent.run" else "job.create")
        workspace_id = require_workspace_id(context)
        existing = await self.repository.find_job(workspace_id, idempotency_key)
        if existing is not None:
            return existing
        job = new_job(
            organization_id=context.scope.organization_id,
            workspace_id=workspace_id,
            user_id=context.principal.user_id,
            task_type=task_type,
            queue=queue,
            payload=payload,
            idempotency_key=idempotency_key,
            priority=priority,
            max_attempts=self.max_attempts,
        )
        try:
            job = await self.repository.insert_job(job)
            await self.repository.append_event(job, "job.queued", {})
            await self.repository.commit()
        except BaseException:
            await self.repository.rollback()
            duplicate = await self.repository.find_job(workspace_id, idempotency_key)
            if duplicate is not None:
                return duplicate
            raise
        task_id = self.publisher.publish(job)
        job = await self.repository.replace_job(replace(job, broker_task_id=task_id))
        await self.repository.commit()
        return job

    async def jobs(self, context: AuthorizedContext) -> list[Job]:
        require_context(context, "job.read")
        return await self.repository.list_jobs(require_workspace_id(context))

    async def job_events(self, context: AuthorizedContext, job_id: UUID) -> list[JobEvent]:
        require_context(context, "job.read")
        workspace_id = require_workspace_id(context)
        if await self.repository.get_job(workspace_id, job_id) is None:
            raise NotFoundError("job_not_found", "Job not found")
        return await self.repository.list_events(workspace_id, job_id)

    async def cancel(self, context: AuthorizedContext, job_id: UUID) -> Job:
        require_context(context, "job.cancel")
        job = await self.repository.get_job(require_workspace_id(context), job_id, lock=True)
        if job is None:
            raise NotFoundError("job_not_found", "Job not found")
        changed = job.request_cancel(datetime.now(UTC))
        changed = await self.repository.replace_job(changed)
        await self.repository.append_event(changed, f"job.{changed.status.value}", {})
        await self.repository.commit()
        return changed

    async def retry(self, context: AuthorizedContext, job_id: UUID) -> Job:
        require_context(context, "job.retry")
        original = await self.repository.get_job(require_workspace_id(context), job_id)
        if original is None:
            raise NotFoundError("job_not_found", "Job not found")
        if original.status not in {JobStatus.FAILED, JobStatus.DEAD, JobStatus.CANCELLED}:
            raise ConflictError("job_not_retryable", "Job is not retryable")
        return await self.enqueue(
            context,
            task_type=original.task_type,
            queue=original.queue,
            payload=original.payload,
            priority=original.priority,
            idempotency_key=f"manual-retry:{original.id}:{uuid4().hex}",
        )

    async def _schedule(
        self, context: AuthorizedContext, schedule_id: UUID, *, lock: bool
    ) -> Schedule:
        result = await self.repository.get_schedule(
            require_workspace_id(context), schedule_id, lock=lock
        )
        if result is None:
            raise NotFoundError("schedule_not_found", "Schedule not found")
        return result

    async def _save_schedule(self, schedule: Schedule, expected_revision: int) -> Schedule:
        try:
            result = await self.repository.replace_schedule(schedule, expected_revision)
            if result is None:
                raise ConflictError(
                    "schedule_revision_conflict", "Schedule changed; reload and retry"
                )
            await self.repository.commit()
            return result
        except BaseException:
            await self.repository.rollback()
            raise

    @staticmethod
    def _authorize_task(context: AuthorizedContext, task_type: str) -> None:
        if task_type == "agent.run":
            require_context(context, "agent.execute")
        elif task_type == "integration.sync":
            require_context(context, "integration.use", "document.import")
