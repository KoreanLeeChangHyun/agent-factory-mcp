from contextlib import asynccontextmanager
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from agent_factory_core.connections.providers.collection_domain import (
    CollectionJob,
    CollectionMode,
    CollectionResult,
    CollectionRun,
    CollectionRunStatus,
    CollectionSelection,
    ProviderCollection,
    SourceItem,
    SourcePage,
)
from agent_factory_core.connections.providers.collection_ports import CollectionInfrastructureError
from agent_factory_core.connections.providers.collection_use_cases import ProviderCollectionUseCases
from agent_factory_core.connections.providers.credentials import CredentialConnection
from agent_factory_core.connections.providers.domain import ConnectionStatus
from agent_factory_core.identity.authorization import AuthorizationScope, AuthorizedContext
from agent_factory_core.identity.domain import Principal
from agent_factory_core.shared.errors import ApplicationError, PermissionDeniedError

NOW = datetime(2026, 9, 13, tzinfo=UTC)


class Clock:
    def now(self):
        return NOW


class Repository:
    def __init__(self, collection, run, connection):
        self.collection_value, self.run_value, self.connection_value = collection, run, connection
        self.commits = 0
        self.rollbacks = 0

    async def run(self, workspace_id, run_id, *, lock=False):
        return (
            self.run_value
            if workspace_id == self.run_value.workspace_id and run_id == self.run_value.id
            else None
        )

    async def collection(self, workspace_id, collection_id):
        return (
            self.collection_value
            if workspace_id == self.collection_value.workspace_id
            and collection_id == self.collection_value.id
            else None
        )

    async def connection(self, workspace_id, connection_id):
        return (
            self.connection_value
            if workspace_id == self.connection_value.workspace_id
            and connection_id == self.connection_value.id
            else None
        )

    @asynccontextmanager
    async def guard(self, workspace_id, connection_id):
        assert workspace_id == self.collection_value.workspace_id
        assert connection_id == self.collection_value.connection_id
        yield

    async def cancelled(self, workspace_id, run_id):
        return False

    async def save_run(self, value):
        self.run_value = value
        return value

    async def save_collection(self, value):
        self.collection_value = value

    async def mark_reference_states(self, collection, seen, status):
        pass

    async def commit(self):
        self.commits += 1

    async def rollback(self):
        self.rollbacks += 1


class Jobs:
    def __init__(self, job):
        self.job = job
        self.checkpoints = []
        self.reconciled = []

    async def claim(self, context, job_id):
        return True

    async def authoritative(self, context, job_id):
        return self.job

    async def cancellation_requested(self, job_id):
        return False

    async def checkpoint(self, job_id, run):
        self.checkpoints.append((job_id, run.cursor))

    async def reconcile(self, job_id, status, *, error_code=None, retry_after_seconds=None):
        self.reconciled.append((job_id, status, error_code, retry_after_seconds))

    async def retries_exhausted(self, job_id):
        return False


class Driver:
    async def inspect(self):
        return {
            "health": "available",
            "granted_scopes": ["https://www.googleapis.com/auth/gmail.readonly"],
        }

    async def page(self, selection, cursor, remaining, *, metadata_only):
        assert remaining == 10
        return SourcePage((SourceItem("source", "Source", (), {}),), {"page": "done"}, True, 1, 12)


class Connections:
    async def driver(self, context, connection, **kwargs):
        return Driver()


class NoConnections:
    async def driver(self, context, connection, **kwargs):
        raise AssertionError("provider I/O must not begin for pending cancellation")


class RetryDriver:
    async def inspect(self):
        return {
            "health": "available",
            "granted_scopes": ["https://www.googleapis.com/auth/gmail.readonly"],
        }

    async def page(self, selection, cursor, remaining, *, metadata_only):
        raise RetryError("provider_retryable", "retry", 502)


class RetryError(ApplicationError):
    @property
    def retryable(self):
        return True

    @property
    def retry_after(self):
        return 17


class RetryConnections:
    async def driver(self, context, connection, **kwargs):
        return RetryDriver()


class Documents:
    async def persist(self, context, collection, run, item):
        return CollectionResult(item.source_id, uuid4(), 1, "sha256", True)


class FailingDocuments:
    async def persist(self, context, collection, run, item):
        raise CollectionInfrastructureError("storage credentials and internal detail")


class ExhaustedJobs(Jobs):
    async def retries_exhausted(self, job_id):
        return True


class StartRepository:
    def __init__(self, collection):
        self.collection_value = collection
        self.run_value = None
        self.commits = 0

    async def collection(self, workspace_id, collection_id):
        return self.collection_value

    @asynccontextmanager
    async def guard(self, workspace_id, connection_id):
        yield

    async def find_run(self, workspace_id, collection_id, key):
        return self.run_value

    async def insert_run(self, value):
        self.run_value = value
        return value

    async def save_run(self, value):
        self.run_value = value
        return value

    async def commit(self):
        self.commits += 1

    async def rollback(self):
        pass


class StartJobs:
    def __init__(self, template):
        self.template = template
        self.staged = 0
        self.published = 0

    async def stage(self, context, run):
        self.staged += 1
        return CollectionRun(
            run.id,
            run.workspace_id,
            run.collection_id,
            run.requested_by_user_id,
            run.request_key,
            run.status,
            self.template.id,
        ), self.template

    def publish(self, job):
        self.published += 1
        return "publication"

    async def record_publication(self, job, publication_id):
        pass


def fixture():
    user_id, organization_id, workspace_id = uuid4(), uuid4(), uuid4()
    context = AuthorizedContext(
        Principal(user_id, "owner@example.test", "Owner", False),
        AuthorizationScope(organization_id, workspace_id),
        frozenset({"integration.use", "document.import"}),
    )
    connection = CredentialConnection(
        uuid4(), workspace_id, uuid4(), "gmail", ConnectionStatus.ACTIVE, b"secret", 1
    )
    collection = ProviderCollection(
        uuid4(),
        workspace_id,
        connection.id,
        "gmail",
        "Inbox",
        CollectionSelection({"query": "from:example.test"}, max_items=10),
        CollectionMode.CONTENT,
        user_id,
    )
    run = CollectionRun(
        uuid4(), workspace_id, collection.id, user_id, "request", CollectionRunStatus.QUEUED
    )
    job = CollectionJob(
        uuid4(),
        organization_id,
        workspace_id,
        user_id,
        "integration.sync",
        "running",
        {"collection_run_id": str(run.id)},
        f"collection:{run.id}",
    )
    return context, collection, run, connection, job


@pytest.mark.asyncio
async def test_execute_reloads_bound_job_and_checkpoints_page() -> None:
    context, collection, run, connection, job = fixture()
    repository, jobs = Repository(collection, run, connection), Jobs(job)

    result = await ProviderCollectionUseCases(
        repository, jobs, Connections(), Documents(), Clock()
    ).execute(context, run.id, job_id=job.id)

    assert result.status == CollectionRunStatus.SUCCEEDED
    assert result.results[0].source_id == "source"
    assert jobs.checkpoints == [(job.id, {"page": "done"})]
    assert jobs.reconciled == [(job.id, "succeeded", None, None)]


@pytest.mark.asyncio
async def test_execute_rejects_untrusted_job_tenant_binding() -> None:
    context, collection, run, connection, job = fixture()
    wrong = CollectionJob(
        job.id,
        uuid4(),
        job.workspace_id,
        job.requested_by_user_id,
        job.task_type,
        job.status,
        job.payload,
        job.idempotency_key,
    )

    with pytest.raises(PermissionDeniedError, match="Job does not match"):
        await ProviderCollectionUseCases(
            Repository(collection, run, connection),
            Jobs(wrong),
            Connections(),
            Documents(),
            Clock(),
        ).execute(context, run.id, job_id=job.id)


@pytest.mark.asyncio
async def test_pending_job_cancellation_reconciles_without_provider_io() -> None:
    context, collection, run, connection, job = fixture()
    cancelled_job = CollectionJob(
        job.id,
        job.organization_id,
        job.workspace_id,
        job.requested_by_user_id,
        job.task_type,
        "cancel_requested",
        job.payload,
        job.idempotency_key,
    )
    repository, jobs = Repository(collection, run, connection), Jobs(cancelled_job)

    result = await ProviderCollectionUseCases(
        repository, jobs, NoConnections(), Documents(), Clock()
    ).execute(context, run.id, job_id=job.id)

    assert result.status == CollectionRunStatus.CANCELLED
    assert jobs.checkpoints == []
    assert jobs.reconciled == [(job.id, "cancelled", None, None)]


@pytest.mark.asyncio
async def test_retryable_provider_failure_keeps_checkpoint_and_reconciles_retry() -> None:
    context, collection, run, connection, job = fixture()
    repository, jobs = Repository(collection, run, connection), Jobs(job)

    result = await ProviderCollectionUseCases(
        repository, jobs, RetryConnections(), Documents(), Clock()
    ).execute(context, run.id, job_id=job.id)

    assert result.status == CollectionRunStatus.RETRY
    assert result.cursor == {}
    assert result.finished_at is None
    assert jobs.reconciled == [(job.id, "retry", "provider_retryable", 17)]


@pytest.mark.asyncio
async def test_unexpected_persistence_failure_rolls_back_reloads_and_sanitizes_retry() -> None:
    context, collection, run, connection, job = fixture()
    repository, jobs = Repository(collection, run, connection), Jobs(job)

    result = await ProviderCollectionUseCases(
        repository, jobs, Connections(), FailingDocuments(), Clock()
    ).execute(context, run.id, job_id=job.id)

    assert repository.rollbacks == 1
    assert result.status == CollectionRunStatus.RETRY
    assert result.error_code == "collection_persistence_error"
    assert jobs.reconciled == [(job.id, "retry", "collection_persistence_error", None)]


@pytest.mark.asyncio
async def test_retry_exhaustion_records_terminal_failure() -> None:
    context, collection, run, connection, job = fixture()
    repository, jobs = Repository(collection, run, connection), ExhaustedJobs(job)

    result = await ProviderCollectionUseCases(
        repository, jobs, RetryConnections(), Documents(), Clock()
    ).execute(context, run.id, job_id=job.id)

    assert result.status == CollectionRunStatus.FAILED
    assert result.finished_at == NOW
    assert jobs.reconciled == [(job.id, "dead", "provider_retryable", None)]


@pytest.mark.asyncio
async def test_start_is_idempotent_and_commits_durable_job_before_single_publication() -> None:
    context, collection, _run, _connection, job = fixture()
    repository, jobs = StartRepository(collection), StartJobs(job)
    service = ProviderCollectionUseCases(repository, jobs, Connections(), Documents(), Clock())

    first = await service.start(context, collection.id, "same-key")
    repeated = await service.start(context, collection.id, "same-key")

    assert repeated.id == first.id
    assert first.job_id == job.id
    assert jobs.staged == 1
    assert jobs.published == 1
    assert repository.commits == 2
