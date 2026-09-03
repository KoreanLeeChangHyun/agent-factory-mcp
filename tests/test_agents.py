"""Versioned Agent execution lifecycle tests."""

from uuid import UUID

import pytest

from app.common.errors import ConflictError
from app.modules.agent.models import AgentDefinition, AgentRun, AgentRunStatus, AgentStatus
from app.modules.agent.service import TRANSITIONS, AgentService
from app.modules.auth.authorization import AuthorizationScope, AuthorizedContext
from app.modules.auth.service import Principal

USER_ID = UUID("11111111-1111-4111-8111-111111111111")
ORGANIZATION_ID = UUID("22222222-2222-4222-8222-222222222222")
WORKSPACE_ID = UUID("33333333-3333-4333-8333-333333333333")
DEFINITION_ID = UUID("44444444-4444-4444-8444-444444444444")
VERSION_ID = UUID("55555555-5555-4555-8555-555555555555")
RUN_ID = UUID("66666666-6666-4666-8666-666666666666")


def context() -> AuthorizedContext:
    return AuthorizedContext(
        Principal(USER_ID, "member@example.com", "Member", False),
        AuthorizationScope(ORGANIZATION_ID, WORKSPACE_ID),
        frozenset({"workspace.read", "agent.execute"}),
    )


def run(status: AgentRunStatus) -> AgentRun:
    return AgentRun(
        id=RUN_ID,
        workspace_id=WORKSPACE_ID,
        agent_definition_id=DEFINITION_ID,
        agent_version_id=VERSION_ID,
        requested_by_user_id=USER_ID,
        status=status,
        idempotency_key="request-0001",
        input_payload={"prompt": "hello"},
        input_tokens=0,
        output_tokens=0,
        estimated_cost_usd=0,
    )


class FakeAgentRepository:
    def __init__(self, record: AgentRun) -> None:
        self.run = record
        self.transitions: list[AgentRunStatus] = []
        self.commits = 0

    async def get_run(self, workspace_id: UUID, run_id: UUID) -> AgentRun | None:
        return self.run if (workspace_id, run_id) == (WORKSPACE_ID, RUN_ID) else None

    async def transition_run(
        self, record: AgentRun, target: AgentRunStatus, **values: object
    ) -> None:
        del values
        record.status = target
        self.transitions.append(target)

    async def commit(self) -> None:
        self.commits += 1


def test_run_state_machine_has_terminal_states() -> None:
    assert AgentRunStatus.RUNNING in TRANSITIONS[AgentRunStatus.QUEUED]
    assert AgentRunStatus.CANCEL_REQUESTED in TRANSITIONS[AgentRunStatus.RUNNING]
    assert TRANSITIONS[AgentRunStatus.SUCCEEDED] == frozenset()
    assert TRANSITIONS[AgentRunStatus.FAILED] == frozenset()
    assert TRANSITIONS[AgentRunStatus.CANCELLED] == frozenset()


@pytest.mark.asyncio
async def test_queued_run_cancels_immediately() -> None:
    repository = FakeAgentRepository(run(AgentRunStatus.QUEUED))
    service = AgentService(repository)  # type: ignore[arg-type]

    cancelled = await service.cancel_run(context(), RUN_ID)

    assert cancelled.status == AgentRunStatus.CANCELLED
    assert repository.transitions == [AgentRunStatus.CANCELLED]
    assert repository.commits == 1


@pytest.mark.asyncio
async def test_running_run_requests_cooperative_cancellation() -> None:
    repository = FakeAgentRepository(run(AgentRunStatus.RUNNING))
    service = AgentService(repository)  # type: ignore[arg-type]

    cancelling = await service.cancel_run(context(), RUN_ID)

    assert cancelling.status == AgentRunStatus.CANCEL_REQUESTED


@pytest.mark.asyncio
async def test_terminal_run_rejects_transition() -> None:
    repository = FakeAgentRepository(run(AgentRunStatus.SUCCEEDED))
    service = AgentService(repository)  # type: ignore[arg-type]

    with pytest.raises(ConflictError, match="Cannot transition"):
        await service.transition(repository.run, AgentRunStatus.RUNNING)


def test_agent_definitions_start_without_a_mutable_version() -> None:
    definition = AgentDefinition(
        workspace_id=WORKSPACE_ID,
        name="Researcher",
        slug="researcher",
        description="",
        status=AgentStatus.ACTIVE,
        current_version_number=0,
        revision=1,
    )
    assert definition.current_version_number == 0
