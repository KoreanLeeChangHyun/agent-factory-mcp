from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from agent_factory_core.administration import PlatformAdministration
from agent_factory_core.executions import AdminJob, ExecutionAdministration, JobStatus
from agent_factory_core.identity import IdentityAdministration, Principal, UserStatus
from agent_factory_core.shared.errors import ConflictError, PermissionDeniedError


class FakeRepository:
    def __init__(self) -> None:
        self.authorized = True
        self.status_result = None
        self.transition_results: list[AdminJob | None] = []
        self.exists = True
        self.commits = 0
        self.rollbacks = 0
        self.transitions: list[tuple[frozenset[JobStatus], JobStatus, bool]] = []

    async def authorize_and_establish(self, principal):
        return self.authorized

    async def rollback(self):
        self.rollbacks += 1

    async def commit(self):
        self.commits += 1

    async def set_user_status(self, **values):
        return self.status_result

    async def revoke_sessions(self, **values):
        return 2

    async def transition_job(self, *, job_id, allowed, target, retry):
        self.transitions.append((allowed, target, retry))
        return self.transition_results.pop(0)

    async def job_exists(self, job_id):
        return self.exists


class Clock:
    def now(self):
        return datetime(2026, 9, 13, tzinfo=UTC)


def principal(*, admin: bool = True) -> Principal:
    return Principal(uuid4(), "admin@example.test", "Admin", admin)


def job(status: JobStatus) -> AdminJob:
    return AdminJob(
        id=uuid4(),
        organization_id=uuid4(),
        workspace_id=uuid4(),
        task_type="document.import",
        queue="documents",
        status=status,
        attempt_count=1,
        max_attempts=5,
        error_code=None,
        error_message=None,
        created_at=datetime(2026, 9, 13, tzinfo=UTC),
    )


@pytest.mark.asyncio
async def test_platform_calls_require_current_established_admin() -> None:
    repository = FakeRepository()
    application = PlatformAdministration(
        repository,
        SimpleNamespace(
            application_version="1", environment="test", debug=False, embedding_provider="disabled"
        ),
    )
    with pytest.raises(PermissionDeniedError, match="platform_admin_context_required"):
        await application.dashboard()
    with pytest.raises(PermissionDeniedError, match="platform_admin_required"):
        await application.establish(principal(admin=False))
    repository.authorized = False
    with pytest.raises(PermissionDeniedError, match="platform_admin_required"):
        await application.establish(principal())
    assert repository.rollbacks == 2


@pytest.mark.asyncio
async def test_identity_admin_guards_self_lockout_and_revokes_sessions() -> None:
    repository = FakeRepository()
    actor = principal()
    application = IdentityAdministration(repository, Clock())
    with pytest.raises(ConflictError, match="cannot suspend itself"):
        await application.set_user_status(actor, actor.user_id, UserStatus.SUSPENDED)
    assert await application.revoke_sessions(uuid4()) == 2
    assert repository.commits == 1


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("current", "target"),
    [
        (JobStatus.QUEUED, JobStatus.CANCELLED),
        (JobStatus.RETRY, JobStatus.CANCELLED),
        (JobStatus.RUNNING, JobStatus.CANCEL_REQUESTED),
    ],
)
async def test_job_cancel_matrix(current: JobStatus, target: JobStatus) -> None:
    repository = FakeRepository()
    result = job(target)
    repository.transition_results = [result] if current is not JobStatus.RUNNING else [None, result]
    assert await ExecutionAdministration(repository).cancel(result.id) == result
    assert repository.transitions[-1][1] is target
    if current in {JobStatus.QUEUED, JobStatus.RETRY}:
        assert repository.transitions[-1][0] == frozenset({JobStatus.QUEUED, JobStatus.RETRY})
    else:
        assert repository.transitions[-1][0] == frozenset({JobStatus.RUNNING})
    assert repository.commits == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("current", [JobStatus.FAILED, JobStatus.DEAD, JobStatus.CANCELLED])
async def test_job_retry_matrix_resets_through_typed_transition(current: JobStatus) -> None:
    repository = FakeRepository()
    result = job(JobStatus.QUEUED)
    repository.transition_results = [result]
    assert await ExecutionAdministration(repository).retry(result.id) == result
    assert repository.transitions == [
        (frozenset({JobStatus.FAILED, JobStatus.DEAD, JobStatus.CANCELLED}), JobStatus.QUEUED, True)
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "current",
    [
        JobStatus.SUCCEEDED,
        JobStatus.FAILED,
        JobStatus.CANCEL_REQUESTED,
        JobStatus.CANCELLED,
        JobStatus.DEAD,
    ],
)
async def test_terminal_cancel_conflict_rolls_back(current: JobStatus) -> None:
    assert current not in {JobStatus.QUEUED, JobStatus.RETRY, JobStatus.RUNNING}
    repository = FakeRepository()
    repository.transition_results = [None, None]
    with pytest.raises(ConflictError, match="does not allow"):
        await ExecutionAdministration(repository).cancel(UUID(int=1))
    assert repository.commits == 0
    assert repository.rollbacks == 1


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "current",
    [
        JobStatus.QUEUED,
        JobStatus.RETRY,
        JobStatus.RUNNING,
        JobStatus.SUCCEEDED,
        JobStatus.CANCEL_REQUESTED,
    ],
)
async def test_nonterminal_or_successful_job_is_not_retryable(current: JobStatus) -> None:
    assert current not in {JobStatus.FAILED, JobStatus.DEAD, JobStatus.CANCELLED}
    repository = FakeRepository()
    repository.transition_results = [None]
    with pytest.raises(ConflictError, match="does not allow"):
        await ExecutionAdministration(repository).retry(UUID(int=2))
    assert repository.rollbacks == 1


@pytest.mark.asyncio
async def test_feature_flag_validation_is_bounded_and_fail_closed() -> None:
    repository = FakeRepository()
    application = PlatformAdministration(
        repository,
        SimpleNamespace(
            application_version="1", environment="test", debug=False, embedding_provider="disabled"
        ),
    )
    await application.establish(principal())
    with pytest.raises(Exception, match="Invalid rollout identifiers"):
        await application.set_flag("react-workbench", True, "", {"workspaceIds": ["bad"]})
