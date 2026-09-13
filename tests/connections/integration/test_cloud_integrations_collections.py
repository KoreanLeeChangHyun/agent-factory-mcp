"""Collection replay/provenance tests with real Gmail transport and memory storage."""

import base64
from contextlib import asynccontextmanager
from hashlib import sha256
from types import SimpleNamespace as N
from uuid import uuid4

import httpx
import pytest

from app.common.errors import NotFoundError, PermissionDeniedError
from app.core.config import Settings
from app.infrastructure.secret_encryption import SecretCipher
from app.modules.integration.cloud_connections import CloudConnections
from app.modules.integration.cloud_http import ProviderHTTP
from app.modules.integration.cloud_models import (
    CloudCollection,
    CloudCollectionRun,
    CloudSourceMapping,
)
from app.modules.integration.cloud_oauth import OAuthConfig
from app.modules.integration.cloud_schemas import CollectionCreate, Selection
from app.modules.integration.cloud_service import CloudCollectionService
from app.modules.integration.models import ConnectionStatus


class MemoryRepository:
    def __init__(self):
        self.workspace_id = uuid4()
        self.context = N(
            scope=N(workspace_id=self.workspace_id, organization_id=uuid4()),
            principal=N(user_id=uuid4(), is_platform_admin=False),
            permissions={
                "workspace.read",
                "integration.read",
                "integration.use",
                "integration.update",
                "document.read",
                "document.create",
                "document.update",
                "document.import",
            },
        )
        self.records, self.docs, self.mappings = {}, {}, {}
        self.conn = N(
            id=uuid4(),
            workspace_id=self.workspace_id,
            provider_id=uuid4(),
            status=ConnectionStatus.ACTIVE,
            encrypted_credentials=None,
            encryption_key_version=1,
            external_account_id=None,
            name="Account",
        )
        self.cloud_state = N(
            requested_scopes=["https://www.googleapis.com/auth/gmail.readonly"],
            granted_scopes=["https://www.googleapis.com/auth/gmail.readonly"],
            inspection={},
            inspected_at=None,
        )
        self.force_cancel = False
        self.provider_key = "gmail"

    async def scope(self):
        pass

    async def rollback(self):
        pass

    async def connection(self, identifier):
        if identifier != self.conn.id or self.conn.workspace_id != self.workspace_id:
            raise NotFoundError("integration_connection_not_found", "Connection not found")
        return self.conn

    async def get_provider(self, identifier):
        return N(key=self.provider_key)

    async def state(self, identifier):
        return self.cloud_state

    async def one(self, model, identifier):
        record = self.records.get(identifier)
        if record is None or record.workspace_id != self.workspace_id:
            raise NotFoundError("integration_record_not_found", "Record not found")
        return record

    async def find_run(self, collection_id, key):
        return next(
            (
                r
                for r in self.records.values()
                if isinstance(r, CloudCollectionRun)
                and r.collection_id == collection_id
                and r.request_key == key
            ),
            None,
        )

    async def mapping(self, collection_id, source_id):
        return self.mappings.get((collection_id, source_id))

    async def list_mappings(self, collection_id):
        return [row for (owner, _), row in self.mappings.items() if owner == collection_id]

    async def has_active_mapping(self, document_id, excluding_id):
        return any(
            row.document_id == document_id
            and row.id != excluding_id
            and row.source_status == "active"
            for row in self.mappings.values()
        )

    async def document_by_slug(self, slug):
        return next((d for d in self.docs.values() if d.slug == slug), None)

    async def cancelled(self, run_id):
        return self.force_cancel

    async def save(self, record):
        if isinstance(record, (CloudCollection, CloudCollectionRun)):
            self.records[record.id] = record
        elif isinstance(record, CloudSourceMapping):
            self.mappings[(record.collection_id, record.source_id)] = record

    @asynccontextmanager
    async def guard(self, identifier):
        yield


class MemoryDocuments:
    def __init__(self, repository):
        self.repository, self.revisions = repository, {}
        self.fail_after = None
        self.created_revisions = 0

    async def create(self, context, title, slug, document_type, metadata):
        document = N(
            id=uuid4(),
            title=title,
            slug=slug,
            document_type=document_type,
            document_metadata=metadata,
            deleted_at=None,
            revision=1,
        )
        self.repository.docs[document.id] = document
        return document

    async def get(self, context, document_id):
        return self.repository.docs[document_id]

    async def update(self, context, document_id, title, status, metadata, revision):
        document = self.repository.docs[document_id]
        assert document.revision == revision
        document.title, document.document_metadata = title, metadata
        document.revision += 1
        return document

    async def list_revisions(self, context, document_id):
        return self.revisions.get(document_id, [])

    async def add_revision(self, context, document_id, filename, media_type, content, metadata):
        if self.fail_after is not None and self.created_revisions >= self.fail_after:
            raise RuntimeError("simulated storage outage")
        rows = self.revisions.setdefault(document_id, [])
        record = N(
            revision_number=len(rows) + 1,
            sha256=sha256(content).hexdigest(),
            revision_metadata=metadata,
            filename=filename,
            media_type=media_type,
            content=content,
        )
        rows.append(record)
        self.created_revisions += 1
        return record


class MemorySchedules:
    def __init__(self):
        self.jobs = {}

    async def enqueue(self, context, task_type, queue, payload, key):
        existing = next((j for j in self.jobs.values() if j.idempotency_key == key), None)
        if existing:
            return existing
        job = N(
            id=uuid4(),
            workspace_id=context.scope.workspace_id,
            organization_id=context.scope.organization_id,
            requested_by_user_id=context.principal.user_id,
            task_type=task_type,
            payload=payload,
            idempotency_key=key,
            status="running",
        )
        self.jobs[job.id] = job
        return job

    async def get_job(self, context, identifier):
        return self.jobs[identifier]


async def no_cancel():
    return False


@asynccontextmanager
async def setup_service(*, messages=1, health_response=None):
    repository = MemoryRepository()
    raw = b"From: source@example.com\r\nSubject: Source\r\n\r\nOriginal content"
    requests = []

    def handler(request):
        requests.append(request)
        assert request.headers["authorization"] == "Bearer private-access"
        if request.url.path.endswith("/profile"):
            if health_response is not None:
                return health_response()
            return httpx.Response(200, json={"emailAddress": "source@example.com"})
        if request.url.path.endswith("/messages"):
            return httpx.Response(
                200, json={"messages": [{"id": f"m{i}"} for i in range(messages)]}
            )
        identifier = request.url.path.rsplit("/", 1)[-1]
        return httpx.Response(
            200, json={"id": identifier, "raw": base64.urlsafe_b64encode(raw).decode()}
        )

    cipher = SecretCipher("test-secret", 1)
    repository.conn.encrypted_credentials = cipher.encrypt(
        {
            "access_token": "private-access",
            "scope": "https://www.googleapis.com/auth/gmail.readonly",
        }
    )
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        connections = CloudConnections(
            repository, cipher, Settings(environment="test"), ProviderHTTP(client), {}
        )
        documents, schedules = MemoryDocuments(repository), MemorySchedules()
        service = CloudCollectionService(repository, connections, documents, schedules)
        yield service, repository, documents, schedules, requests


async def create_and_start(service, repository, *, name="Inbox", key="request1"):
    created = await service.create(
        CollectionCreate(
            connection_id=repository.conn.id,
            name=name,
            selection=Selection(query="from:source@example.com"),
        )
    )
    from uuid import UUID

    collection_id = UUID(created["collection_id"])
    started = await service.start(collection_id, key)
    return collection_id, UUID(started["run_id"]), UUID(started["job_id"])


@pytest.mark.asyncio
async def test_idempotent_start_refresh_and_provenance():
    async with setup_service() as (service, repo, documents, schedules, _requests):
        collection_id, run_id, job_id = await create_and_start(service, repo)
        first = await service.execute(run_id, job_id=job_id, cancelled=no_cancel)
        assert first["status"] == "succeeded"
        assert first["results"][0]["revision_number"] == 1
        replay = await service.start(collection_id, "request1")
        assert replay["run_id"] == str(run_id) and len(schedules.jobs) == 1
        await service.execute(run_id, job_id=job_id, cancelled=no_cancel)
        assert documents.created_revisions == 1
        from uuid import UUID

        refresh = await service.start(collection_id, "refresh2")
        refreshed = await service.execute(
            UUID(refresh["run_id"]), job_id=UUID(refresh["job_id"]), cancelled=no_cancel
        )
        assert refreshed["results"][0]["changed"] is False
        assert documents.created_revisions == 1
        revision = next(iter(documents.revisions.values()))[0]
        assert revision.revision_metadata["gather"]["source_id"] == "m0"
        assert (
            revision.revision_metadata["gather"]["selection"]["query"] == "from:source@example.com"
        )
        assert revision.revision_metadata["collection_run_id"] == str(run_id)
        assert revision.media_type == "application/zip"
        assert "private-access" not in str(refreshed)


@pytest.mark.asyncio
async def test_two_independent_selections_share_one_connection():
    async with setup_service() as (service, repo, _documents, _schedules, _requests):
        first, run1, job1 = await create_and_start(service, repo, name="First")
        second, run2, job2 = await create_and_start(service, repo, name="Second")
        await service.execute(run1, job_id=job1, cancelled=no_cancel)
        assert repo.records[run2].cursor == {} and repo.records[run2].pages == 0
        await service.execute(run2, job_id=job2, cancelled=no_cancel)
        assert first != second and len(repo.mappings) == 2 and len(repo.docs) == 2
        assert repo.records[first].connection_id == repo.records[second].connection_id


@pytest.mark.asyncio
async def test_drive_reference_collection_persists_link_metadata_without_revision_body():
    repository = MemoryRepository()
    repository.provider_key = "google-drive"
    repository.cloud_state.requested_scopes = ["https://www.googleapis.com/auth/drive.readonly"]
    repository.cloud_state.granted_scopes = ["https://www.googleapis.com/auth/drive.readonly"]
    cipher = SecretCipher("test-secret", 1)
    repository.conn.encrypted_credentials = cipher.encrypt(
        {
            "access_token": "private-access",
            "scope": "https://www.googleapis.com/auth/drive.readonly",
        }
    )
    requests = []

    def handler(request):
        requests.append(request)
        if request.url.path.endswith("/about"):
            return httpx.Response(200, json={"user": {"permissionId": "drive-account"}})
        assert request.url.path.endswith("/files") and request.url.params.get("alt") is None
        return httpx.Response(
            200,
            json={
                "files": [
                    {
                        "id": "file-1",
                        "name": "Design.pdf",
                        "mimeType": "application/pdf",
                        "fileExtension": "pdf",
                        "modifiedTime": "2026-09-06T00:00:00Z",
                        "webViewLink": "https://drive.google.com/file/d/file-1/view",
                    }
                ]
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        connections = CloudConnections(
            repository, cipher, Settings(environment="test"), ProviderHTTP(client), {}
        )
        documents, schedules = MemoryDocuments(repository), MemorySchedules()
        service = CloudCollectionService(repository, connections, documents, schedules)
        created = await service.create(
            CollectionCreate(
                connection_id=repository.conn.id,
                name="Design links",
                mode="reference",
                selection=Selection(folder_id="folder", recursive=True, attachments=False),
            )
        )
        from uuid import UUID

        collection_id = UUID(created["collection_id"])
        started = await service.start(collection_id, "drive-reference")
        result = await service.execute(
            UUID(started["run_id"]), job_id=UUID(started["job_id"]), cancelled=no_cancel
        )
        overlapping = await service.create(
            CollectionCreate(
                connection_id=repository.conn.id,
                name="Overlapping links",
                mode="reference",
                selection=Selection(folder_id="other-folder", attachments=False),
            )
        )
        second = await service.start(UUID(overlapping["collection_id"]), "drive-reference-overlap")
        await service.execute(
            UUID(second["run_id"]), job_id=UUID(second["job_id"]), cancelled=no_cancel
        )

    assert result["status"] == "succeeded" and result["results"][0]["body_stored"] is False
    assert documents.revisions == {}
    assert len(repository.docs) == 1
    document = next(iter(repository.docs.values()))
    assert document.document_metadata["source_url"].endswith("/file-1/view")
    assert document.document_metadata["gather"]["body_stored"] is False
    assert len(document.document_metadata["gather"]["collection_ids"]) == 2
    assert all(request.url.params.get("alt") is None for request in requests)


@pytest.mark.asyncio
async def test_storage_failure_keeps_cursor_and_reuses_committed_first_item():
    async with setup_service(messages=2) as (service, repo, documents, _schedules, _requests):
        _, run_id, job_id = await create_and_start(service, repo)
        documents.fail_after = 1
        with pytest.raises(RuntimeError, match="storage outage"):
            await service.execute(run_id, job_id=job_id, cancelled=no_cancel)
        assert repo.records[run_id].cursor == {} and repo.records[run_id].pages == 0
        assert documents.created_revisions == 1
        documents.fail_after = None
        result = await service.execute(run_id, job_id=job_id, cancelled=no_cancel)
        assert result["status"] == "succeeded" and len(result["results"]) == 2
        assert documents.created_revisions == 2


@pytest.mark.asyncio
async def test_worker_rejects_cross_workspace_and_requester_before_provider_io():
    async with setup_service() as (service, repo, _documents, schedules, requests):
        _, run_id, job_id = await create_and_start(service, repo)
        original_workspace = repo.records[run_id].workspace_id
        repo.records[run_id].workspace_id = uuid4()
        with pytest.raises(NotFoundError):
            await service.execute(run_id, job_id=job_id, cancelled=no_cancel)
        repo.records[run_id].workspace_id = original_workspace
        schedules.jobs[job_id].requested_by_user_id = uuid4()
        with pytest.raises(PermissionDeniedError):
            await service.execute(run_id, job_id=job_id, cancelled=no_cancel)
        assert not requests


@pytest.mark.asyncio
async def test_cancel_before_provider_io_keeps_originals():
    async with setup_service() as (service, repo, _documents, _schedules, requests):
        _, run_id, job_id = await create_and_start(service, repo)
        repo.force_cancel = True
        result = await service.execute(run_id, job_id=job_id, cancelled=no_cancel)
        assert result["status"] == "cancelled" and not requests
        assert not repo.docs and repo.records[run_id].cursor == {}


@pytest.mark.asyncio
async def test_refresh_rotates_encrypted_credentials_without_secret_output():
    repository = MemoryRepository()
    cipher = SecretCipher("test-secret", 1)
    repository.conn.encrypted_credentials = cipher.encrypt(
        {
            "access_token": "expired",
            "expires_at": 1,
            "refresh_token": "old-refresh",
            "scope": "https://www.googleapis.com/auth/gmail.readonly",
        }
    )

    def handler(request):
        assert b"refresh_token=old-refresh" in request.content
        return httpx.Response(
            200,
            json={
                "access_token": "fresh-secret",
                "refresh_token": "rotated-secret",
                "expires_in": 3600,
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        service = CloudConnections(
            repository,
            cipher,
            Settings(environment="test"),
            ProviderHTTP(client),
            {"gmail": OAuthConfig("client", "secret", "https://cloud.example/callback")},
        )
        credentials = await service.refresh(repository.conn, "gmail")
        projection = service.project(repository.conn, "gmail", repository.cloud_state)
    assert credentials["refresh_token"] == "rotated-secret"
    assert b"rotated-secret" not in repository.conn.encrypted_credentials
    assert "fresh-secret" not in str(projection) and "rotated-secret" not in str(projection)
    assert (
        cipher.decrypt_json(repository.conn.encrypted_credentials)["access_token"] == "fresh-secret"
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "health_response,expected_code,delay",
    [
        (lambda: httpx.Response(429, headers={"Retry-After": "120"}), "provider_rate_limited", 120),
        (
            lambda: httpx.Response(302, headers={"location": "https://other.example"}),
            "provider_redirect_rejected",
            None,
        ),
    ],
)
async def test_inspection_errors_retain_classification_through_worker(
    monkeypatch, health_response, expected_code, delay
):
    from app.modules.integration.cloud_http import ProviderError
    from app.worker import integration_handlers
    from app.worker.handlers import PermanentJobError

    async with setup_service(health_response=health_response) as (
        service,
        repo,
        _documents,
        _schedules,
        requests,
    ):
        _, run_id, job_id = await create_and_start(service, repo)

        @asynccontextmanager
        async def services(session, context):
            yield service

        monkeypatch.setattr(integration_handlers, "cloud_services", services)
        expected = ProviderError if delay is not None else PermanentJobError
        with pytest.raises(expected) as caught:
            await integration_handlers.integration_sync(
                {"collection_run_id": str(run_id)},
                session=None,
                context=repo.context,
                job_id=job_id,
                cancelled=no_cancel,
            )
        assert str(caught.value) == expected_code
        if delay is not None:
            assert caught.value.retryable is True and caught.value.retry_after == delay
        assert len(requests) == 1
        assert repo.records[run_id].status == ("retry" if delay is not None else "failed")


class ProcessLost(BaseException):
    """Simulated hard loss: subsequent database writes cannot reach persistence."""


class SnapshotRepository(MemoryRepository):
    def __init__(self):
        super().__init__()
        self.persisted = {}
        self.lost = False
        self.crash_on_page = False

    async def save(self, record):
        import copy

        if self.lost:
            raise ProcessLost()
        await super().save(record)
        if isinstance(record, (CloudCollection, CloudCollectionRun)):
            self.persisted[record.id] = copy.deepcopy(record)
            if self.crash_on_page and isinstance(record, CloudCollectionRun) and record.pages == 1:
                self.lost = True
                raise ProcessLost()

    async def one(self, model, identifier):
        import copy

        record = self.persisted.get(identifier)
        if record is None or record.workspace_id != self.workspace_id:
            raise NotFoundError("integration_record_not_found", "Record not found")
        return copy.deepcopy(record)

    def recovered(self):
        import copy

        clone = SnapshotRepository()
        clone.workspace_id, clone.context = self.workspace_id, copy.deepcopy(self.context)
        clone.conn, clone.cloud_state = copy.deepcopy(self.conn), copy.deepcopy(self.cloud_state)
        clone.persisted = copy.deepcopy(self.persisted)
        clone.records = copy.deepcopy(self.persisted)
        clone.mappings, clone.docs = copy.deepcopy(self.mappings), copy.deepcopy(self.docs)
        return clone


@pytest.mark.asyncio
@pytest.mark.parametrize("crash_point", ["page", "inflight"])
async def test_crash_reload_keeps_consumed_bytes_and_inflight_reservations(crash_point):
    """Separate copied DB snapshots and new services model a process restart."""
    import copy

    from app.modules.integration.cloud_http import ProviderError

    repo = SnapshotRepository()
    cipher = SecretCipher("test-secret", 1)
    repo.conn.encrypted_credentials = cipher.encrypt(
        {
            "access_token": "private-access",
            "scope": "https://www.googleapis.com/auth/gmail.readonly",
        }
    )
    raw = base64.urlsafe_b64encode(b"Subject: source\r\n\r\nbytes").decode()
    responses = []

    def handler(request):
        if request.url.path.endswith("/profile"):
            answer = httpx.Response(200, json={"emailAddress": "source@example.com"})
        elif request.url.path.endswith("/messages"):
            answer = httpx.Response(200, json={"messages": [{"id": "m1"}], "nextPageToken": "next"})
        else:
            answer = httpx.Response(200, json={"id": "m1", "raw": raw})
        responses.append(len(answer.content))
        if crash_point == "inflight":
            # The reservation must already be in a durable, independent snapshot.
            repo.lost = True
            raise ProcessLost()
        return answer

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        connections = CloudConnections(
            repo, cipher, Settings(environment="test"), ProviderHTTP(client), {}
        )
        documents, schedules = MemoryDocuments(repo), MemorySchedules()
        service = CloudCollectionService(repo, connections, documents, schedules)
        collection_id, run_id, job_id = await create_and_start(service, repo)
        collection = await repo.one(CloudCollection, collection_id)
        # First page costs > half the budget; restarting its health request must
        # leave too little for a second page, rather than resetting consumption.
        collection.selection = {**collection.selection, "max_bytes": 220}
        await repo.save(collection)
        repo.crash_on_page = crash_point == "page"
        with pytest.raises(ProcessLost):
            await service.execute(run_id, job_id=job_id, cancelled=no_cancel)
    snapshot = copy.deepcopy(repo.persisted[run_id])
    if crash_point == "page":
        assert snapshot.pages == 1 and snapshot.cursor == {"page": "next"}
        assert snapshot.bytes_read == sum(responses)
        assert snapshot.bytes_read > 0
    else:
        assert snapshot.bytes_read == 220 and snapshot.pages == 0
    recovered = repo.recovered()
    assert recovered.persisted[run_id] is not repo.persisted[run_id]
    seen_after_restart = []
    received_after_restart = []

    def resumed_handler(request):
        seen_after_restart.append(request)
        # Spend exactly the independently persisted remaining allowance on a
        # valid health response. The next page must fail before a second request.
        assert request.url.path.endswith("/profile")
        remaining = 220 - snapshot.bytes_read
        payload = b'{"emailAddress":"a"}'
        assert remaining >= len(payload)
        payload += b" " * (remaining - len(payload))
        received_after_restart.append(len(payload))
        return httpx.Response(200, content=payload)

    async with httpx.AsyncClient(transport=httpx.MockTransport(resumed_handler)) as client:
        http = ProviderHTTP(client)
        connections = CloudConnections(recovered, cipher, Settings(environment="test"), http, {})
        recovered_documents = MemoryDocuments(recovered)
        recovered_documents.revisions = copy.deepcopy(documents.revisions)
        service = CloudCollectionService(recovered, connections, recovered_documents, schedules)
        with pytest.raises(ProviderError, match="collection_byte_limit"):
            await service.execute(run_id, job_id=job_id, cancelled=no_cancel)
        assert snapshot.bytes_read + http.bytes_read <= 220
        assert snapshot.bytes_read + sum(received_after_restart) <= 220
        if crash_point == "page":
            assert sum(responses) + sum(received_after_restart) == 220
            assert len(seen_after_restart) == 1
    final = recovered.persisted[run_id]
    assert final.bytes_read == 220
    assert final.pages == snapshot.pages and final.cursor == snapshot.cursor
    if crash_point == "inflight":
        assert not seen_after_restart
