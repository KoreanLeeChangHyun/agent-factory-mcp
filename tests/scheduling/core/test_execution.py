from dataclasses import replace
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from agent_factory_core.executions.scheduling.domain import JobStatus, new_job
from agent_factory_core.executions.scheduling.execution import ExecuteJob
from agent_factory_core.identity.authorization import AuthorizationScope, AuthorizedContext
from agent_factory_core.identity.domain import Principal
from agent_factory_core.shared.errors import PermissionDeniedError


class Repository:
    def __init__(self, job):
        self.job, self.events = job, []

    async def get_job(self, workspace_id, job_id, *, lock=False):
        return self.job

    async def replace_job(self, job):
        self.job = job
        return job

    async def append_event(self, job, event_type, payload):
        self.events.append(event_type)

    async def commit(self):
        return None


class Lease:
    def __init__(self, job):
        self.job, self.repository, self.contexts = job, Repository(job), []

    async def establish(self, context):
        self.contexts.append(context)

    async def establish_durable_identity(self):
        self.contexts.append("durable")

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return None


class Factory:
    def __init__(self, job, available=True):
        self.lease = Lease(job) if available else None

    async def acquire(self, job_id):
        return self.lease


class Authorizer:
    def __init__(self, allowed=True):
        self.allowed = allowed

    async def authorize(self, job):
        if not self.allowed:
            raise PermissionDeniedError("permission_required")
        return AuthorizedContext(
            Principal(job.requested_by_user_id, "u@example.com", "U", False),
            AuthorizationScope(job.organization_id, job.workspace_id),
            frozenset({"job.create"}),
        )


def make_job(key="request-0001"):
    return new_job(
        organization_id=uuid4(),
        workspace_id=uuid4(),
        user_id=uuid4(),
        task_type="system.noop",
        queue="default",
        payload={},
        idempotency_key=key,
        priority=5,
        max_attempts=3,
    )


@pytest.mark.asyncio
async def test_queue_identity_is_reauthorized_and_context_reapplied() -> None:
    job = make_job()
    factory = Factory(job)

    async def handler(_job, _context, _cancelled):
        return {"ok": True}

    result = await ExecuteJob(factory, {"system.noop": handler}, Authorizer()).execute(job.id)
    assert result.status == JobStatus.SUCCEEDED
    assert len(factory.lease.contexts) == 2


@pytest.mark.asyncio
async def test_authorization_loss_is_a_durable_terminal_failure() -> None:
    job, factory = make_job("request-0002"), None
    factory = Factory(job)
    result = await ExecuteJob(factory, {}, Authorizer(False)).execute(job.id)
    assert result.status == JobStatus.FAILED
    assert result.error_code == "authorization_denied"
    assert factory.lease.repository.events == ["job.failed"]


@pytest.mark.asyncio
async def test_duplicate_delivery_without_lease_is_harmless() -> None:
    job = make_job("request-0003")
    assert await ExecuteJob(Factory(job, False), {}, Authorizer()).execute(job.id) is None


@pytest.mark.asyncio
async def test_running_recovery_and_cooperative_cancellation() -> None:
    job = replace(
        make_job("request-0004"),
        status=JobStatus.RUNNING,
        started_at=datetime.now(UTC),
        attempt_count=1,
    )
    factory = Factory(job)

    async def handler(_job, _context, cancelled):
        assert not await cancelled()
        return {"recovered": True}

    result = await ExecuteJob(factory, {"system.noop": handler}, Authorizer()).execute(job.id)
    assert result.status == JobStatus.SUCCEEDED
    cancelled = replace(job, status=JobStatus.CANCEL_REQUESTED)
    factory = Factory(cancelled)
    result = await ExecuteJob(factory, {"system.noop": handler}, Authorizer()).execute(job.id)
    assert result.status == JobStatus.CANCELLED


@pytest.mark.asyncio
@pytest.mark.parametrize(("attempt_count", "expected"), [(0, JobStatus.RETRY), (2, JobStatus.DEAD)])
async def test_failure_retries_until_attempt_budget_is_exhausted(attempt_count, expected):
    job = replace(make_job(), attempt_count=attempt_count)
    factory = Factory(job)
    publications = []

    class Publisher:
        def publish(self, job, *, countdown=0):
            publications.append((job.id, countdown))
            return "retry-task"

    async def handler(_job, _context, _cancelled):
        raise RuntimeError("temporary failure")

    result = await ExecuteJob(
        factory, {"system.noop": handler}, Authorizer(), retry_publisher=Publisher()
    ).execute(job.id)
    assert result.status == expected
    assert result.attempt_count == attempt_count + 1
    if expected == JobStatus.RETRY:
        assert publications == [(job.id, 30)]
        assert result.broker_task_id == "retry-task"
        assert result.next_attempt_at is not None
    else:
        assert publications == []
        assert result.dead_lettered_at is not None
