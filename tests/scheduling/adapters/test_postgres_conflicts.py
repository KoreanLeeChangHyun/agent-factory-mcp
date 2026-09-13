from datetime import UTC, datetime
from uuid import uuid4

import pytest
from agent_factory_adapters.postgres.scheduling.repository import PostgresSchedulingRepository
from agent_factory_core.executions.scheduling.domain import Schedule
from agent_factory_core.shared.errors import ConflictError
from sqlalchemy.exc import IntegrityError


class DuplicateSession:
    async def execute(self, statement, values):
        raise IntegrityError("duplicate schedule", values, Exception("unique"))


def schedule() -> Schedule:
    return Schedule(
        id=uuid4(),
        organization_id=uuid4(),
        workspace_id=uuid4(),
        name="daily",
        task_type="system.noop",
        queue="default",
        payload={},
        cron_expression=None,
        interval_seconds=60,
        timezone="UTC",
        is_enabled=True,
        next_run_at=datetime.now(UTC),
        last_run_at=None,
        created_by_user_id=uuid4(),
        execution_user_id=uuid4(),
        revision=1,
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("operation", ["create", "rename"])
async def test_duplicate_schedule_name_is_stable_conflict(operation: str) -> None:
    repository = PostgresSchedulingRepository(DuplicateSession())
    with pytest.raises(ConflictError) as raised:
        if operation == "create":
            await repository.insert_schedule(schedule())
        else:
            await repository.replace_schedule(schedule(), 1)
    assert raised.value.code == "schedule_exists"
