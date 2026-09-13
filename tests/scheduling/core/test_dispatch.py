from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from agent_factory_core.executions.scheduling.dispatch import DispatchSchedules
from agent_factory_core.executions.scheduling.domain import Schedule


@pytest.mark.asyncio
async def test_schedule_stages_job_before_publication_and_advances_next_run():
    now = datetime(2026, 9, 14, tzinfo=UTC)
    schedule = Schedule(
        uuid4(),
        uuid4(),
        uuid4(),
        "hourly",
        "system.noop",
        "default",
        {},
        None,
        3600,
        "UTC",
        True,
        now,
        None,
        uuid4(),
        uuid4(),
    )
    operations = []

    class Repository:
        async def due_schedules(self, at):
            assert at == now
            return [schedule]

        async def insert_job(self, job):
            self.job = job
            operations.append("insert")
            return job

        async def append_event(self, job, event_type, payload):
            assert event_type == "job.queued"

        async def replace_schedule(self, updated, revision):
            self.schedule = updated
            assert revision == schedule.revision
            return updated

        async def replace_job(self, job):
            self.job = job
            return job

        async def commit(self):
            operations.append("commit")

    class Publisher:
        def publish(self, job, *, countdown=0):
            operations.append("publish")
            return "task-1"

    repository = Repository()
    assert await DispatchSchedules(repository, Publisher()).scan_schedules(now) == 1
    assert operations == ["insert", "commit", "publish", "commit"]
    assert repository.job.requested_by_user_id == schedule.execution_user_id
    assert repository.job.workspace_id == schedule.workspace_id
    assert repository.job.idempotency_key == f"schedule:{schedule.id}:{now.isoformat()}"
    assert repository.job.broker_task_id == "task-1"
    assert repository.schedule.next_run_at == now + timedelta(hours=1)
    assert repository.schedule.revision == schedule.revision + 1
