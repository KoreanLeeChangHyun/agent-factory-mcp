from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from agent_factory_core.executions.reporting.domain import (
    AgentWrite,
    ReportingCommand,
    ReportStatus,
    ReportTask,
    ReportWrite,
    ResultWrite,
    RuntimeBinding,
    TaskWrite,
)
from agent_factory_core.executions.reporting.use_cases import ReportingUseCases
from agent_factory_core.identity.authorization import AuthorizationScope, AuthorizedContext
from agent_factory_core.identity.domain import Principal
from agent_factory_core.shared.errors import ConflictError

NOW = datetime(2026, 9, 13, tzinfo=UTC)


class Clock:
    def now(self) -> datetime:
        return NOW


class Repository:
    def __init__(self) -> None:
        self.agents = {}
        self.tasks = {}
        self.receipts = {}
        self.reports = []
        self.provenance = []

    async def lock_workspace(self, organization_id, workspace_id):
        return True

    async def replay_receipt(self, workspace_id, user_id, key, payload_hash):
        value = self.receipts.get((workspace_id, user_id, key))
        if value is None:
            return None
        if value[0] != payload_hash:
            raise ConflictError("report_idempotency_conflict", "different")
        return value[1]

    async def get_agent(self, workspace_id, agent_id):
        return self.agents.get((workspace_id, agent_id))

    async def save_agent(self, value, expected_revision):
        self.agents[(value.workspace_id, value.id)] = value
        return value

    async def get_task(self, workspace_id, task_id, *, lock=False):
        return self.tasks.get((workspace_id, task_id))

    async def insert_task(self, value):
        self.tasks[(value.workspace_id, value.id)] = value
        return value

    async def plan_item_exists(self, workspace_id, plan_item_id):
        return True

    async def document_exists(self, workspace_id, document_id):
        return True

    async def record_registration(
        self, value, *, operation, received_at, reporter_user_id, connection_id, key, payload_hash
    ):
        self.provenance.append((operation, connection_id))
        response = {"record": {"id": str(value.id), "revision": value.revision}}
        self.receipts[(value.workspace_id, reporter_user_id, key)] = (payload_hash, response)
        return response

    async def record_report(
        self, task, report, *, received_at, reporter_user_id, connection_id, key, payload_hash
    ):
        self.provenance.append(("report", connection_id))
        self.tasks[(task.workspace_id, task.id)] = task
        self.reports.append((task, report))
        response = {
            "record": {"id": str(task.id), "revision": task.revision},
            "report_id": str(uuid4()),
        }
        self.receipts[(task.workspace_id, reporter_user_id, key)] = (payload_hash, response)
        return response

    async def commit(self):
        pass


def context(user_id: UUID, organization_id: UUID, workspace_id: UUID) -> AuthorizedContext:
    return AuthorizedContext(
        Principal(user_id, "user@example.test", "User", False),
        AuthorizationScope(organization_id, workspace_id),
        frozenset({"agent.report"}),
    )


@pytest.mark.asyncio
async def test_register_report_results_and_idempotent_terminal_replay() -> None:
    user_id, organization_id, workspace_id = uuid4(), uuid4(), uuid4()
    agent_id, task_id, document_id = uuid4(), uuid4(), uuid4()
    binding = RuntimeBinding("project", "agent", "session", "run")
    repository = Repository()
    service = ReportingUseCases(repository, Clock())
    actor = context(user_id, organization_id, workspace_id)
    connection_id = uuid4()

    await service.command(
        actor,
        ReportingCommand("agent-1", "agent", agent=AgentWrite(agent_id, 0, "A", "Work", "Do work")),
        connection_id,
    )
    await service.command(
        actor,
        ReportingCommand(
            "task-1",
            "task",
            task=TaskWrite(task_id, agent_id, "Task", runtime_binding=binding),
        ),
        connection_id,
    )
    await service.command(
        actor,
        ReportingCommand(
            "report-start",
            "report",
            report=ReportWrite(
                task_id, 1, ReportStatus.IN_PROGRESS, "Started", runtime_binding=binding
            ),
        ),
        connection_id,
    )
    command = ReportingCommand(
        "report-1",
        "report",
        report=ReportWrite(
            task_id,
            2,
            ReportStatus.COMPLETED,
            "Done",
            75,
            (ResultWrite("Evidence", document_id=document_id),),
            binding,
        ),
    )
    first = await service.command(actor, command, connection_id)
    second = await service.command(actor, command, connection_id)

    assert first == second
    assert len(repository.reports) == 2
    assert repository.provenance == [
        ("agent", connection_id),
        ("task", connection_id),
        ("report", connection_id),
        ("report", connection_id),
    ]
    persisted: ReportTask = repository.tasks[(workspace_id, task_id)]
    assert persisted.status == ReportStatus.COMPLETED
    assert persisted.progress == 75
    with pytest.raises(ConflictError, match="invalid_transition"):
        await service.command(
            actor,
            ReportingCommand(
                "report-2",
                "report",
                report=ReportWrite(
                    task_id, 3, ReportStatus.IN_PROGRESS, "Resume", runtime_binding=binding
                ),
            ),
        )
