from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timedelta

from .domain import Job, calculate_next_run, new_job
from .ports import JobPublisher, SchedulingRepository


class DispatchSchedules:
    def __init__(
        self, repository: SchedulingRepository, publisher: JobPublisher, *, max_attempts: int = 5
    ) -> None:
        self.repository, self.publisher, self.max_attempts = repository, publisher, max_attempts

    async def scan_schedules(self, now: datetime) -> int:
        records = await self.repository.due_schedules(now)
        jobs: list[Job] = []
        for schedule in records:
            job = new_job(
                organization_id=schedule.organization_id,
                workspace_id=schedule.workspace_id,
                user_id=schedule.execution_user_id or schedule.created_by_user_id,
                task_type=schedule.task_type,
                queue=schedule.queue,
                payload=schedule.payload,
                idempotency_key=f"schedule:{schedule.id}:{schedule.next_run_at.isoformat()}",
                priority=5,
                max_attempts=self.max_attempts,
                schedule_id=schedule.id,
            )
            job = await self.repository.insert_job(job)
            jobs.append(job)
            await self.repository.append_event(job, "job.queued", {"schedule_id": str(schedule.id)})
            await self.repository.replace_schedule(
                replace(
                    schedule,
                    last_run_at=schedule.next_run_at,
                    next_run_at=calculate_next_run(
                        schedule.next_run_at,
                        schedule.cron_expression,
                        schedule.interval_seconds,
                        schedule.timezone,
                    ),
                    revision=schedule.revision + 1,
                ),
                schedule.revision,
            )
        await self.repository.commit()
        for scheduled_job in jobs:
            task_id = self.publisher.publish(scheduled_job)
            await self.repository.replace_job(replace(scheduled_job, broker_task_id=task_id))
        await self.repository.commit()
        return len(records)

    async def recover_dispatches(self, now: datetime, *, stale_after_seconds: int) -> int:
        jobs = await self.repository.due_dispatches(
            now, now - timedelta(seconds=stale_after_seconds)
        )
        for job in jobs:
            task_id = self.publisher.publish(job)
            await self.repository.replace_job(replace(job, broker_task_id=task_id))
        await self.repository.commit()
        return len(jobs)
