import asyncio
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from agent_factory_core.executions.reporting.domain import (
    ReportStatus,
    ReportTask,
    RuntimeBinding,
)
from agent_factory_core.executions.reporting.use_cases import ReportingUseCases
from agent_factory_core.identity.authorization import AuthorizationScope, AuthorizedContext
from agent_factory_core.identity.domain import Principal

NOW = datetime(2026, 9, 13, tzinfo=UTC)


class Clock:
    def now(self) -> datetime:
        return NOW


class Repository:
    def __init__(self, task: ReportTask) -> None:
        self.task = task
        self.receipts: dict[tuple[object, object, str], tuple[str, dict[str, object]]] = {}
        self.mutations = 0
        self.connection_id = None
        self.lock = asyncio.Lock()

    async def lock_workspace(self, organization_id, workspace_id):
        await self.lock.acquire()
        return True

    async def replay_receipt(self, workspace_id, user_id, key, payload_hash):
        value = self.receipts.get((workspace_id, user_id, key))
        if value is None:
            return None
        assert value[0] == payload_hash
        return value[1]

    async def get_task(self, workspace_id, task_id, *, lock=False):
        return self.task

    async def record_observation(
        self,
        task,
        observation,
        *,
        reporter_user_id,
        connection_id,
        key,
        payload_hash,
    ):
        self.mutations += 1
        self.connection_id = connection_id
        response = {"record": {"id": str(task.id), "sequence": observation.sequence}}
        self.receipts[(task.workspace_id, reporter_user_id, key)] = (
            payload_hash,
            response,
        )
        return response

    async def commit(self):
        self.lock.release()


@pytest.mark.asyncio
async def test_concurrent_identical_heartbeat_mutates_once_and_replays_receipt() -> None:
    user_id, organization_id, workspace_id = uuid4(), uuid4(), uuid4()
    binding = RuntimeBinding("project", "agent", "session", "run")
    task = ReportTask(
        uuid4(),
        workspace_id,
        uuid4(),
        user_id,
        "Task",
        "",
        ReportStatus.IN_PROGRESS,
        2,
        runtime_binding=binding,
    )
    repository = Repository(task)
    context = AuthorizedContext(
        Principal(user_id, "user@example.test", "User", False),
        AuthorizationScope(organization_id, workspace_id),
        frozenset({"agent.report"}),
    )
    service = ReportingUseCases(repository, Clock())
    connection_id = uuid4()

    first, second = await asyncio.gather(
        service.heartbeat(
            context,
            task_id=task.id,
            binding=binding,
            sequence=1,
            observed_at=NOW,
            fact="process_alive",
            key="same-key",
            connection_id=connection_id,
        ),
        service.heartbeat(
            context,
            task_id=task.id,
            binding=binding,
            sequence=1,
            observed_at=NOW,
            fact="process_alive",
            key="same-key",
            connection_id=connection_id,
        ),
    )

    assert first == second
    assert repository.mutations == 1
    assert repository.connection_id == connection_id
