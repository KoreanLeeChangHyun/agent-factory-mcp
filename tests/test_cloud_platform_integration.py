"""Actual migrated PostgreSQL, non-owner RLS, HTTP/MCP and durable worker integration.

Run only via scripts/verify-cloud-platform.sh. No application DB fallback.
Provider fixtures replace HTTP transport, not adapters or persistence.
"""
import asyncio
import base64
import io
import json
import os
import socket
import subprocess
import zipfile
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from pathlib import Path
from types import SimpleNamespace
from uuid import UUID, uuid4

import httpx
import pytest
import pytest_asyncio
import uvicorn
from sqlalchemy import delete, select, text, update
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

pytestmark = [pytest.mark.integration, pytest.mark.asyncio]


class IsolatedObjects:
    """Filesystem-backed test adapter preserving the same opaque key/byte contract."""
    def __init__(self, root):
        self.root = root
        self.fail_put = False
    def path(self, key):
        return self.root / sha256(key.encode()).hexdigest()
    async def put(self, key, content, media_type):
        if self.fail_put:
            raise OSError('injected object write failure')
        self.path(key).write_bytes(content)
    async def get(self, key):
        return self.path(key).read_bytes()
    async def delete(self, key):
        raise AssertionError('recovery must retain objects')


@pytest_asyncio.fixture
async def platform(monkeypatch, tmp_path):
    url, admin_url = os.environ.get('CLOUD_TEST_DATABASE_URL'), os.environ.get('CLOUD_TEST_ADMIN_DATABASE_URL')
    if not url or not admin_url:
        pytest.skip('requires newly created disposable cloud platform PostgreSQL')
    assert '/cloud_platform_test' in url and '@127.0.0.1:' in url
    assert os.environ['AGENT_FACTORY_DATABASE_URL'] == url
    from app.core.config import settings
    monkeypatch.setattr(settings, "public_base_url", "https://cloud.example.test")
    from app.db import models
    from app.db.session import dispose_engine
    from app.modules.auth.crypto import token_digest
    from app.modules.auth.models import ApiToken, AuthSession
    from app.modules.identity.models import User
    from app.modules.organization.models import Organization, OrganizationMembership
    from app.modules.organization.system_roles import ORGANIZATION_OWNER_ROLE_ID, WORKSPACE_OWNER_ROLE_ID
    from app.modules.workspace.models import Workspace, WorkspaceMembership
    from app.modules.mcp_connection.models import MCPConnection
    admin = create_async_engine(admin_url)
    sessions = async_sessionmaker(admin, expire_on_commit=False)
    user, org, workspace, other = uuid4(), uuid4(), uuid4(), uuid4()
    now = datetime.now(UTC)
    tokens = {name: 'afm_' + uuid4().hex for name in ('writer', 'reader', 'expired', 'revoked', 'template_reader', 'scope_only')}
    browser_cookie = uuid4().hex
    async with sessions() as session:
        session.add(User(id=user, email=f'{user}@example.com', display_name='클라우드 테스트'))
        session.add(Organization(id=org, name='Cloud Test', slug=str(org), is_personal=True))
        await session.flush()
        session.add(OrganizationMembership(organization_id=org, user_id=user, role_id=ORGANIZATION_OWNER_ROLE_ID))
        session.add_all([Workspace(id=w, organization_id=org, name=str(w), slug=str(w)) for w in (workspace, other)])
        await session.flush()
        session.add_all([WorkspaceMembership(workspace_id=w, user_id=user, role_id=WORKSPACE_OWNER_ROLE_ID) for w in (workspace, other)])
        for name, raw in tokens.items():
            record = ApiToken(user_id=user, name=name,
                token_digest=token_digest(raw, settings.auth_token_secret.get_secret_value()),
                scopes=(['workspace:read'] if name == 'scope_only' else
                        ['workspace:read', 'document:read'] if name == 'template_reader' else
                        ['workspace:read', 'document:read', 'integration:read', 'agent:read'] + (
                    ['document:write', 'integration:manage', 'agent:report', 'schedule:write'] if name != 'reader' else [])),
                expires_at=now + timedelta(days=-1 if name == 'expired' else 1),
                revoked_at=now if name == 'revoked' else None)
            session.add(record)
            await session.flush()
            session.add(MCPConnection(user_id=user, organization_id=org, workspace_id=workspace, token_id=record.id, name=name))
        session.add(AuthSession(user_id=user, token_digest=token_digest(browser_cookie, settings.auth_token_secret.get_secret_value()),
                               expires_at=now + timedelta(days=1)))
        await session.commit()
    objects = IsolatedObjects(tmp_path)
    from app.mcp import documents
    from app.router import cloud_documents
    from app.router import documents as ordinary_routes
    from app.modules.integration import cloud_factory
    monkeypatch.setattr(documents, 'S3ObjectStorage', lambda _: objects)
    monkeypatch.setattr(cloud_documents, 'S3ObjectStorage', lambda _: objects)
    monkeypatch.setattr(ordinary_routes, 'S3ObjectStorage', lambda _: objects)
    monkeypatch.setattr(cloud_factory, 'S3ObjectStorage', lambda _: objects)
    from app.infrastructure.job_queue import CeleryJobPublisher
    published = []
    def publish(self, job, countdown=None):
        published.append((job.id, countdown))
        return str(uuid4())
    monkeypatch.setattr(CeleryJobPublisher, 'publish', publish)
    # Any actual provider request must use our explicit transport fixture.
    provider_requests = []
    provider_hook = SimpleNamespace(callback=None)
    async def provider_response(request):
        provider_requests.append(request)
        if provider_hook.callback:
            response = await provider_hook.callback(request)
            if response is not None:
                return response
        if request.url.path == '/api/v10/users/@me':
            return httpx.Response(200, json={'id': '111', 'username': 'fixture'})
        if request.url.path == '/api/v10/channels/123/messages':
            return httpx.Response(200, json=[{'id': '456', 'content': '한국어 source_run_1', 'attachments': []}])
        raise AssertionError(f'unexpected provider route: {request.url.host}{request.url.path}')
    provider_client = httpx.AsyncClient(transport=httpx.MockTransport(provider_response), trust_env=False)
    from app.modules.integration.cloud_http import ProviderHTTP
    monkeypatch.setattr(cloud_factory, 'ProviderHTTP', lambda _: ProviderHTTP(provider_client))
    from app.main import create_app
    app = create_app()
    sock = socket.socket()
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
    server = uvicorn.Server(uvicorn.Config(app, host='127.0.0.1', port=port, log_level='warning', lifespan='on'))
    task = asyncio.create_task(server.serve(sockets=[sock]))
    try:
        for _ in range(100):
            if server.started:
                break
            if task.done():
                await task
            await asyncio.sleep(.05)
        assert server.started
        async with httpx.AsyncClient(base_url=f'http://127.0.0.1:{port}', trust_env=False, timeout=60) as client:
            yield SimpleNamespace(client=client, url=str(client.base_url).rstrip('/'), admin=sessions,
                user=user, org=org, workspace=workspace, other=other, tokens=tokens, objects=objects,
                published=published, requests=provider_requests, provider_hook=provider_hook,
                cookie=browser_cookie, settings=settings)
    finally:
        server.should_exit = True
        await task
        await provider_client.aclose()
        await admin.dispose()
        await dispose_engine()


async def rpc(p, method, params=None, *, token='writer', workspace=None):
    headers = {'Accept': 'application/json, text/event-stream', 'MCP-Protocol-Version': '2026-07-28', 'MCP-Method': method}
    if token:
        headers['Authorization'] = 'Bearer ' + p.tokens[token]
    if params and 'name' in params:
        headers['MCP-Name'] = params['name']
    return await p.client.post(f'/mcp/workspaces/{workspace or p.workspace}/', headers=headers,
        json={'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': {
            '_meta': {'io.modelcontextprotocol/protocolVersion': '2026-07-28',
                'io.modelcontextprotocol/clientCapabilities': {},
                'io.modelcontextprotocol/clientInfo': {'name': 'cloud-disposable', 'version': '1'}}, **(params or {})}})


def decoded(response):
    assert response.status_code == 200, response.text
    if response.headers.get('content-type', '').startswith('text/event-stream'):
        message = next(json.loads(line[5:].strip()) for line in response.text.splitlines() if line.startswith('data:'))
    else:
        message = response.json()
    assert 'error' not in message, message
    return message['result']


async def call(p, name, arguments, *, error=False, **kwargs):
    result = decoded(await rpc(p, 'tools/call', {'name': name, 'arguments': arguments}, **kwargs))
    assert bool(result.get('isError')) == error, result
    if result.get('structuredContent') is not None:
        return result['structuredContent']
    return json.loads(result['content'][0]['text'])


def metadata(raw, *, slug=None, **extra):
    return dict(schema_version='1', idempotency_key=uuid4().hex, expected_revision=0,
        title='cloud.md', slug=slug or 'cloud-' + uuid4().hex, document_type='processed',
        filename='cloud.md', media_type='text/markdown', source_sha256=sha256(raw).hexdigest(),
        source_identity='fixture:cloud-source', collection_context='Disposable HTTP source fixture', **extra)


async def test_http_mcp_auth_scope_rls_and_import_races(platform):
    p = platform
    for token in (None, 'expired', 'revoked'):
        assert (await rpc(p, 'tools/list', token=token)).status_code == 401
    assert (await rpc(p, 'tools/list', workspace=p.other)).status_code == 403
    names = {tool['name'] for tool in decoded(await rpc(p, 'tools/list'))['tools']}
    assert {'document_prepare_upload', 'document_finalize_upload', 'collection_start', 'reporting_write'} <= names
    raw = '한국어 cloud_run_123_a'.encode()
    request = {**metadata(raw), 'content_base64': base64.b64encode(raw).decode()}
    await call(p, 'document_import', {'request': request}, token='reader', error=True)
    await call(p, 'integration_token_set', {'connection_id': str(uuid4()), 'token': 'fixture', 'approved_scopes': []}, token='reader', error=True)
    first, retry = await asyncio.gather(*(call(p, 'document_import', {'request': request}) for _ in range(2)))
    assert first == retry
    writes = [{**request, 'document_id': first['document_id'], 'expected_revision': 1, 'idempotency_key': uuid4().hex} for _ in range(2)]
    responses = await asyncio.gather(*(rpc(p, 'tools/call', {'name': 'document_import', 'arguments': {'request': item}}) for item in writes))
    assert sorted(bool(decoded(r).get('isError')) for r in responses) == [False, True]
    for query in ('한국어', 'cloud_run_123_a'):
        found = await call(p, 'document_search', {'request': {'schema_version': '1', 'query': query}})
        assert found['hits']
    from app.db.session import get_session_factory
    from app.db.tenant import TenantContext, apply_tenant_context
    from app.modules.document.cloud_models import DocumentImport
    async with get_session_factory()() as session:
        assert (await session.execute(text('SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user'))).one() == (False, False)
        await apply_tenant_context(session, TenantContext(p.user, p.org, p.other))
        assert not list(await session.scalars(select(DocumentImport)))


@pytest.mark.parametrize("skill", ["document", "agent", "template", "synthetic-large"])
async def test_large_git_inventory_binary_upload_expiry_digest_and_preview(platform, skill):
    from cloud_source_inventory import assert_same_bytes, git_source_files, template_source_files
    p = platform
    root = Path(__file__).resolve().parents[2] / 'plugin'
    if skill == 'template':
        files = template_source_files()
    elif skill == 'synthetic-large':
        # Explicit capacity regression, not padding or a claim about actual source.
        files = {'capacity.bin': b'capacity-fixture-' * (600 * 1024),
                 'index.html': '<html lang="ko"><body>합성 용량 시험</body></html>'.encode()}
        assert sum(map(len, files.values())) > 8 * 1024 * 1024
    else:
        files = git_source_files(root, f'skills/{skill}', f'.agent-factory/document/specification/{skill}')
        assert f'skills/{skill}/SKILL.md' in files
        assert f'.agent-factory/document/specification/{skill}/index.html' in files
    assert sum(map(len, files.values())) > 256 * 1024
    # Exact source inventory only. Original snapshot ingestion is not pair acceptance.
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, 'w', zipfile.ZIP_STORED) as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    raw = stream.getvalue()
    request = metadata(raw)
    request.update(document_type='original', filename='source.zip', media_type='application/zip', size_bytes=len(raw))
    intent = await call(p, 'document_prepare_upload', {'request': request})
    headers = {'Authorization': 'Bearer ' + p.tokens['writer'], intent['header']: intent['capability']}
    assert (await p.client.put(intent['path'], content=raw, headers={intent['header']: intent['capability']})).status_code in (401, 403)
    assert (await p.client.put(intent['path'], content=raw[:-1] + b'!', headers=headers)).status_code == 400
    assert (await p.client.put(intent['path'], content=raw, headers=headers)).status_code == 200
    from app.modules.document.delivery_models import DocumentUpload
    async with p.admin() as session:
        await session.execute(update(DocumentUpload).where(DocumentUpload.id == UUID(intent['upload_id'])).values(expires_at=datetime.now(UTC)-timedelta(seconds=1)))
        await session.commit()
    await call(p, 'document_finalize_upload', {'request': {'schema_version': '1', 'upload_id': intent['upload_id']}}, error=True)
    renewed = await call(p, 'document_prepare_upload', {'request': request})
    assert renewed['upload_id'] == intent['upload_id']
    capability_rotated = renewed['capability'] != intent['capability']
    assert capability_rotated, 'Upload capability must rotate on renewal'
    receipt = await call(p, 'document_finalize_upload', {'request': {'schema_version': '1', 'upload_id': intent['upload_id']}})
    async with p.admin() as session:
        await session.execute(update(DocumentUpload).where(DocumentUpload.id == UUID(intent['upload_id'])).values(expires_at=datetime.now(UTC)-timedelta(seconds=1)))
        await session.commit()
    assert receipt == await call(p, 'document_finalize_upload', {'request': {'schema_version': '1', 'upload_id': intent['upload_id']}})
    from app.modules.document.models import DocumentRevision
    async with p.admin() as session:
        revision = await session.get(DocumentRevision, UUID(receipt['revision_id']))
        stored = await p.objects.get(revision.storage_key)
    assert_same_bytes(stored, raw, skill)
    with zipfile.ZipFile(io.BytesIO(stored)) as archive:
        assert set(archive.namelist()) == set(files)
        for name, value in files.items():
            member_bytes = archive.read(name)
            assert_same_bytes(member_bytes, value, name)
    p.client.cookies.set(p.settings.session_cookie_name, p.cookie)
    base = f'/api/organizations/{p.org}/workspaces/{p.workspace}/cloud-documents/{receipt["document_id"]}/revisions/1/package'
    preview = await p.client.get(base + '/preview')
    from app.modules.document.preview import PREVIEW_HEADERS
    if 'index.html' in files:
        assert preview.status_code == 200
        assert all(preview.headers.get(k) == v for k, v in PREVIEW_HEADERS.items())
        member_path = 'index.html'
    else:
        # A raw Git snapshot has no top-level entry or accepted pair metadata.
        # Preserve its exact bytes rather than adding a fake preview document.
        assert preview.status_code == 422
        member_path = f'.agent-factory/document/specification/{skill}/index.html'
    member = await p.client.get(base + '/member', params={'path': member_path})
    assert member.status_code == 200
    assert_same_bytes(member.content, files[member_path], member_path)
    assert member.headers['x-frame-options'] == 'DENY'
    assert member.headers['content-type'] == 'application/octet-stream'
    p.client.cookies.clear()
    denied = await p.client.get(base + '/preview')
    assert denied.status_code in (401, 403) and denied.headers['x-frame-options'] == 'DENY'


async def collection(p, *, name=None):
    from app.modules.integration.models import IntegrationConnection, IntegrationProvider, IntegrationAuthType
    async with p.admin() as session:
        provider = await session.scalar(select(IntegrationProvider).where(IntegrationProvider.key == 'discord'))
        if provider is None:
            provider = IntegrationProvider(key='discord', display_name='Discord', auth_type=IntegrationAuthType.API_KEY)
            session.add(provider)
            await session.flush()
        connection = IntegrationConnection(workspace_id=p.workspace, provider_id=provider.id, name=name or uuid4().hex)
        session.add(connection)
        await session.commit()
        connection_id = str(connection.id)
    await call(p, 'integration_token_set', {'connection_id': connection_id, 'token': 'fixture-token-only', 'approved_scopes': []})
    created = await call(p, 'collection_create', {'request': {'connection_id': connection_id, 'name': name or uuid4().hex,
        'selection': {'channel_id': '123', 'max_items': 10, 'max_pages': 2, 'max_bytes': 100000, 'attachments': False}}})
    return connection_id, created['collection_id']


async def execute(p, job_id):
    from app.worker.tasks import _execute_job
    # Intentionally false queue identities: only the durable job authorizes execution.
    return await _execute_job(UUID(job_id), uuid4(), uuid4(), uuid4())


async def test_collection_acceptance_durable_cursor_fresh_runs_and_secret_projection(platform):
    p = platform
    connection_id, collection_id = await collection(p)
    key = uuid4().hex
    started = await call(p, 'collection_start', {'collection_id': collection_id, 'request_key': key})
    assert started['status'] == 'queued' and not p.requests
    assert started == await call(p, 'collection_start', {'collection_id': collection_id, 'request_key': key})
    projection = decoded(await rpc(p, 'tools/call', {'name': 'integration_list', 'arguments': {}}))
    text_result = json.dumps(projection)
    assert 'encrypted_credentials' not in text_result and 'encryption_key_version' not in text_result
    assert 'fixture-token-only' not in text_result
    assert await execute(p, started['job_id']) == 'succeeded'
    first = await call(p, 'collection_results', {'run_id': started['run_id']})
    assert first['status'] == 'succeeded' and len(first['results']) == 1
    assert await execute(p, started['job_id']) == 'ignored'
    fresh = await call(p, 'collection_start', {'collection_id': collection_id, 'request_key': uuid4().hex})
    assert fresh['run_id'] != started['run_id']
    assert await execute(p, fresh['job_id']) == 'succeeded'
    second = await call(p, 'collection_results', {'run_id': fresh['run_id']})
    assert second['results'][0]['revision_number'] == first['results'][0]['revision_number']
    assert second['results'][0]['changed'] is False
    from app.modules.integration.cloud_models import CloudCollectionRun, CloudSourceMapping
    from app.modules.document.models import DocumentRevision
    async with p.admin() as session:
        run = await session.get(CloudCollectionRun, UUID(fresh['run_id']))
        assert run.cursor == {'page': '456'}
        mapping = await session.scalar(select(CloudSourceMapping).where(CloudSourceMapping.collection_id == UUID(collection_id)))
        revision = await session.scalar(select(DocumentRevision).where(DocumentRevision.document_id == mapping.document_id))
        assert revision.revision_number == mapping.revision_number
        assert (await p.objects.get(revision.storage_key)) and revision.sha256 == first['results'][0]['sha256']


async def test_pending_cancellation_and_execution_authority(platform):
    p = platform
    _, collection_id = await collection(p)
    run = await call(p, 'collection_start', {'collection_id': collection_id, 'request_key': uuid4().hex})
    await call(p, 'collection_cancel', {'run_id': run['run_id']})
    assert await execute(p, run['job_id']) == 'cancelled'
    assert not p.requests
    second = await call(p, 'collection_start', {'collection_id': collection_id, 'request_key': uuid4().hex})
    from app.modules.workspace.models import Workspace, WorkspaceStatus
    async with p.admin() as session:
        await session.execute(update(Workspace).where(Workspace.id == p.workspace).values(status=WorkspaceStatus.INACTIVE))
        await session.commit()
    assert await execute(p, second['job_id']) == 'failed'
    assert not p.requests
    from app.modules.integration.cloud_models import CloudCollectionRun
    async with p.admin() as session:
        assert (await session.get(CloudCollectionRun, UUID(second['run_id']))).status == 'failed'


async def test_worker_concurrency_connection_guard_cancel_exception_and_recovery(platform):
    p = platform
    connection_id, collection_id = await collection(p)
    one = await call(p, 'collection_start', {'collection_id': collection_id, 'request_key': uuid4().hex})
    two = await call(p, 'collection_start', {'collection_id': collection_id, 'request_key': uuid4().hex})
    reached, release = asyncio.Event(), asyncio.Event()
    async def block(request):
        if request.url.path.endswith('/messages'):
            reached.set()
            await release.wait()
            return httpx.Response(429, headers={'Retry-After': '120'}, json={'message': 'fixture rejection'})
    p.provider_hook.callback = block
    active = asyncio.create_task(execute(p, one['job_id']))
    await asyncio.wait_for(reached.wait(), 10)
    assert await execute(p, one['job_id']) == 'ignored'
    assert await execute(p, two['job_id']) == 'retry'
    # Legacy disconnect shares the exact collection advisory guard.
    p.client.cookies.set(p.settings.session_cookie_name, p.cookie)
    p.client.cookies.set('agent_factory_csrf', 'fixture-csrf')
    response = await p.client.delete(f'/api/organizations/{p.org}/workspaces/{p.workspace}/integrations/{connection_id}',
                                   headers={'X-CSRF-Token': 'fixture-csrf'})
    assert response.status_code == 409
    await call(p, 'collection_cancel', {'run_id': one['run_id']})
    release.set()
    assert await active == 'cancelled'
    p.provider_hook.callback = None
    # Persisted RUNNING with no lifetime claim models abrupt process loss.
    from app.modules.schedule.models import Job, JobStatus
    async with p.admin() as session:
        await session.execute(update(Job).where(Job.id == UUID(two['job_id'])).values(
            status=JobStatus.RUNNING, started_at=datetime.now(UTC)-timedelta(hours=1)))
        await session.commit()
    assert await execute(p, two['job_id']) == 'succeeded'
    assert (await call(p, 'collection_results', {'run_id': two['run_id']}))['results']


async def test_retry_after_final_failure_and_cursor_before_object_durability(platform):
    p = platform
    _, collection_id = await collection(p)
    run = await call(p, 'collection_start', {'collection_id': collection_id, 'request_key': uuid4().hex})
    async def limited(request):
        return httpx.Response(429, headers={'Retry-After': '120'}, json={'message': 'fixture'})
    p.provider_hook.callback = limited
    assert await execute(p, run['job_id']) == 'retry'
    assert p.published[-1][1] >= 120
    from app.modules.schedule.models import Job
    from app.modules.integration.cloud_models import CloudCollectionRun
    async with p.admin() as session:
        await session.execute(update(Job).where(Job.id == UUID(run['job_id'])).values(
            max_attempts=2, next_attempt_at=datetime.now(UTC)-timedelta(seconds=1)))
        await session.commit()
    assert await execute(p, run['job_id']) == 'dead'
    async with p.admin() as session:
        record = await session.get(CloudCollectionRun, UUID(run['run_id']))
        assert record.status == 'failed' and record.cursor == {}
    p.provider_hook.callback = None
    fresh = await call(p, 'collection_start', {'collection_id': collection_id, 'request_key': uuid4().hex})
    p.objects.fail_put = True
    assert await execute(p, fresh['job_id']) == 'retry'
    async with p.admin() as session:
        record = await session.get(CloudCollectionRun, UUID(fresh['run_id']))
        assert record.cursor == {} and record.pages == 0 and not record.results


async def test_pair_rejection_keeps_publication_and_reporting_heartbeat(platform, monkeypatch):
    p = platform
    from test_cloud_documents import pair_fixture, archive
    files, pair = pair_fixture()
    # Synthetic fixture review is test input, never evidence accepting a real Specification.
    raw = archive(files)
    request = metadata(raw, slug='source')
    request.update(document_type='specification', filename='source.zip', media_type='application/zip',
                   pair=pair.model_dump(mode='json'), content_base64=base64.b64encode(raw).decode())
    first = await call(p, 'document_import', {'request': request})
    broken = {**files}
    broken.pop('human/source/app.js')
    raw_bad = archive(broken)
    bad = {**request, 'document_id': first['document_id'], 'expected_revision': 1, 'idempotency_key': uuid4().hex,
           'source_sha256': sha256(raw_bad).hexdigest(), 'content_base64': base64.b64encode(raw_bad).decode()}
    await call(p, 'document_import', {'request': bad}, error=True)
    from app.modules.document.models import Document
    async with p.admin() as session:
        document = await session.get(Document, UUID(first['document_id']))
        assert document.current_revision_number == 1 and document.document_metadata['cloud_pair_revision'] == 1
    # A reporting recipient must never enter the legacy execution service.
    from app.modules.agent.service import AgentService
    async def forbidden(*args, **kwargs):
        raise AssertionError('cloud reporting attempted legacy execution')
    monkeypatch.setattr(AgentService, 'create_run', forbidden)
    agent_id, task_id = str(uuid4()), str(uuid4())
    await call(p, 'reporting_write', {'command': {'key': uuid4().hex, 'operation': 'agent', 'agent': {
        'id': agent_id, 'revision': 0, 'name': '한국어 cloud_run_1', 'role': 'work', 'responsibilities': 'fixture'}}})
    binding = dict(project_ref='fixture', agent_id='work', session_id='session-1', run_id='run-1')
    await call(p, 'reporting_write', {'command': {'key': uuid4().hex, 'operation': 'task', 'task': {
        'id': task_id, 'agent_id': agent_id, 'name': 'cloud_run_1', 'runtime_binding': binding}}})
    heartbeat = {'key': uuid4().hex, 'operation': 'heartbeat', 'heartbeat': {'id': task_id, 'runtime_binding': binding,
        'sequence': 1, 'observed_at': datetime.now(UTC).isoformat(), 'fact': 'process_alive'}}
    result = await call(p, 'reporting_write', {'command': heartbeat})
    assert result == await call(p, 'reporting_write', {'command': heartbeat})
    from app.modules.reporting.models import ReportTask
    async with p.admin() as session:
        task = await session.get(ReportTask, UUID(task_id))
        assert task.revision == 1 and task.runtime_observation['sequence'] == 1
    assert not p.published
    found = await call(p, 'reporting_search', {'request': {'query': 'cloud_run_1', 'kind': 'task'}})
    assert found


async def test_new_write_token_issuance_and_current_permission_boundary(platform):
    p = platform
    p.client.cookies.set(p.settings.session_cookie_name, p.cookie)
    p.client.cookies.set('agent_factory_csrf', 'fixture-csrf')
    headers = {'X-CSRF-Token': 'fixture-csrf'}
    request = dict(name='new mutation credential', scopes=['workspace:read', 'document:write', 'integration:manage'], expires_in_days=1)
    assert (await p.client.post('/api/auth/tokens', json=request, headers=headers)).status_code in (401, 403)
    request.update(organization_id=str(p.org), workspace_id=str(p.workspace))
    response = await p.client.post('/api/auth/tokens', json=request, headers=headers)
    assert response.status_code == 200, response.text
    assert set(response.json()['scopes']) == set(request['scopes'])
    assert (await rpc(p, 'tools/list', token='reader')).status_code == 200
    from app.modules.organization.models import OrganizationMembership
    from app.modules.organization.system_roles import VIEWER_ROLE_ID
    async with p.admin() as session:
        from app.modules.workspace.models import WorkspaceMembership
        await session.execute(update(WorkspaceMembership).where(WorkspaceMembership.user_id == p.user,
            WorkspaceMembership.workspace_id == p.workspace).values(role_id=VIEWER_ROLE_ID))
        await session.commit()
    assert (await p.client.post('/api/auth/tokens', json=request, headers=headers)).status_code == 403
    raw = b'no permission'
    await call(p, 'document_import', {'request': {**metadata(raw), 'content_base64': base64.b64encode(raw).decode()}}, error=True)


async def test_oauth_same_user_state_denial_expiry_and_clean_response(platform, monkeypatch, caplog):
    p = platform
    from pydantic import SecretStr
    from urllib.parse import parse_qs, urlsplit
    monkeypatch.setattr(p.settings, 'public_base_url', 'https://cloud.example.test')
    monkeypatch.setattr(p.settings, 'gmail_oauth_client_id', 'fixture-client')
    monkeypatch.setattr(p.settings, 'gmail_oauth_client_secret', SecretStr('fixture-secret'))
    monkeypatch.setattr(p.settings, 'gmail_oauth_redirect_uri', 'https://cloud.example.test/api/integrations/oauth/gmail/callback')
    from app.modules.integration.models import IntegrationConnection, IntegrationProvider, IntegrationOAuthState
    async with p.admin() as session:
        provider = await session.scalar(select(IntegrationProvider).where(IntegrationProvider.key == 'gmail'))
        record = IntegrationConnection(workspace_id=p.workspace, provider_id=provider.id, name='OAuth fixture')
        session.add(record)
        await session.commit()
        connection_id = str(record.id)
    async def begin():
        result = await call(p, 'integration_oauth_begin', {'connection_id': connection_id,
            'scopes': ['https://www.googleapis.com/auth/gmail.readonly']})
        return parse_qs(urlsplit(result['authorization_url']).query)['state'][0]
    state = await begin()
    code = 'fixture-code-never-log'
    response = await p.client.get('/api/integrations/oauth/gmail/callback', params={'state': state, 'code': code})
    assert response.status_code == 303 and not p.requests
    p.client.cookies.set(p.settings.session_cookie_name, p.cookie)
    async def exchange(request):
        if request.url.host == 'oauth2.googleapis.com' and request.url.path == '/token':
            assert code.encode() in request.content
            return httpx.Response(200, json={'access_token': 'fixture-access-token',
                'scope': 'https://www.googleapis.com/auth/gmail.readonly', 'token_type': 'Bearer'})
    p.provider_hook.callback = exchange
    response = await p.client.get('/api/integrations/oauth/gmail/callback', params={'state': state, 'code': code})
    assert response.status_code == 303
    assert response.headers['location'] == 'https://cloud.example.test/workspace/'
    assert response.headers['cache-control'] == 'no-store' and response.headers['referrer-policy'] == 'no-referrer'
    assert len(p.requests) == 1
    await p.client.get('/api/integrations/oauth/gmail/callback', params={'state': state, 'code': code})
    assert len(p.requests) == 1
    denied = await begin()
    await p.client.get('/api/integrations/oauth/gmail/callback', params={'state': denied, 'error': 'access_denied'})
    await p.client.get('/api/integrations/oauth/gmail/callback', params={'state': denied, 'code': code})
    assert len(p.requests) == 1
    expired = await begin()
    async with p.admin() as session:
        await session.execute(update(IntegrationOAuthState).where(IntegrationOAuthState.user_id == p.user,
            IntegrationOAuthState.consumed_at.is_(None)).values(expires_at=datetime.now(UTC)-timedelta(seconds=1)))
        await session.commit()
    await p.client.get('/api/integrations/oauth/gmail/callback', params={'state': expired, 'code': code})
    assert len(p.requests) == 1
    assert code not in caplog.text and 'fixture-access-token' not in caplog.text


async def test_current_editor_with_real_http_and_document(platform):
    p = platform
    raw = '# 현재 편집기\n한국어 editor_run_1\n'.encode()
    receipt = await call(p, 'document_import', {'request': {**metadata(raw), 'content_base64': base64.b64encode(raw).decode()}})
    env = {**os.environ, 'CLOUD_BROWSER_URL': p.url, 'CLOUD_BROWSER_COOKIE': p.cookie,
           'CLOUD_BROWSER_COOKIE_NAME': p.settings.session_cookie_name,
           'CLOUD_BROWSER_WORKSPACE': str(p.workspace), 'CLOUD_BROWSER_DOCUMENT': receipt['document_id']}
    process = await asyncio.create_subprocess_exec('node', 'tests/browser/cloud-platform.cjs', env=env,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT)
    output, _ = await asyncio.wait_for(process.communicate(), 90)
    assert process.returncode == 0, output.decode()


async def test_claimed_collection_rejects_payload_identity_injection(platform):
    p = platform
    _, collection_id = await collection(p)
    run = await call(p, 'collection_start', {'collection_id': collection_id, 'request_key': uuid4().hex})
    from app.modules.schedule.models import Job
    async with p.admin() as session:
        await session.execute(update(Job).where(Job.id == UUID(run['job_id'])).values(
            payload={'collection_run_id': run['run_id'], 'workspace_id': str(p.other)}))
        await session.commit()
    assert await execute(p, run['job_id']) == 'failed'
    assert not p.requests


@pytest.mark.parametrize('complete_before_cancel', [False, True], ids=['claimed', 'succeeded'])
async def test_cancellation_refreshes_cached_job_under_lock(platform, complete_before_cancel):
    """A second real session advances the Job after the canceller cached QUEUED."""
    p = platform
    _, collection_id = await collection(p)
    run = await call(p, 'collection_start', {'collection_id': collection_id, 'request_key': uuid4().hex})
    job_id = UUID(run['job_id'])
    from app.common.errors import ConflictError
    from app.db.session import get_session_factory
    from app.db.tenant import TenantContext, apply_tenant_context
    from app.infrastructure.job_queue import CeleryJobPublisher
    from app.modules.schedule.models import JobStatus
    from app.modules.schedule.repository import ScheduleRepository
    from app.modules.schedule.service import ScheduleService
    from app.worker.authority import authorize_job, control_scope

    async with get_session_factory()() as canceller:
        await control_scope(canceller)
        repository = ScheduleRepository(canceller)
        cached = await repository.get_job(p.workspace, job_id)
        assert cached.status == JobStatus.QUEUED
        context = await authorize_job(canceller, cached)
        # Use another non-owner application session and actual repository claim.
        async with get_session_factory()() as worker:
            await apply_tenant_context(worker, TenantContext(p.user, p.org, p.workspace))
            worker_repository = ScheduleRepository(worker)
            claimed = await worker_repository.claim_job(p.workspace, job_id)
            assert claimed is not None and claimed.status == JobStatus.RUNNING
            if complete_before_cancel:
                claimed.status = JobStatus.SUCCEEDED
                claimed.result = {'completed': True}
                claimed.finished_at = datetime.now(UTC)
                await worker_repository.append_event(claimed, 'job.succeeded', {})
            finished_at, result = claimed.finished_at, claimed.result
            await worker_repository.commit()
        assert cached.status == JobStatus.QUEUED  # Keep the stale identity-map instance alive.
        service = ScheduleService(repository, CeleryJobPublisher(), p.settings)
        if complete_before_cancel:
            with pytest.raises(ConflictError) as error:
                await service.cancel(context, job_id)
            assert error.value.code == 'job_not_cancellable'
            await canceller.rollback()
        else:
            cancelled = await service.cancel(context, job_id)
            assert cancelled is cached and cancelled.status == JobStatus.CANCEL_REQUESTED

    async with get_session_factory()() as observer:
        await apply_tenant_context(observer, TenantContext(p.user, p.org, p.workspace))
        repository = ScheduleRepository(observer)
        persisted = await repository.get_job(p.workspace, job_id)
        events = await repository.list_events(p.workspace, job_id)
        assert persisted.status == (JobStatus.SUCCEEDED if complete_before_cancel else JobStatus.CANCEL_REQUESTED)
        assert persisted.finished_at == finished_at and persisted.result == result
        assert persisted.attempt_count == 1
        assert [event.event_type for event in events] == [
            'job.queued', 'job.running',
            'job.succeeded' if complete_before_cancel else 'job.cancel_requested',
        ]
    assert not p.requests


async def template_transport_result(response):
    """Decode actual MCP data without placing base64 or credentials in diagnostics."""
    status = response.status_code
    assert status == 200, f'template HTTP status {status}'
    try:
        if response.headers.get('content-type', '').startswith('text/event-stream'):
            message = next(json.loads(line[5:].strip()) for line in response.text.splitlines()
                           if line.startswith('data:'))
        else:
            message = response.json()
        has_rpc_error = 'error' in message
        assert not has_rpc_error, 'template RPC returned an error'
        result = message['result']
        failed = bool(result.get('isError'))
        assert not failed, 'template tool returned an error'
        data_only = all(item.get('type') == 'text' for item in result.get('content', []))
        assert data_only, 'template response must contain only JSON text data'
        return result.get('structuredContent') or json.loads(result['content'][0]['text'])
    except (ValueError, KeyError, StopIteration, TypeError):
        pytest.fail('Malformed template MCP data response', pytrace=False)


async def test_document_template_authenticated_transport_fidelity_and_current_authority(platform):
    from cloud_source_inventory import assert_same_bytes, template_source_files
    from app.modules.auth.models import ApiToken
    from app.modules.organization.models import OrganizationMembership
    p = platform
    arguments = {'request': {'operation': 'manifest'}}
    params = {'name': 'document_template', 'arguments': arguments}
    # Actual registered transport and current read-only scope, no callback substitute.
    listed = decoded(await rpc(p, 'tools/list', token='template_reader'))
    assert 'document_template' in {tool['name'] for tool in listed['tools']}
    async with p.admin() as session:
        granted = await session.scalar(select(ApiToken.scopes).where(
            ApiToken.user_id == p.user, ApiToken.name == 'template_reader'))
        assert set(granted) == {'workspace:read', 'document:read'}
    assert (await rpc(p, 'tools/call', params, token=None)).status_code == 401
    assert (await rpc(p, 'tools/call', params, token='template_reader', workspace=p.other)).status_code == 403
    denied_scope = await rpc(p, 'tools/call', params, token='scope_only')
    if denied_scope.status_code == 200:
        rejected = bool(decoded(denied_scope).get('isError'))
        assert rejected, 'document:read must be required for template delivery'
    else:
        assert denied_scope.status_code == 403

    async def read(request):
        response = await rpc(p, 'tools/call', {'name': 'document_template',
            'arguments': {'request': request}}, token='template_reader')
        return await template_transport_result(response)

    manifest = await read({'operation': 'manifest'})
    assert manifest['accepted_pair'] is False
    assert manifest['chunk_limit'] == 65536
    baseline = template_source_files()  # Preserved original manifest/vendor/license bytes.
    assert set(manifest['files']) == set(baseline)
    version = manifest['version']
    for name, expected in baseline.items():
        metadata = manifest['files'][name]
        expected_size, expected_digest = len(expected), sha256(expected).hexdigest()
        assert metadata['size_bytes'] == expected_size, name
        assert metadata['sha256'] == expected_digest, name
        reconstructed = bytearray()
        offset = 0
        while offset is not None:
            chunk = await read({'operation': 'read', 'path': name, 'version': version,
                                'offset': offset, 'limit': 65536})
            assert chunk['version'] == version
            assert chunk['path'] == name
            assert chunk['offset'] == offset
            try:
                content = base64.b64decode(chunk['content_base64'], validate=True)
            except ValueError:
                pytest.fail('Invalid base64 template chunk', pytrace=False)
            length = len(content)
            assert 0 < length <= 65536, name
            reconstructed.extend(content)
            next_offset = chunk['next_offset']
            assert next_offset is None or next_offset == offset + length
            offset = next_offset
        assert_same_bytes(reconstructed, expected, name)
    # Same valid token loses effective authority when current DB membership is revoked.
    async with p.admin() as session:
        await session.execute(delete(OrganizationMembership).where(
            OrganizationMembership.organization_id == p.org,
            OrganizationMembership.user_id == p.user))
        await session.commit()
        record = await session.scalar(select(ApiToken).where(
            ApiToken.user_id == p.user, ApiToken.name == 'template_reader'))
        assert record.revoked_at is None and record.expires_at > datetime.now(UTC)
    revoked = await rpc(p, 'tools/call', params, token='template_reader')
    assert revoked.status_code in (401, 403)
    # Member bytes must be denied as well, even with a previously obtained version.
    revoked_member = await rpc(p, 'tools/call', {'name': 'document_template', 'arguments': {
        'request': {'operation': 'read', 'path': 'index.html', 'version': version}}}, token='template_reader')
    assert revoked_member.status_code in (401, 403)
