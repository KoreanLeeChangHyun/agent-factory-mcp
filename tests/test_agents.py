"""Versioned Agent execution lifecycle tests."""

from uuid import UUID

import pytest

from app.common.errors import ConflictError
from app.modules.agent.execution_service import AgentExecutionService
from app.modules.agent.models import AgentDefinition, AgentRun, AgentRunStatus, AgentStatus
from app.modules.agent.service import TRANSITIONS, AgentService
from app.modules.auth.authorization import AuthorizationScope, AuthorizedContext
from app.modules.auth.service import Principal
from app.modules.schedule.models import Job

USER_ID = UUID("11111111-1111-4111-8111-111111111111")
ORGANIZATION_ID = UUID("22222222-2222-4222-8222-222222222222")
WORKSPACE_ID = UUID("33333333-3333-4333-8333-333333333333")
DEFINITION_ID = UUID("44444444-4444-4444-8444-444444444444")
VERSION_ID = UUID("55555555-5555-4555-8555-555555555555")
RUN_ID = UUID("66666666-6666-4666-8666-666666666666")
RETRY_RUN_ID = UUID("77777777-7777-4777-8777-777777777777")
JOB_ID = UUID("88888888-8888-4888-8888-888888888888")


def context() -> AuthorizedContext:
    return AuthorizedContext(
        Principal(USER_ID, "member@example.com", "Member", False),
        AuthorizationScope(ORGANIZATION_ID, WORKSPACE_ID),
        frozenset({"agent.read", "agent.execute", "agent.stop"}),
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


class FakeExecutionAgentService:
    def __init__(self, submitted: AgentRun, retried: AgentRun) -> None:
        self.repository = FakeAgentRepository(submitted)
        self.submitted = submitted
        self.retried = retried

    async def prepare_run(self, *args: object) -> AgentRun:
        del args
        return self.submitted

    async def prepare_retry(self, *args: object) -> AgentRun:
        del args
        return self.retried


class FakeScheduleRepository:
    def __init__(self) -> None:
        self.commits = 0

    async def commit(self) -> None:
        self.commits += 1


class FakePublisher:
    def __init__(self, repository: FakeScheduleRepository) -> None:
        self.repository = repository
        self.published: list[UUID] = []

    def publish(self, job: Job) -> str:
        assert self.repository.commits == 1
        self.published.append(job.id)
        return "celery-task-id"


class FakeScheduleService:
    def __init__(self) -> None:
        self.repository = FakeScheduleRepository()
        self.publisher = FakePublisher(self.repository)
        self.jobs: list[Job] = []

    async def prepare_enqueue(
        self,
        context: AuthorizedContext,
        task_type: str,
        queue: str,
        payload: dict[str, object],
        idempotency_key: str,
    ) -> tuple[Job, bool]:
        job = Job(
            id=JOB_ID,
            organization_id=context.scope.organization_id,
            workspace_id=WORKSPACE_ID,
            requested_by_user_id=USER_ID,
            task_type=task_type,
            queue=queue,
            idempotency_key=idempotency_key,
            payload=payload,
            max_attempts=5,
        )
        self.jobs.append(job)
        return job, True


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


@pytest.mark.asyncio
async def test_execution_submission_persists_run_and_job_before_publish() -> None:
    submitted = run(AgentRunStatus.QUEUED)
    retried = run(AgentRunStatus.QUEUED)
    retried.id = RETRY_RUN_ID
    agents = FakeExecutionAgentService(submitted, retried)
    schedules = FakeScheduleService()
    service = AgentExecutionService(agents, schedules)  # type: ignore[arg-type]

    execution = await service.submit(
        context(), DEFINITION_ID, VERSION_ID, "request-0001", {"prompt": "hello"}
    )

    assert execution.run is submitted
    assert execution.job.payload == {"agent_run_id": str(RUN_ID)}
    assert execution.job.celery_task_id == "celery-task-id"
    assert schedules.repository.commits == 2
    assert schedules.publisher.published == [JOB_ID]


@pytest.mark.asyncio
async def test_execution_retry_also_enqueues_a_durable_job() -> None:
    submitted = run(AgentRunStatus.QUEUED)
    retried = run(AgentRunStatus.QUEUED)
    retried.id = RETRY_RUN_ID
    agents = FakeExecutionAgentService(submitted, retried)
    schedules = FakeScheduleService()
    service = AgentExecutionService(agents, schedules)  # type: ignore[arg-type]

    execution = await service.retry(context(), RUN_ID)

    assert execution.run is retried
    assert execution.job.payload == {"agent_run_id": str(RETRY_RUN_ID)}
    assert schedules.publisher.published == [JOB_ID]
