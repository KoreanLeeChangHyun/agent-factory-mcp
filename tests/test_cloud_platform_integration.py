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
            raise OSError("injected object write failure")
        self.path(key).write_bytes(content)

    async def get(self, key):
        return self.path(key).read_bytes()

    async def delete(self, key):
        raise AssertionError("recovery must retain objects")


@pytest_asyncio.fixture
async def platform(monkeypatch, tmp_path):
    url, admin_url = (
        os.environ.get("CLOUD_TEST_DATABASE_URL"),
        os.environ.get("CLOUD_TEST_ADMIN_DATABASE_URL"),
    )
    if not url or not admin_url:
        pytest.skip("requires newly created disposable cloud platform PostgreSQL")
    assert "/cloud_platform_test" in url and "@127.0.0.1:" in url
    assert os.environ["AGENT_FACTORY_DATABASE_URL"] == url
    from app.core.config import settings

    monkeypatch.setattr(settings, "public_base_url", "https://cloud.example.test")
    from app.db import models  # noqa: F401  # Register every mapped model with SQLAlchemy.
    from app.db.session import dispose_engine
    from app.modules.auth.crypto import token_digest
    from app.modules.auth.models import ApiToken, AuthSession, UserCredential
    from app.modules.identity.models import User
    from app.modules.mcp_connection.models import MCPConnection
    from app.modules.organization.models import Organization, OrganizationMembership
    from app.modules.organization.system_roles import (
        ORGANIZATION_MEMBER_ROLE_ID,
        ORGANIZATION_OWNER_ROLE_ID,
        VIEWER_ROLE_ID,
        WORKSPACE_OWNER_ROLE_ID,
    )
    from app.modules.workspace.models import Workspace, WorkspaceMembership

    admin = create_async_engine(admin_url)
    sessions = async_sessionmaker(admin, expire_on_commit=False)
    user, reader_user, org, workspace, other = uuid4(), uuid4(), uuid4(), uuid4(), uuid4()
    now = datetime.now(UTC)
    tokens = {
        name: "afm_" + uuid4().hex
        for name in ("writer", "reader", "expired", "revoked", "template_reader", "scope_only")
    }
    browser_cookie = uuid4().hex
    reader_cookie = uuid4().hex
    browser_email = f"{user}@example.com"
    browser_password = "disposable-stage7-password"
    async with sessions() as session:
        session.add(User(id=user, email=browser_email, display_name="클라우드 테스트"))
        session.add(
            User(
                id=reader_user,
                email=f"{reader_user}@example.com",
                display_name="Workbench reader",
            )
        )
        session.add(Organization(id=org, name="Cloud Test", slug=str(org), is_personal=True))
        await session.flush()
        session.add(
            OrganizationMembership(
                organization_id=org, user_id=user, role_id=ORGANIZATION_OWNER_ROLE_ID
            )
        )
        session.add(
            OrganizationMembership(
                organization_id=org,
                user_id=reader_user,
                role_id=ORGANIZATION_MEMBER_ROLE_ID,
            )
        )
        session.add_all(
            [
                Workspace(id=w, organization_id=org, name=str(w), slug=str(w))
                for w in (workspace, other)
            ]
        )
        await session.flush()
        session.add_all(
            [
                WorkspaceMembership(workspace_id=w, user_id=user, role_id=WORKSPACE_OWNER_ROLE_ID)
                for w in (workspace, other)
            ]
        )
        session.add(
            WorkspaceMembership(
                workspace_id=workspace,
                user_id=reader_user,
                role_id=VIEWER_ROLE_ID,
            )
        )
        for name, raw in tokens.items():
            record = ApiToken(
                user_id=user,
                name=name,
                token_digest=token_digest(raw, settings.auth_token_secret.get_secret_value()),
                scopes=(
                    ["workspace:read"]
                    if name == "scope_only"
                    else ["workspace:read", "document:read"]
                    if name == "template_reader"
                    else [
                        "workspace:read",
                        "document:read",
                        "integration:read",
                        "agent:read",
                        "workbench:read",
                    ]
                    + (
                        [
                            "document:write",
                            "integration:manage",
                            "agent:report",
                            "schedule:write",
                            "workbench:preview",
                            "workbench:create",
                            "workbench:update",
                            "workbench:publish",
                            "workbench:archive",
                            "workbench:restore",
                        ]
                        if name != "reader"
                        else []
                    )
                ),
                expires_at=now + timedelta(days=-1 if name == "expired" else 1),
                revoked_at=now if name == "revoked" else None,
            )
            session.add(record)
            await session.flush()
            session.add(
                MCPConnection(
                    user_id=user,
                    organization_id=org,
                    workspace_id=workspace,
                    token_id=record.id,
                    name=name,
                )
            )
        session.add(
            AuthSession(
                user_id=user,
                token_digest=token_digest(
                    browser_cookie, settings.auth_token_secret.get_secret_value()
                ),
                expires_at=now + timedelta(days=1),
            )
        )
        session.add(
            AuthSession(
                user_id=reader_user,
                token_digest=token_digest(
                    reader_cookie, settings.auth_token_secret.get_secret_value()
                ),
                expires_at=now + timedelta(days=1),
            )
        )
        from agent_factory_adapters.identity import SystemIdentityCrypto

        session.add(
            UserCredential(
                user_id=user,
                password_hash=SystemIdentityCrypto(
                    settings.auth_token_secret.get_secret_value()
                ).hash_password(browser_password),
            )
        )
        await session.commit()
    objects = IsolatedObjects(tmp_path)
    from app.mcp import documents
    from app.modules.integration import cloud_factory
    from app.router import cloud_documents
    from app.router import documents as ordinary_routes

    monkeypatch.setattr(documents, "S3ObjectStorage", lambda _: objects)
    monkeypatch.setattr(cloud_documents, "S3ObjectStorage", lambda _: objects)
    monkeypatch.setattr(ordinary_routes, "S3ObjectStorage", lambda _: objects)
    monkeypatch.setattr(cloud_factory, "S3ObjectStorage", lambda _: objects)
    from app.infrastructure.job_queue import CeleryJobPublisher

    published = []

    def publish(self, job, countdown=None):
        published.append((job.id, countdown))
        return str(uuid4())

    monkeypatch.setattr(CeleryJobPublisher, "publish", publish)
    # Any actual provider request must use our explicit transport fixture.
    provider_requests = []
    provider_hook = SimpleNamespace(callback=None)

    async def provider_response(request):
        provider_requests.append(request)
        if provider_hook.callback:
            response = await provider_hook.callback(request)
            if response is not None:
                return response
        if request.url.path == "/api/v10/users/@me":
            return httpx.Response(200, json={"id": "111", "username": "fixture"})
        if request.url.path == "/api/v10/channels/123/messages":
            return httpx.Response(
                200, json=[{"id": "456", "content": "한국어 source_run_1", "attachments": []}]
            )
        raise AssertionError(f"unexpected provider route: {request.url.host}{request.url.path}")

    provider_client = httpx.AsyncClient(
        transport=httpx.MockTransport(provider_response), trust_env=False
    )
    from app.modules.integration.cloud_http import ProviderHTTP

    monkeypatch.setattr(cloud_factory, "ProviderHTTP", lambda _: ProviderHTTP(provider_client))
    from app.main import create_app

    app = create_app()
    invitation_messages = []

    class ControlledEmailSink:
        async def send_verification(self, recipient, token):
            invitation_messages.append(("verification", recipient, token))

        async def send_password_reset(self, recipient, token):
            invitation_messages.append(("password-reset", recipient, token))

        async def send_organization_invitation(self, recipient, organization_id, token):
            invitation_messages.append(("invitation", recipient, organization_id, token))

    from app.modules.auth.dependencies import get_email_sender

    app.dependency_overrides[get_email_sender] = ControlledEmailSink
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    server = uvicorn.Server(
        uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning", lifespan="on")
    )
    task = asyncio.create_task(server.serve(sockets=[sock]))
    try:
        for _ in range(100):
            if server.started:
                break
            if task.done():
                await task
            await asyncio.sleep(0.05)
        assert server.started
        async with httpx.AsyncClient(
            base_url=f"http://127.0.0.1:{port}", trust_env=False, timeout=60
        ) as client:
            yield SimpleNamespace(
                client=client,
                url=str(client.base_url).rstrip("/"),
                admin=sessions,
                user=user,
                reader_user=reader_user,
                org=org,
                workspace=workspace,
                other=other,
                tokens=tokens,
                objects=objects,
                published=published,
                requests=provider_requests,
                provider_hook=provider_hook,
                cookie=browser_cookie,
                email=browser_email,
                password=browser_password,
                reader_cookie=reader_cookie,
                settings=settings,
                invitation_messages=invitation_messages,
            )
    finally:
        server.should_exit = True
        await task
        await provider_client.aclose()
        await admin.dispose()
        await dispose_engine()


async def rpc(p, method, params=None, *, token="writer", workspace=None):
    headers = {
        "Accept": "application/json, text/event-stream",
        "MCP-Protocol-Version": "2026-07-28",
        "MCP-Method": method,
    }
    if token:
        headers["Authorization"] = "Bearer " + p.tokens[token]
    if params and "name" in params:
        headers["MCP-Name"] = params["name"]
    return await p.client.post(
        f"/mcp/workspaces/{workspace or p.workspace}/",
        headers=headers,
        json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": {
                "_meta": {
                    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
                    "io.modelcontextprotocol/clientCapabilities": {},
                    "io.modelcontextprotocol/clientInfo": {
                        "name": "cloud-disposable",
                        "version": "1",
                    },
                },
                **(params or {}),
            },
        },
    )


def decoded(response):
    assert response.status_code == 200, response.text
    if response.headers.get("content-type", "").startswith("text/event-stream"):
        message = next(
            json.loads(line[5:].strip())
            for line in response.text.splitlines()
            if line.startswith("data:")
        )
    else:
        message = response.json()
    assert "error" not in message, message
    return message["result"]


async def call(p, name, arguments, *, error=False, **kwargs):
    result = decoded(await rpc(p, "tools/call", {"name": name, "arguments": arguments}, **kwargs))
    assert bool(result.get("isError")) == error, result
    if result.get("structuredContent") is not None:
        return result["structuredContent"]
    return json.loads(result["content"][0]["text"])


async def test_stage9_real_http_platform_administration(platform):
    """Exercise every admin API with live sessions and the forced-RLS application role."""
    p = platform
    from app.modules.audit.models import AuditEvent
    from app.modules.auth.crypto import token_digest
    from app.modules.auth.models import AuthSession
    from app.modules.identity.models import User
    from app.modules.integration.models import IntegrationConnection, IntegrationProvider
    from app.modules.organization.models import OrganizationMembership
    from app.modules.schedule.models import Job
    from app.modules.workspace.models import WorkspaceMembership

    now = datetime.now(UTC)
    admin_id, subject_id = uuid4(), uuid4()
    admin_cookie, subject_cookie = uuid4().hex, uuid4().hex
    expired_admin_cookie, revoked_admin_cookie = uuid4().hex, uuid4().hex
    provider_id, connection_id = uuid4(), uuid4()
    queued_id, running_id, failed_id = uuid4(), uuid4(), uuid4()
    ciphertext = b"stage9-disposable-ciphertext"
    async with p.admin() as session:
        session.add_all(
            [
                User(
                    id=admin_id,
                    email=f"{admin_id}@example.test",
                    display_name="Stage 9 admin",
                    is_platform_admin=True,
                ),
                User(
                    id=subject_id,
                    email=f"{subject_id}@example.test",
                    display_name="Stage 9 subject",
                ),
            ]
        )
        await session.flush()
        session.add_all(
            [
                AuthSession(
                    user_id=admin_id,
                    token_digest=token_digest(
                        admin_cookie, p.settings.auth_token_secret.get_secret_value()
                    ),
                    expires_at=now + timedelta(hours=1),
                ),
                AuthSession(
                    user_id=admin_id,
                    token_digest=token_digest(
                        expired_admin_cookie, p.settings.auth_token_secret.get_secret_value()
                    ),
                    expires_at=now - timedelta(seconds=1),
                ),
                AuthSession(
                    user_id=admin_id,
                    token_digest=token_digest(
                        revoked_admin_cookie, p.settings.auth_token_secret.get_secret_value()
                    ),
                    expires_at=now + timedelta(hours=1),
                    revoked_at=now,
                ),
                AuthSession(
                    user_id=subject_id,
                    token_digest=token_digest(
                        subject_cookie, p.settings.auth_token_secret.get_secret_value()
                    ),
                    expires_at=now + timedelta(hours=1),
                ),
            ]
        )
        session.add(
            IntegrationProvider(
                id=provider_id,
                key=f"stage9-{provider_id}",
                display_name="Stage 9 provider",
                auth_type="api_key",
                capabilities=["read"],
                configuration_schema={"secret": "must-not-serialize"},
            )
        )
        await session.flush()
        session.add(
            IntegrationConnection(
                id=connection_id,
                workspace_id=p.workspace,
                provider_id=provider_id,
                name="Stage 9 connection",
                status="active",
                encrypted_credentials=ciphertext,
                encryption_key_version=1,
                sync_cursor={"opaque": "cursor-secret"},
            )
        )
        for job_id, status in (
            (queued_id, "queued"),
            (running_id, "running"),
            (failed_id, "failed"),
        ):
            session.add(
                Job(
                    id=job_id,
                    organization_id=p.org,
                    workspace_id=p.workspace,
                    requested_by_user_id=p.user,
                    task_type="document.import",
                    queue="documents",
                    status=status,
                    idempotency_key=f"stage9-{job_id}",
                    attempt_count=2,
                    next_attempt_at=now + timedelta(minutes=1),
                    celery_task_id=f"secret-task-{job_id}",
                    started_at=now,
                    finished_at=now if status == "failed" else None,
                    dead_lettered_at=None,
                    error_code="fixture_error" if status == "failed" else None,
                    error_message="safe fixture error" if status == "failed" else None,
                )
            )
        session.add(
            AuditEvent(
                occurred_at=now,
                actor_user_id=admin_id,
                organization_id=p.org,
                workspace_id=p.workspace,
                action="stage9.fixture",
                outcome="success",
                request_id="stage9-request",
                source="http",
                event_metadata={"safe": True},
            )
        )
        await session.commit()

    # Tenant owner/member and bearer tokens never become platform administrators.
    for cookie in (p.cookie, p.reader_cookie, subject_cookie):
        p.client.cookies.clear()
        p.client.cookies.set(p.settings.session_cookie_name, cookie)
        assert (
            await p.client.get(
                "/api/admin/dashboard",
                headers={
                    "X-Platform-Admin": "true",
                    "X-Organization-ID": str(p.org),
                },
            )
        ).status_code == 403
    p.client.cookies.clear()
    assert (
        await p.client.get(
            "/api/admin/dashboard", headers={"Authorization": "Bearer " + p.tokens["writer"]}
        )
    ).status_code in {401, 403}
    for cookie in (expired_admin_cookie, revoked_admin_cookie):
        p.client.cookies.clear()
        p.client.cookies.set(p.settings.session_cookie_name, cookie)
        assert (await p.client.get("/api/admin/dashboard")).status_code == 401

    csrf = uuid4().hex
    p.client.cookies.clear()
    p.client.cookies.set(p.settings.session_cookie_name, admin_cookie)
    p.client.cookies.set("agent_factory_csrf", csrf)
    headers = {"X-CSRF-Token": csrf}
    for path in (
        "/api/admin/dashboard",
        "/api/admin/users",
        "/api/admin/organizations",
        "/api/admin/workspaces",
        "/api/admin/jobs",
        "/api/admin/integrations",
        "/api/admin/feature-flags",
        "/api/admin/runtime",
        "/api/admin/audit",
    ):
        response = await p.client.get(path)
        assert response.status_code == 200, (path, response.text)
        assert "ciphertext" not in response.text and "cursor-secret" not in response.text

    assert (
        await p.client.put(
            f"/api/admin/users/{admin_id}/status",
            headers=headers,
            json={"status": "suspended"},
        )
    ).status_code == 409
    assert (
        await p.client.put(
            f"/api/admin/users/{subject_id}/status",
            headers=headers,
            json={"status": "suspended"},
        )
    ).status_code == 200
    revoked = await p.client.post(f"/api/admin/users/{subject_id}/revoke-sessions", headers=headers)
    assert revoked.status_code == 200 and revoked.json()["revoked_sessions"] == 1

    owner_grant = {
        "scope": "workspace",
        "resource_id": str(p.other),
        "user_id": str(p.reader_user),
    }
    organization_owner_grant = {
        "scope": "organization",
        "resource_id": str(p.org),
        "user_id": str(p.reader_user),
    }
    assert (
        await p.client.post("/api/admin/ownership", headers=headers, json=organization_owner_grant)
    ).status_code == 204
    assert (
        await p.client.post("/api/admin/ownership", headers=headers, json=owner_grant)
    ).status_code == 204
    missing_owner_grant = {**owner_grant, "resource_id": str(uuid4())}
    assert (
        await p.client.post("/api/admin/ownership", headers=headers, json=missing_owner_grant)
    ).status_code == 404
    async with p.admin() as session:
        from app.modules.organization.system_roles import ORGANIZATION_OWNER_ROLE_ID

        assert (
            await session.scalar(
                select(OrganizationMembership.role_id).where(
                    OrganizationMembership.organization_id == p.org,
                    OrganizationMembership.user_id == p.user,
                )
            )
            == ORGANIZATION_OWNER_ROLE_ID
        )
        assert (
            await session.scalar(
                select(OrganizationMembership.role_id).where(
                    OrganizationMembership.organization_id == p.org,
                    OrganizationMembership.user_id == p.reader_user,
                )
            )
            == ORGANIZATION_OWNER_ROLE_ID
        )
        assert (
            await session.scalar(
                select(WorkspaceMembership.id).where(
                    WorkspaceMembership.workspace_id == p.workspace,
                    WorkspaceMembership.user_id == p.user,
                )
            )
            is not None
        )
        assert (
            await session.scalar(
                select(WorkspaceMembership.id).where(
                    WorkspaceMembership.workspace_id == p.other,
                    WorkspaceMembership.user_id == p.reader_user,
                )
            )
            is not None
        )
        assert (
            await session.scalar(
                select(OrganizationMembership.status).where(
                    OrganizationMembership.organization_id == p.org,
                    OrganizationMembership.user_id == p.reader_user,
                )
            )
            == "active"
        )

    cancelled = await p.client.post(f"/api/admin/jobs/{queued_id}/cancel", headers=headers)
    requested = await p.client.post(f"/api/admin/jobs/{running_id}/cancel", headers=headers)
    retried = await p.client.post(f"/api/admin/jobs/{failed_id}/retry", headers=headers)
    assert cancelled.json()["status"] == "cancelled"
    assert requested.json()["status"] == "cancel_requested"
    assert retried.status_code == 202 and retried.json()["status"] == "queued"
    async with p.admin() as session:
        retried_row = await session.get(Job, failed_id)
        assert retried_row is not None
        assert retried_row.attempt_count == 0 and retried_row.celery_task_id is None
        assert retried_row.started_at is None and retried_row.finished_at is None
        assert retried_row.error_code is None and retried_row.error_message is None

    disconnected = await p.client.delete(
        f"/api/admin/integrations/{connection_id}", headers=headers
    )
    assert disconnected.status_code == 200 and disconnected.json()["status"] == "disconnected"
    async with p.admin() as session:
        stored_connection = await session.get(IntegrationConnection, connection_id)
        assert stored_connection is not None
        assert stored_connection.encrypted_credentials is None
        assert stored_connection.encryption_key_version is None
        assert stored_connection.sync_cursor == {}
    missing_disconnect = await p.client.delete(
        f"/api/admin/integrations/{uuid4()}", headers=headers
    )
    assert missing_disconnect.status_code == 404
    assert (
        "ciphertext" not in missing_disconnect.text
        and "cursor-secret" not in missing_disconnect.text
    )

    flag = await p.client.put(
        "/api/admin/feature-flags/react-workbench",
        headers=headers,
        json={
            "is_enabled": True,
            "description": "Stage 9 rollout",
            "rules": {"workspaceIds": [str(p.workspace)]},
        },
    )
    assert flag.status_code == 200
    p.client.cookies.clear()
    p.client.cookies.set(p.settings.session_cookie_name, p.cookie)
    entry = await p.client.get(f"/workspace/{p.org}/{p.workspace}/entry", follow_redirects=False)
    assert entry.status_code == 307 and "/workbench/" in entry.headers["location"]
    # A non-admin request after the admin transaction cannot inherit cross-tenant RLS authority.
    denied = await p.client.get(
        f"/api/organizations/{uuid4()}/workspaces/{uuid4()}/workbench/selection"
    )
    assert denied.status_code in {403, 404}

    p.client.cookies.clear()
    p.client.cookies.set(p.settings.session_cookie_name, admin_cookie)
    assert (await p.client.get("/api/admin/dashboard")).status_code == 200
    assert (await p.client.post("/api/admin/audit", headers=headers)).status_code == 405
    async with p.admin() as session:
        await session.execute(update(User).where(User.id == admin_id).values(status="suspended"))
        await session.commit()
    assert (await p.client.get("/api/admin/dashboard")).status_code == 401
    async with p.admin() as session:
        await session.execute(
            update(User)
            .where(User.id == admin_id)
            .values(status="active", deleted_at=datetime.now(UTC))
        )
        await session.commit()
    assert (await p.client.get("/api/admin/dashboard")).status_code == 401


async def test_stage8_real_http_organization_workspace_and_invitation_composition(platform):
    """Exercise Stage 8 target composition through real sessions and forced RLS."""

    p = platform
    from app.modules.organization.system_roles import (
        ORGANIZATION_MEMBER_ROLE_ID,
        VIEWER_ROLE_ID,
    )

    p.client.cookies.set(p.settings.session_cookie_name, p.cookie)
    p.client.cookies.set("agent_factory_csrf", "stage8-http-csrf")
    headers = {"X-CSRF-Token": "stage8-http-csrf"}

    discovery = await p.client.get("/api/account/organizations")
    assert discovery.status_code == 200, discovery.text
    assert str(p.org) in {row["id"] for row in discovery.json()}

    created_org = await p.client.post(
        "/api/organizations",
        headers=headers,
        json={"name": "Stage 8 HTTP", "slug": f"stage8-{uuid4().hex}"},
    )
    assert created_org.status_code == 201, created_org.text
    organization_id = created_org.json()["id"]

    created_workspace = await p.client.post(
        f"/api/organizations/{organization_id}/workspaces",
        headers=headers,
        json={"name": "Stage 8 Workspace", "slug": "stage8-workspace"},
    )
    assert created_workspace.status_code == 201, created_workspace.text
    workspace = created_workspace.json()

    stale = await p.client.put(
        f"/api/organizations/{organization_id}/workspaces/{workspace['id']}",
        headers=headers,
        json={"name": "stale", "revision": workspace["revision"] + 1},
    )
    assert stale.status_code == 409, stale.text

    group = await p.client.post(
        f"/api/organizations/{organization_id}/workspaces/groups",
        headers=headers,
        json={"name": "HTTP group"},
    )
    assert group.status_code == 201, group.text
    assigned = await p.client.put(
        f"/api/organizations/{organization_id}/workspaces/groups/{group.json()['id']}"
        f"/workspaces/{workspace['id']}",
        headers=headers,
    )
    assert assigned.status_code == 204, assigned.text

    repository = await p.client.post(
        f"/api/organizations/{organization_id}/workspaces/{workspace['id']}/repositories",
        headers=headers,
        json={"location": "git@GitHub.COM:OpenAI/stage8.git", "metadata": {}},
    )
    assert repository.status_code == 201, repository.text
    assert repository.json()["canonical_location"] == "ssh://git@github.com/OpenAI/stage8"
    duplicate = await p.client.post(
        f"/api/organizations/{organization_id}/workspaces/{workspace['id']}/repositories",
        headers=headers,
        json={"location": "ssh://git@github.com/OpenAI/stage8", "metadata": {}},
    )
    assert duplicate.status_code == 409, duplicate.text

    reader_email = f"{p.reader_user}@example.com"
    invitation = await p.client.post(
        f"/api/organizations/{organization_id}/invitations",
        headers=headers,
        json={
            "email": reader_email,
            "role_id": str(ORGANIZATION_MEMBER_ROLE_ID),
            "workspace_grants": [{"workspace_id": workspace["id"], "role_id": str(VIEWER_ROLE_ID)}],
        },
    )
    assert invitation.status_code == 201, invitation.text
    delivered = p.invitation_messages[-1]
    assert delivered[:3] == ("invitation", reader_email, UUID(organization_id))

    p.client.cookies.set(p.settings.session_cookie_name, p.reader_cookie)
    accepted = await p.client.post(
        f"/api/organizations/{organization_id}/accept-invitation",
        headers=headers,
        json={"token": delivered[3]},
    )
    assert accepted.status_code == 200, accepted.text
    visible = await p.client.get(f"/api/organizations/{organization_id}/workspaces")
    assert visible.status_code == 200, visible.text
    assert [row["id"] for row in visible.json()] == [workspace["id"]]


def metadata(raw, *, slug=None, **extra):
    return dict(
        schema_version="1",
        idempotency_key=uuid4().hex,
        expected_revision=0,
        title="cloud.md",
        slug=slug or "cloud-" + uuid4().hex,
        document_type="processed",
        filename="cloud.md",
        media_type="text/markdown",
        source_sha256=sha256(raw).hexdigest(),
        source_identity="fixture:cloud-source",
        collection_context="Disposable HTTP source fixture",
        **extra,
    )


async def test_identity_postgres_http_mcp_lifecycle_and_current_authority(platform):
    """Exercise the production identity ports against forced-RLS PostgreSQL."""

    p = platform
    from agent_factory_adapters.identity import (
        PostgresAuthorizationRepository,
        PostgresIdentityRepository,
        SystemIdentityCrypto,
    )
    from agent_factory_api.composition.identity import (
        IdentityCompositionSettings,
        compose_authorization,
        compose_identity,
    )
    from agent_factory_core.identity import AuthorizationScope
    from agent_factory_core.shared.errors import (
        AuthenticationError,
        NotFoundError,
        PermissionDeniedError,
    )
    from app.db.session import get_session_factory
    from app.modules.auth.models import AuthSession, ExternalIdentity
    from app.modules.identity.models import User
    from app.modules.organization.models import Organization, OrganizationMembership
    from app.modules.organization.system_roles import (
        VIEWER_ROLE_ID,
        WORKSPACE_OWNER_ROLE_ID,
    )
    from app.modules.workspace.models import Workspace, WorkspaceMembership

    composition_settings = IdentityCompositionSettings(
        p.settings.auth_token_secret.get_secret_value(),
        p.settings.auth_session_ttl_hours,
        p.settings.auth_max_failed_attempts,
        p.settings.auth_lock_minutes,
    )
    crypto = SystemIdentityCrypto(p.settings.auth_token_secret.get_secret_value())
    sessions = get_session_factory()

    async with sessions() as session:
        authentication = compose_identity(session, composition_settings)
        authorization = compose_authorization(session)
        assert isinstance(authentication.repository, PostgresIdentityRepository)
        assert isinstance(authorization.repository, PostgresAuthorizationRepository)
        existing = await authentication.authenticate_session(p.cookie)
        assert existing.user_id == p.user
        assert (
            await authentication.login(p.email.upper(), p.password, "stage7-port")
        ).principal == existing

    p.client.cookies.clear()
    login = await p.client.post(
        "/api/auth/login", json={"email": p.email.upper(), "password": p.password}
    )
    assert login.status_code == 200, login.text
    http_session = p.client.cookies.get(p.settings.session_cookie_name)
    assert http_session
    assert (await p.client.get("/api/auth/me")).json()["user"]["id"] == str(p.user)

    invalid_sessions = {
        "expired": (datetime.now(UTC) - timedelta(seconds=1), None),
        "revoked": (datetime.now(UTC) + timedelta(hours=1), datetime.now(UTC)),
    }
    async with p.admin() as session:
        for raw, (expires_at, revoked_at) in invalid_sessions.items():
            session.add(
                AuthSession(
                    user_id=p.user,
                    token_digest=crypto.token_digest(raw),
                    expires_at=expires_at,
                    revoked_at=revoked_at,
                )
            )
        await session.commit()
    for raw in invalid_sessions:
        p.client.cookies.clear()
        p.client.cookies.set(p.settings.session_cookie_name, raw)
        assert (await p.client.get("/api/auth/me")).status_code == 401

    p.client.cookies.clear()
    p.client.cookies.set(p.settings.session_cookie_name, http_session)
    async with p.admin() as session:
        await session.execute(update(User).where(User.id == p.user).values(status="suspended"))
        await session.commit()
    assert (await p.client.get("/api/auth/me")).status_code == 401
    async with p.admin() as session:
        await session.execute(
            update(User)
            .where(User.id == p.user)
            .values(status="active", deleted_at=datetime.now(UTC))
        )
        await session.commit()
    assert (await p.client.get("/api/auth/me")).status_code == 401
    async with p.admin() as session:
        await session.execute(update(User).where(User.id == p.user).values(deleted_at=None))
        await session.commit()

    async with sessions() as session:
        authentication = compose_identity(session, composition_settings)
        linked = await authentication.login_external(
            provider="google",
            subject="stage7-existing",
            email=p.email,
            display_name="Existing identity",
            user_agent="stage7-external-existing",
        )
        assert linked.principal.user_id == p.user
    new_external_email = f"stage7-{uuid4()}@example.test"
    async with sessions() as session:
        created = await compose_identity(session, composition_settings).login_external(
            provider="github",
            subject="stage7-new",
            email=new_external_email,
            display_name="New external identity",
            user_agent="stage7-external-new",
        )
    async with p.admin() as session:
        assert (
            await session.scalar(
                select(ExternalIdentity.id).where(
                    ExternalIdentity.user_id == created.principal.user_id,
                    ExternalIdentity.provider == "github",
                )
            )
            is not None
        )
        personal_organization = await session.scalar(
            select(Organization.id)
            .join(OrganizationMembership)
            .where(
                OrganizationMembership.user_id == created.principal.user_id,
                Organization.is_personal.is_(True),
            )
        )
        assert personal_organization is not None

    async with sessions() as session:
        authentication = compose_identity(session, composition_settings)
        _, mcp_token = await authentication.create_api_token(
            user_id=p.user,
            name="stage7-production-mcp",
            scopes=["workbench:read"],
            expires_in_days=1,
            organization_id=p.org,
            workspace_id=p.workspace,
        )
    p.tokens["stage7-production"] = mcp_token
    assert (await rpc(p, "tools/list", token="stage7-production")).status_code == 200

    principal = existing
    scope = AuthorizationScope(p.org, p.workspace)
    async with sessions() as session:
        context = await compose_authorization(session).authorize(
            principal, scope, "workbench.create"
        )
        assert "workbench.create" in context.permissions
        assert await session.scalar(
            text("SELECT current_setting('app.current_workspace_id', true)")
        ) == str(p.workspace)
    async with p.admin() as session:
        await session.execute(
            update(WorkspaceMembership)
            .where(
                WorkspaceMembership.user_id == p.user,
                WorkspaceMembership.workspace_id == p.workspace,
            )
            .values(role_id=VIEWER_ROLE_ID)
        )
        await session.commit()
    async with sessions() as session:
        with pytest.raises(PermissionDeniedError):
            await compose_authorization(session).authorize(principal, scope, "workbench.create")
    async with p.admin() as session:
        await session.execute(
            update(WorkspaceMembership)
            .where(
                WorkspaceMembership.user_id == p.user,
                WorkspaceMembership.workspace_id == p.workspace,
            )
            .values(role_id=WORKSPACE_OWNER_ROLE_ID)
        )
        await session.execute(
            update(OrganizationMembership)
            .where(
                OrganizationMembership.user_id == p.user,
                OrganizationMembership.organization_id == p.org,
            )
            .values(status="suspended")
        )
        await session.commit()
    async with sessions() as session:
        with pytest.raises(PermissionDeniedError):
            await compose_authorization(session).authorize(principal, scope, "workbench.read")
    assert (await rpc(p, "tools/list", token="stage7-production")).status_code == 401
    async with p.admin() as session:
        await session.execute(
            update(OrganizationMembership)
            .where(
                OrganizationMembership.user_id == p.user,
                OrganizationMembership.organization_id == p.org,
            )
            .values(status="active")
        )
        await session.execute(
            update(Workspace).where(Workspace.id == p.workspace).values(status="inactive")
        )
        await session.commit()
    async with sessions() as session:
        with pytest.raises(NotFoundError):
            await compose_authorization(session).resolve(principal, scope)
    assert (await rpc(p, "tools/list", token="stage7-production")).status_code == 401
    second_organization, second_workspace = uuid4(), uuid4()
    async with p.admin() as session:
        await session.execute(
            update(Workspace).where(Workspace.id == p.workspace).values(status="active")
        )
        session.add(
            Organization(
                id=second_organization,
                name="Stage 7 isolated tenant",
                slug=str(second_organization),
            )
        )
        await session.flush()
        session.add(
            Workspace(
                id=second_workspace,
                organization_id=second_organization,
                name="Stage 7 isolated Workspace",
                slug=str(second_workspace),
            )
        )
        await session.commit()
    assert (await rpc(p, "tools/list", token="stage7-production")).status_code == 200
    async with sessions() as session:
        repository = PostgresAuthorizationRepository(session)
        await repository.establish_scope(principal, scope)
        assert (
            await session.scalar(
                text("SELECT id FROM workspaces WHERE id=:id"), {"id": p.workspace}
            )
            == p.workspace
        )
        assert (
            await session.scalar(
                text("SELECT id FROM workspaces WHERE id=:id"), {"id": second_workspace}
            )
            is None
        )
        with pytest.raises(PermissionDeniedError):
            await compose_authorization(session).authorize(
                principal,
                AuthorizationScope(second_organization, second_workspace),
                "workbench.read",
            )

    async with sessions() as session:
        delivery = await compose_identity(session, composition_settings).issue_password_reset(
            p.email
        )
    assert delivery is not None
    reset_token = delivery[1]

    async def consume_reset() -> object:
        async with sessions() as session:
            try:
                await compose_identity(session, composition_settings).reset_password(
                    reset_token, "disposable-stage7-password-updated"
                )
            except AuthenticationError as error:
                return error
        return None

    reset_results = await asyncio.gather(consume_reset(), consume_reset())
    assert sum(result is None for result in reset_results) == 1
    assert sum(isinstance(result, AuthenticationError) for result in reset_results) == 1
    async with sessions() as session:
        authentication = compose_identity(session, composition_settings)
        with pytest.raises(AuthenticationError):
            await authentication.authenticate_session(http_session)
        with pytest.raises(AuthenticationError):
            await authentication.login(p.email, p.password, "stage7-old-password")
        updated = await authentication.login(
            p.email, "disposable-stage7-password-updated", "stage7-new-password"
        )
        assert updated.principal.user_id == p.user


async def test_http_mcp_auth_scope_rls_and_import_races(platform):
    p = platform
    for token in (None, "expired", "revoked"):
        assert (await rpc(p, "tools/list", token=token)).status_code == 401
    assert (await rpc(p, "tools/list", workspace=p.other)).status_code == 403
    names = {tool["name"] for tool in decoded(await rpc(p, "tools/list"))["tools"]}
    assert {
        "document_prepare_upload",
        "document_finalize_upload",
        "collection_start",
        "reporting_write",
    } <= names
    raw = "한국어 cloud_run_123_a".encode()
    request = {**metadata(raw), "content_base64": base64.b64encode(raw).decode()}
    await call(p, "document_import", {"request": request}, token="reader", error=True)
    await call(
        p,
        "integration_token_set",
        {"connection_id": str(uuid4()), "token": "fixture", "approved_scopes": []},
        token="reader",
        error=True,
    )
    first, retry = await asyncio.gather(
        *(call(p, "document_import", {"request": request}) for _ in range(2))
    )
    assert first == retry
    writes = [
        {
            **request,
            "document_id": first["document_id"],
            "expected_revision": 1,
            "idempotency_key": uuid4().hex,
        }
        for _ in range(2)
    ]
    responses = await asyncio.gather(
        *(
            rpc(p, "tools/call", {"name": "document_import", "arguments": {"request": item}})
            for item in writes
        )
    )
    assert sorted(bool(decoded(r).get("isError")) for r in responses) == [False, True]
    for query in ("한국어", "cloud_run_123_a"):
        found = await call(
            p, "document_search", {"request": {"schema_version": "1", "query": query}}
        )
        assert found["hits"]
    from app.db.session import get_session_factory
    from app.db.tenant import TenantContext, apply_tenant_context
    from app.modules.document.cloud_models import DocumentImport

    async with get_session_factory()() as session:
        assert (
            await session.execute(
                text("SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user")
            )
        ).one() == (False, False)
        await apply_tenant_context(session, TenantContext(p.user, p.org, p.other))
        assert not list(await session.scalars(select(DocumentImport)))


async def test_workbench_http_mcp_postgres_parity(platform):
    p = platform
    from copy import deepcopy

    from agent_factory_contracts.generated.schema_bundle import DOCUMENTS_FIXTURE

    p.client.cookies.set(p.settings.session_cookie_name, p.cookie)
    p.client.cookies.set("agent_factory_csrf", "workbench-parity-csrf")
    headers = {
        "X-Organization-ID": str(p.org),
        "X-CSRF-Token": "workbench-parity-csrf",
    }
    path = f"/api/workspaces/{p.workspace}/workbenches"

    def definition(key, title):
        value = deepcopy(DOCUMENTS_FIXTURE)
        value["descriptor"]["id"] = key
        value["descriptor"]["title"] = title
        return value

    http_created_response = await p.client.post(
        path,
        headers=headers,
        json={
            "key": "parity-http",
            "title": "HTTP parity",
            "definition": definition("parity-http", "HTTP initial"),
        },
    )
    assert http_created_response.status_code == 201, http_created_response.text
    http_created = http_created_response.json()
    mcp_created = await call(
        p,
        "workbench_create",
        {
            "key": "parity-mcp",
            "title": "MCP parity",
            "definition": definition("parity-mcp", "MCP initial"),
        },
    )
    assert set(http_created) == set(mcp_created)

    http_list = (await p.client.get(path, headers=headers)).json()
    mcp_list = await call(p, "workbench_list", {})
    assert {item["key"] for item in http_list["items"]} == {
        item["key"] for item in mcp_list["items"]
    }
    assert all("definition" not in item for item in http_list["items"] + mcp_list["items"])

    http_draft = (await p.client.get(f"{path}/{http_created['id']}/draft", headers=headers)).json()
    mcp_draft = await call(p, "workbench_draft_read", {"definition_id": mcp_created["id"]})
    assert set(http_draft) == set(mcp_draft)

    http_saved_response = await p.client.put(
        f"{path}/{http_created['id']}/draft",
        headers=headers,
        json={
            "title": "HTTP parity",
            "expectedRevision": 1,
            "definition": definition("parity-http", "HTTP saved"),
        },
    )
    assert http_saved_response.status_code == 200, http_saved_response.text
    http_saved = http_saved_response.json()
    mcp_saved = await call(
        p,
        "workbench_draft_save",
        {
            "definition_id": mcp_created["id"],
            "title": "MCP parity",
            "expected_revision": 1,
            "definition": definition("parity-mcp", "MCP saved"),
        },
    )
    assert http_saved["revision"] == mcp_saved["revision"] == 2

    http_published_response = await p.client.post(
        f"{path}/{http_created['id']}/publish",
        headers=headers,
        json={"expectedRevision": 2, "requestKey": "http-parity-publish"},
    )
    assert http_published_response.status_code == 201, http_published_response.text
    http_published = http_published_response.json()
    mcp_published = await call(
        p,
        "workbench_publish",
        {
            "definition_id": mcp_created["id"],
            "expected_revision": 2,
            "request_key": "mcp-parity-publish",
        },
    )
    assert set(http_published) == set(mcp_published)
    assert (
        await call(
            p,
            "workbench_publish",
            {
                "definition_id": mcp_created["id"],
                "expected_revision": 2,
                "request_key": "mcp-parity-publish",
            },
        )
    )["id"] == mcp_published["id"]
    assert (
        await p.client.post(
            f"{path}/{http_created['id']}/publish",
            headers=headers,
            json={"expectedRevision": 2, "requestKey": "http-parity-publish"},
        )
    ).json()["id"] == http_published["id"]
    http_idempotency = await p.client.post(
        f"{path}/{http_created['id']}/publish",
        headers=headers,
        json={"expectedRevision": 3, "requestKey": "http-parity-publish"},
    )
    assert http_idempotency.status_code == 409
    assert http_idempotency.json()["detail"]["code"] == "workbench_idempotency_conflict"
    assert (
        await call(
            p,
            "workbench_publish",
            {
                "definition_id": mcp_created["id"],
                "expected_revision": 3,
                "request_key": "mcp-parity-publish",
            },
            error=True,
        )
    )["code"] == "workbench_idempotency_conflict"

    http_releases = (
        await p.client.get(f"{path}/{http_created['id']}/releases", headers=headers)
    ).json()
    mcp_releases = await call(p, "workbench_release_list", {"definition_id": mcp_created["id"]})
    assert len(http_releases["items"]) == len(mcp_releases["items"]) == 1
    http_release = (
        await p.client.get(f"{path}/releases/{http_published['id']}", headers=headers)
    ).json()
    mcp_release = await call(p, "workbench_release_read", {"release_id": mcp_published["id"]})
    assert set(http_release) == set(mcp_release)

    http_archived = (
        await p.client.post(
            f"{path}/{http_created['id']}/archive",
            headers=headers,
            json={"expectedRevision": 2},
        )
    ).json()
    mcp_archived = await call(
        p,
        "workbench_archive",
        {"definition_id": mcp_created["id"], "expected_revision": 2},
    )
    assert http_archived["state"] == mcp_archived["state"] == "archived"
    http_archived_publish = await p.client.post(
        f"{path}/{http_created['id']}/publish",
        headers=headers,
        json={"expectedRevision": 3, "requestKey": "http-archived"},
    )
    assert http_archived_publish.status_code == 409
    assert http_archived_publish.json()["detail"]["code"] == "workbench_archived"
    assert (
        await call(
            p,
            "workbench_publish",
            {
                "definition_id": mcp_created["id"],
                "expected_revision": 3,
                "request_key": "mcp-archived",
            },
            error=True,
        )
    )["code"] == "workbench_archived"
    http_restored = (
        await p.client.post(
            f"{path}/{http_created['id']}/restore",
            headers=headers,
            json={"expectedRevision": 3},
        )
    ).json()
    mcp_restored = await call(
        p,
        "workbench_restore",
        {"definition_id": mcp_created["id"], "expected_revision": 3},
    )
    assert http_restored["state"] == mcp_restored["state"] == "draft"

    invalid_http = await p.client.post(
        path,
        headers=headers,
        json={
            "key": "invalid-http",
            "title": "Invalid",
            "definition": definition("different-key", "Invalid"),
        },
    )
    assert invalid_http.status_code == 422
    assert invalid_http.json()["detail"]["code"] == "invalid_workbench_definition"
    assert (
        await call(
            p,
            "workbench_create",
            {
                "key": "invalid-mcp",
                "title": "Invalid",
                "definition": definition("different-key", "Invalid"),
            },
            error=True,
        )
    )["code"] == "invalid_workbench_definition"

    missing = str(uuid4())
    assert (await p.client.get(f"{path}/releases/{missing}", headers=headers)).status_code == 404
    assert (await call(p, "workbench_release_read", {"release_id": missing}, error=True))[
        "code"
    ] == "workbench_not_found"
    assert (
        await p.client.put(
            f"{path}/{http_created['id']}/draft",
            headers=headers,
            json={
                "title": "stale",
                "expectedRevision": 1,
                "definition": definition("parity-http", "stale"),
            },
        )
    ).status_code == 409
    assert (
        await call(
            p,
            "workbench_draft_save",
            {
                "definition_id": mcp_created["id"],
                "title": "stale",
                "expected_revision": 1,
                "definition": definition("parity-mcp", "stale"),
            },
            error=True,
        )
    )["code"] == "workbench_revision_conflict"
    await call(
        p,
        "workbench_draft_read",
        {"definition_id": mcp_created["id"]},
        token="reader",
        error=True,
    )
    assert (await call(p, "workbench_list", {}, token="reader"))["items"]
    p.client.cookies.set(p.settings.session_cookie_name, p.reader_cookie)
    assert (await p.client.get(path, headers=headers)).status_code == 200
    assert (
        await p.client.get(f"{path}/{http_created['id']}/draft", headers=headers)
    ).status_code == 403
    assert (
        await p.client.post(
            path,
            headers=headers,
            json={
                "key": "reader-denied",
                "title": "Reader denied",
                "definition": definition("reader-denied", "Reader denied"),
            },
        )
    ).status_code == 403
    p.client.cookies.set(p.settings.session_cookie_name, p.cookie)


@pytest.mark.parametrize("skill", ["document", "agent", "template", "synthetic-large"])
async def test_large_git_inventory_binary_upload_expiry_digest_and_preview(platform, skill):
    from tests.support.inventory import assert_same_bytes, git_source_files, template_source_files

    p = platform
    root = Path(__file__).resolve().parents[2] / "plugin"
    if skill == "template":
        files = template_source_files()
    elif skill == "synthetic-large":
        # Explicit capacity regression, not padding or a claim about actual source.
        files = {
            "capacity.bin": b"capacity-fixture-" * (600 * 1024),
            "index.html": '<html lang="ko"><body>합성 용량 시험</body></html>'.encode(),
        }
        assert sum(map(len, files.values())) > 8 * 1024 * 1024
    else:
        files = git_source_files(root, f"skills/{skill}", f"docs/specifications/{skill}")
        assert f"skills/{skill}/SKILL.md" in files
        assert f"docs/specifications/{skill}/index.html" in files
    assert sum(map(len, files.values())) > 256 * 1024
    # Exact source inventory only. Original snapshot ingestion is not pair acceptance.
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w", zipfile.ZIP_STORED) as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    raw = stream.getvalue()
    request = metadata(raw)
    request.update(
        document_type="original",
        filename="source.zip",
        media_type="application/zip",
        size_bytes=len(raw),
    )
    intent = await call(p, "document_prepare_upload", {"request": request})
    headers = {
        "Authorization": "Bearer " + p.tokens["writer"],
        intent["header"]: intent["capability"],
    }
    assert (
        await p.client.put(
            intent["path"], content=raw, headers={intent["header"]: intent["capability"]}
        )
    ).status_code in (401, 403)
    assert (
        await p.client.put(intent["path"], content=raw[:-1] + b"!", headers=headers)
    ).status_code == 400
    assert (await p.client.put(intent["path"], content=raw, headers=headers)).status_code == 200
    from app.modules.document.delivery_models import DocumentUpload

    async with p.admin() as session:
        await session.execute(
            update(DocumentUpload)
            .where(DocumentUpload.id == UUID(intent["upload_id"]))
            .values(expires_at=datetime.now(UTC) - timedelta(seconds=1))
        )
        await session.commit()
    await call(
        p,
        "document_finalize_upload",
        {"request": {"schema_version": "1", "upload_id": intent["upload_id"]}},
        error=True,
    )
    renewed = await call(p, "document_prepare_upload", {"request": request})
    assert renewed["upload_id"] == intent["upload_id"]
    capability_rotated = renewed["capability"] != intent["capability"]
    assert capability_rotated, "Upload capability must rotate on renewal"
    receipt = await call(
        p,
        "document_finalize_upload",
        {"request": {"schema_version": "1", "upload_id": intent["upload_id"]}},
    )
    async with p.admin() as session:
        await session.execute(
            update(DocumentUpload)
            .where(DocumentUpload.id == UUID(intent["upload_id"]))
            .values(expires_at=datetime.now(UTC) - timedelta(seconds=1))
        )
        await session.commit()
    assert receipt == await call(
        p,
        "document_finalize_upload",
        {"request": {"schema_version": "1", "upload_id": intent["upload_id"]}},
    )
    from app.modules.document.models import DocumentRevision

    async with p.admin() as session:
        revision = await session.get(DocumentRevision, UUID(receipt["revision_id"]))
        stored = await p.objects.get(revision.storage_key)
    assert_same_bytes(stored, raw, skill)
    with zipfile.ZipFile(io.BytesIO(stored)) as archive:
        assert set(archive.namelist()) == set(files)
        for name, value in files.items():
            member_bytes = archive.read(name)
            assert_same_bytes(member_bytes, value, name)
    p.client.cookies.set(p.settings.session_cookie_name, p.cookie)
    base = f"/api/organizations/{p.org}/workspaces/{p.workspace}/cloud-documents/{receipt['document_id']}/revisions/1/package"
    preview = await p.client.get(base + "/preview")
    from app.modules.document.preview import PREVIEW_HEADERS

    if "index.html" in files:
        assert preview.status_code == 200
        assert all(preview.headers.get(k) == v for k, v in PREVIEW_HEADERS.items())
        member_path = "index.html"
    else:
        # A raw Git snapshot has no top-level entry or accepted pair metadata.
        # Preserve its exact bytes rather than adding a fake preview document.
        assert preview.status_code == 422
        member_path = f"docs/specifications/{skill}/index.html"
    member = await p.client.get(base + "/member", params={"path": member_path})
    assert member.status_code == 200
    assert_same_bytes(member.content, files[member_path], member_path)
    assert member.headers["x-frame-options"] == "DENY"
    assert member.headers["content-type"] == "application/octet-stream"
    p.client.cookies.clear()
    denied = await p.client.get(base + "/preview")
    assert denied.status_code in (401, 403) and denied.headers["x-frame-options"] == "DENY"


async def collection(p, *, name=None):
    from app.modules.integration.models import (
        IntegrationAuthType,
        IntegrationConnection,
        IntegrationProvider,
    )

    async with p.admin() as session:
        provider = await session.scalar(
            select(IntegrationProvider).where(IntegrationProvider.key == "discord")
        )
        if provider is None:
            provider = IntegrationProvider(
                key="discord", display_name="Discord", auth_type=IntegrationAuthType.API_KEY
            )
            session.add(provider)
            await session.flush()
        connection = IntegrationConnection(
            workspace_id=p.workspace, provider_id=provider.id, name=name or uuid4().hex
        )
        session.add(connection)
        await session.commit()
        connection_id = str(connection.id)
    await call(
        p,
        "integration_token_set",
        {"connection_id": connection_id, "token": "fixture-token-only", "approved_scopes": []},
    )
    created = await call(
        p,
        "collection_create",
        {
            "request": {
                "connection_id": connection_id,
                "name": name or uuid4().hex,
                "selection": {
                    "channel_id": "123",
                    "max_items": 10,
                    "max_pages": 2,
                    "max_bytes": 100000,
                    "attachments": False,
                },
            }
        },
    )
    return connection_id, created["collection_id"]


async def execute(p, job_id):
    from app.worker.tasks import _execute_job

    # Intentionally false queue identities: only the durable job authorizes execution.
    return await _execute_job(UUID(job_id), uuid4(), uuid4(), uuid4())


async def test_collection_acceptance_durable_cursor_fresh_runs_and_secret_projection(platform):
    p = platform
    _connection_id, collection_id = await collection(p)
    key = uuid4().hex
    started = await call(
        p, "collection_start", {"collection_id": collection_id, "request_key": key}
    )
    assert started["status"] == "queued" and not p.requests
    assert started == await call(
        p, "collection_start", {"collection_id": collection_id, "request_key": key}
    )
    projection = decoded(await rpc(p, "tools/call", {"name": "integration_list", "arguments": {}}))
    text_result = json.dumps(projection)
    assert (
        "encrypted_credentials" not in text_result and "encryption_key_version" not in text_result
    )
    assert "fixture-token-only" not in text_result
    assert await execute(p, started["job_id"]) == "succeeded"
    first = await call(p, "collection_results", {"run_id": started["run_id"]})
    assert first["status"] == "succeeded" and len(first["results"]) == 1
    assert await execute(p, started["job_id"]) == "ignored"
    fresh = await call(
        p, "collection_start", {"collection_id": collection_id, "request_key": uuid4().hex}
    )
    assert fresh["run_id"] != started["run_id"]
    assert await execute(p, fresh["job_id"]) == "succeeded"
    second = await call(p, "collection_results", {"run_id": fresh["run_id"]})
    assert second["results"][0]["revision_number"] == first["results"][0]["revision_number"]
    assert second["results"][0]["changed"] is False
    from app.modules.document.models import DocumentRevision
    from app.modules.integration.cloud_models import CloudCollectionRun, CloudSourceMapping

    async with p.admin() as session:
        run = await session.get(CloudCollectionRun, UUID(fresh["run_id"]))
        assert run.cursor == {"page": "456"}
        mapping = await session.scalar(
            select(CloudSourceMapping).where(
                CloudSourceMapping.collection_id == UUID(collection_id)
            )
        )
        revision = await session.scalar(
            select(DocumentRevision).where(DocumentRevision.document_id == mapping.document_id)
        )
        assert revision.revision_number == mapping.revision_number
        assert (await p.objects.get(revision.storage_key)) and revision.sha256 == first["results"][
            0
        ]["sha256"]


async def test_pending_cancellation_and_execution_authority(platform):
    p = platform
    _, collection_id = await collection(p)
    run = await call(
        p, "collection_start", {"collection_id": collection_id, "request_key": uuid4().hex}
    )
    await call(p, "collection_cancel", {"run_id": run["run_id"]})
    assert await execute(p, run["job_id"]) == "cancelled"
    assert not p.requests
    second = await call(
        p, "collection_start", {"collection_id": collection_id, "request_key": uuid4().hex}
    )
    from app.modules.workspace.models import Workspace, WorkspaceStatus

    async with p.admin() as session:
        await session.execute(
            update(Workspace)
            .where(Workspace.id == p.workspace)
            .values(status=WorkspaceStatus.INACTIVE)
        )
        await session.commit()
    assert await execute(p, second["job_id"]) == "failed"
    assert not p.requests
    from app.modules.integration.cloud_models import CloudCollectionRun

    async with p.admin() as session:
        assert (await session.get(CloudCollectionRun, UUID(second["run_id"]))).status == "failed"


async def test_worker_concurrency_connection_guard_cancel_exception_and_recovery(platform):
    p = platform
    connection_id, collection_id = await collection(p)
    one = await call(
        p, "collection_start", {"collection_id": collection_id, "request_key": uuid4().hex}
    )
    two = await call(
        p, "collection_start", {"collection_id": collection_id, "request_key": uuid4().hex}
    )
    reached, release = asyncio.Event(), asyncio.Event()

    async def block(request):
        if request.url.path.endswith("/messages"):
            reached.set()
            await release.wait()
            return httpx.Response(
                429, headers={"Retry-After": "120"}, json={"message": "fixture rejection"}
            )

    p.provider_hook.callback = block
    active = asyncio.create_task(execute(p, one["job_id"]))
    await asyncio.wait_for(reached.wait(), 10)
    assert await execute(p, one["job_id"]) == "ignored"
    assert await execute(p, two["job_id"]) == "retry"
    # Legacy disconnect shares the exact collection advisory guard.
    p.client.cookies.set(p.settings.session_cookie_name, p.cookie)
    p.client.cookies.set("agent_factory_csrf", "fixture-csrf")
    response = await p.client.delete(
        f"/api/organizations/{p.org}/workspaces/{p.workspace}/integrations/{connection_id}",
        headers={"X-CSRF-Token": "fixture-csrf"},
    )
    assert response.status_code == 409
    await call(p, "collection_cancel", {"run_id": one["run_id"]})
    release.set()
    assert await active == "cancelled"
    p.provider_hook.callback = None
    # Persisted RUNNING with no lifetime claim models abrupt process loss.
    from app.modules.schedule.models import Job, JobStatus

    async with p.admin() as session:
        await session.execute(
            update(Job)
            .where(Job.id == UUID(two["job_id"]))
            .values(status=JobStatus.RUNNING, started_at=datetime.now(UTC) - timedelta(hours=1))
        )
        await session.commit()
    assert await execute(p, two["job_id"]) == "succeeded"
    assert (await call(p, "collection_results", {"run_id": two["run_id"]}))["results"]


async def test_retry_after_final_failure_and_cursor_before_object_durability(platform):
    p = platform
    _, collection_id = await collection(p)
    run = await call(
        p, "collection_start", {"collection_id": collection_id, "request_key": uuid4().hex}
    )

    async def limited(request):
        return httpx.Response(429, headers={"Retry-After": "120"}, json={"message": "fixture"})

    p.provider_hook.callback = limited
    assert await execute(p, run["job_id"]) == "retry"
    assert p.published[-1][1] >= 120
    from app.modules.integration.cloud_models import CloudCollectionRun
    from app.modules.schedule.models import Job

    async with p.admin() as session:
        await session.execute(
            update(Job)
            .where(Job.id == UUID(run["job_id"]))
            .values(max_attempts=2, next_attempt_at=datetime.now(UTC) - timedelta(seconds=1))
        )
        await session.commit()
    assert await execute(p, run["job_id"]) == "dead"
    async with p.admin() as session:
        record = await session.get(CloudCollectionRun, UUID(run["run_id"]))
        assert record.status == "failed" and record.cursor == {}
    p.provider_hook.callback = None
    fresh = await call(
        p, "collection_start", {"collection_id": collection_id, "request_key": uuid4().hex}
    )
    p.objects.fail_put = True
    assert await execute(p, fresh["job_id"]) == "retry"
    async with p.admin() as session:
        record = await session.get(CloudCollectionRun, UUID(fresh["run_id"]))
        assert record.cursor == {} and record.pages == 0 and not record.results


async def test_pair_rejection_keeps_publication_and_reporting_heartbeat(platform, monkeypatch):
    p = platform
    from test_cloud_documents import archive, pair_fixture

    files, pair = pair_fixture()
    # Synthetic fixture review is test input, never evidence accepting a real Specification.
    raw = archive(files)
    request = metadata(raw, slug="source")
    request.update(
        document_type="specification",
        filename="source.zip",
        media_type="application/zip",
        pair=pair.model_dump(mode="json"),
        content_base64=base64.b64encode(raw).decode(),
    )
    first = await call(p, "document_import", {"request": request})
    broken = {**files}
    broken.pop("human/source/app.js")
    raw_bad = archive(broken)
    bad = {
        **request,
        "document_id": first["document_id"],
        "expected_revision": 1,
        "idempotency_key": uuid4().hex,
        "source_sha256": sha256(raw_bad).hexdigest(),
        "content_base64": base64.b64encode(raw_bad).decode(),
    }
    await call(p, "document_import", {"request": bad}, error=True)
    from app.modules.document.models import Document

    async with p.admin() as session:
        document = await session.get(Document, UUID(first["document_id"]))
        assert (
            document.current_revision_number == 1
            and document.document_metadata["cloud_pair_revision"] == 1
        )
    # A reporting recipient must never enter the legacy execution service.
    from app.modules.agent.service import AgentService

    async def forbidden(*args, **kwargs):
        raise AssertionError("cloud reporting attempted legacy execution")

    monkeypatch.setattr(AgentService, "create_run", forbidden)
    agent_id, task_id = str(uuid4()), str(uuid4())
    await call(
        p,
        "reporting_write",
        {
            "command": {
                "key": uuid4().hex,
                "operation": "agent",
                "agent": {
                    "id": agent_id,
                    "revision": 0,
                    "name": "한국어 cloud_run_1",
                    "role": "work",
                    "responsibilities": "fixture",
                },
            }
        },
    )
    binding = {
        "project_ref": "fixture",
        "agent_id": "work",
        "session_id": "session-1",
        "run_id": "run-1",
    }
    await call(
        p,
        "reporting_write",
        {
            "command": {
                "key": uuid4().hex,
                "operation": "task",
                "task": {
                    "id": task_id,
                    "agent_id": agent_id,
                    "name": "cloud_run_1",
                    "runtime_binding": binding,
                },
            }
        },
    )
    heartbeat = {
        "key": uuid4().hex,
        "operation": "heartbeat",
        "heartbeat": {
            "id": task_id,
            "runtime_binding": binding,
            "sequence": 1,
            "observed_at": datetime.now(UTC).isoformat(),
            "fact": "process_alive",
        },
    }
    result = await call(p, "reporting_write", {"command": heartbeat})
    assert result == await call(p, "reporting_write", {"command": heartbeat})
    from app.modules.reporting.models import ReportTask

    async with p.admin() as session:
        task = await session.get(ReportTask, UUID(task_id))
        assert task.revision == 1 and task.runtime_observation["sequence"] == 1
    assert not p.published
    found = await call(p, "reporting_search", {"request": {"query": "cloud_run_1", "kind": "task"}})
    assert found


async def test_new_write_token_issuance_and_current_permission_boundary(platform):
    p = platform
    p.client.cookies.set(p.settings.session_cookie_name, p.cookie)
    p.client.cookies.set("agent_factory_csrf", "fixture-csrf")
    headers = {"X-CSRF-Token": "fixture-csrf"}
    request = {
        "name": "new mutation credential",
        "scopes": ["workspace:read", "document:write", "integration:manage"],
        "expires_in_days": 1,
    }
    assert (await p.client.post("/api/auth/tokens", json=request, headers=headers)).status_code in (
        401,
        403,
    )
    request.update(organization_id=str(p.org), workspace_id=str(p.workspace))
    response = await p.client.post("/api/auth/tokens", json=request, headers=headers)
    assert response.status_code == 200, response.text
    assert set(response.json()["scopes"]) == set(request["scopes"])
    assert (await rpc(p, "tools/list", token="reader")).status_code == 200
    from app.modules.organization.system_roles import VIEWER_ROLE_ID

    async with p.admin() as session:
        from app.modules.workspace.models import WorkspaceMembership

        await session.execute(
            update(WorkspaceMembership)
            .where(
                WorkspaceMembership.user_id == p.user,
                WorkspaceMembership.workspace_id == p.workspace,
            )
            .values(role_id=VIEWER_ROLE_ID)
        )
        await session.commit()
    assert (
        await p.client.post("/api/auth/tokens", json=request, headers=headers)
    ).status_code == 403
    raw = b"no permission"
    await call(
        p,
        "document_import",
        {"request": {**metadata(raw), "content_base64": base64.b64encode(raw).decode()}},
        error=True,
    )


async def test_oauth_same_user_state_denial_expiry_and_clean_response(
    platform, monkeypatch, caplog
):
    p = platform
    from urllib.parse import parse_qs, urlsplit

    from pydantic import SecretStr

    monkeypatch.setattr(p.settings, "public_base_url", "https://cloud.example.test")
    monkeypatch.setattr(p.settings, "gmail_oauth_client_id", "fixture-client")
    monkeypatch.setattr(p.settings, "gmail_oauth_client_secret", SecretStr("fixture-secret"))
    monkeypatch.setattr(
        p.settings,
        "gmail_oauth_redirect_uri",
        "https://cloud.example.test/api/integrations/oauth/gmail/callback",
    )
    from app.modules.integration.models import (
        IntegrationConnection,
        IntegrationOAuthState,
        IntegrationProvider,
    )

    async with p.admin() as session:
        provider = await session.scalar(
            select(IntegrationProvider).where(IntegrationProvider.key == "gmail")
        )
        record = IntegrationConnection(
            workspace_id=p.workspace, provider_id=provider.id, name="OAuth fixture"
        )
        session.add(record)
        await session.commit()
        connection_id = str(record.id)

    async def begin():
        result = await call(
            p,
            "integration_oauth_begin",
            {
                "connection_id": connection_id,
                "scopes": ["https://www.googleapis.com/auth/gmail.readonly"],
            },
        )
        return parse_qs(urlsplit(result["authorization_url"]).query)["state"][0]

    state = await begin()
    code = "fixture-code-never-log"
    response = await p.client.get(
        "/api/integrations/oauth/gmail/callback", params={"state": state, "code": code}
    )
    assert response.status_code == 303 and not p.requests
    p.client.cookies.set(p.settings.session_cookie_name, p.cookie)

    async def exchange(request):
        if request.url.host == "oauth2.googleapis.com" and request.url.path == "/token":
            assert code.encode() in request.content
            return httpx.Response(
                200,
                json={
                    "access_token": "fixture-access-token",
                    "scope": "https://www.googleapis.com/auth/gmail.readonly",
                    "token_type": "Bearer",
                },
            )

    p.provider_hook.callback = exchange
    response = await p.client.get(
        "/api/integrations/oauth/gmail/callback", params={"state": state, "code": code}
    )
    assert response.status_code == 303
    assert response.headers["location"] == "https://cloud.example.test/workspace/"
    assert (
        response.headers["cache-control"] == "no-store"
        and response.headers["referrer-policy"] == "no-referrer"
    )
    assert len(p.requests) == 1
    await p.client.get(
        "/api/integrations/oauth/gmail/callback", params={"state": state, "code": code}
    )
    assert len(p.requests) == 1
    denied = await begin()
    await p.client.get(
        "/api/integrations/oauth/gmail/callback", params={"state": denied, "error": "access_denied"}
    )
    await p.client.get(
        "/api/integrations/oauth/gmail/callback", params={"state": denied, "code": code}
    )
    assert len(p.requests) == 1
    expired = await begin()
    async with p.admin() as session:
        await session.execute(
            update(IntegrationOAuthState)
            .where(
                IntegrationOAuthState.user_id == p.user, IntegrationOAuthState.consumed_at.is_(None)
            )
            .values(expires_at=datetime.now(UTC) - timedelta(seconds=1))
        )
        await session.commit()
    await p.client.get(
        "/api/integrations/oauth/gmail/callback", params={"state": expired, "code": code}
    )
    assert len(p.requests) == 1
    assert code not in caplog.text and "fixture-access-token" not in caplog.text


async def test_current_editor_with_real_http_and_document(platform):
    p = platform
    raw = "# 현재 편집기\n한국어 editor_run_1\n".encode()
    receipt = await call(
        p,
        "document_import",
        {"request": {**metadata(raw), "content_base64": base64.b64encode(raw).decode()}},
    )
    env = {
        **os.environ,
        "CLOUD_BROWSER_URL": p.url,
        "CLOUD_BROWSER_COOKIE": p.cookie,
        "CLOUD_BROWSER_COOKIE_NAME": p.settings.session_cookie_name,
        "CLOUD_BROWSER_WORKSPACE": str(p.workspace),
        "CLOUD_BROWSER_DOCUMENT": receipt["document_id"],
    }
    process = await asyncio.create_subprocess_exec(
        "node",
        "tests/browser/cloud-platform.cjs",
        env=env,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    output, _ = await asyncio.wait_for(process.communicate(), 90)
    assert process.returncode == 0, output.decode()


async def test_authenticated_workbench_authoring_with_real_postgres_and_http(platform):
    p = platform
    from copy import deepcopy

    from agent_factory_api.composition.workbenches import build_workbench_service
    from agent_factory_contracts.generated.schema_bundle import DOCUMENTS_FIXTURE
    from agent_factory_core import WorkbenchActor
    from app.db.session import get_session_factory
    from app.modules.auth.models import AuthSession

    actor = WorkbenchActor(
        p.user,
        p.org,
        p.workspace,
        frozenset(
            {
                "workbench.read",
                "workbench.preview",
                "workbench.create",
                "workbench.update",
                "workbench.publish",
                "workbench.archive",
                "workbench.restore",
            }
        ),
    )
    customer_definition = deepcopy(DOCUMENTS_FIXTURE)
    customer_definition["descriptor"]["id"] = "customer-documents"
    customer_definition["descriptor"]["title"] = "Customer Documents"
    async with get_session_factory()() as session:
        created_definition = await build_workbench_service(session).create.execute(
            actor,
            key="customer-documents",
            title="Customer Documents",
            definition=customer_definition,
        )
    frontend_socket = socket.socket()
    frontend_socket.bind(("127.0.0.1", 0))
    frontend_port = frontend_socket.getsockname()[1]
    frontend_socket.close()
    frontend_url = f"http://127.0.0.1:{frontend_port}"
    frontend_app_base = f"{frontend_url}/workbench/"
    env = {
        **os.environ,
        "NODE_PATH": os.environ.get(
            "WORKBENCH_PLAYWRIGHT_NODE_PATH",
            str(Path(__file__).resolve().parents[1] / "assets/ui-kit/node_modules"),
        ),
        "WORKBENCH_API_TARGET": p.url,
        "WORKBENCH_BROWSER_URL": frontend_url,
        "WORKBENCH_APP_BASE": frontend_app_base,
        "WORKBENCH_BROWSER_COOKIE": p.cookie,
        "WORKBENCH_BROWSER_COOKIE_NAME": p.settings.session_cookie_name,
        "WORKBENCH_BROWSER_EMAIL": p.email,
        "WORKBENCH_BROWSER_PASSWORD": p.password,
        "WORKBENCH_BROWSER_ORGANIZATION": str(p.org),
        "WORKBENCH_BROWSER_WORKSPACE": str(p.workspace),
    }
    frontend = await asyncio.create_subprocess_exec(
        "pnpm",
        "--filter",
        "@agent-factory/web",
        "exec",
        "vite",
        "--host",
        "127.0.0.1",
        "--port",
        str(frontend_port),
        env=env,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    try:
        readiness_url = f"{frontend_app_base}authoring"
        readiness_diagnostic = "no response"
        async with httpx.AsyncClient(trust_env=False) as probe:
            for _ in range(100):
                try:
                    response = await probe.get(readiness_url)
                    readiness_diagnostic = (
                        f"status={response.status_code} "
                        f"content-type={response.headers.get('content-type')!r} "
                        f"body={response.text[:300]!r}"
                    )
                    if response.status_code == 200:
                        break
                except httpx.TransportError as exc:
                    readiness_diagnostic = f"transport={type(exc).__name__}: {exc}"
                await asyncio.sleep(0.05)
            else:
                if frontend.returncode is None:
                    frontend.terminate()
                vite_output, _ = await asyncio.wait_for(frontend.communicate(), 5)
                raise AssertionError(
                    "Workbench Vite server did not become ready; "
                    f"url={readiness_url!r}; {readiness_diagnostic}; "
                    f"vite={vite_output.decode(errors='replace')[-2000:]!r}"
                )
        process = await asyncio.create_subprocess_exec(
            "node",
            "tests/browser/workbench-authoring-db.cjs",
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        output, _ = await asyncio.wait_for(process.communicate(), 90)
        assert process.returncode == 0, output.decode()
        async with get_session_factory()() as session:
            service = build_workbench_service(session)
            current = await service.get_definition.execute(
                actor, created_definition.id, preview=True
            )
            await service.archive.execute(
                actor, created_definition.id, archived=True, expected_revision=current.revision
            )
        from app.modules.admin.models import FeatureFlag

        async with p.admin() as session:
            session.add(
                FeatureFlag(
                    key="react-workbench",
                    is_enabled=True,
                    description="Disposable Stage 6 browser Workspace",
                    rules={"workspaceIds": [str(p.workspace)]},
                )
            )
            await session.commit()
        documents_process = await asyncio.create_subprocess_exec(
            "node",
            "tests/browser/workbench-documents-db.cjs",
            env={
                **env,
                "WORKBENCH_BROWSER_URL": p.url,
                "WORKBENCH_APP_BASE": f"{p.url}/workbench/",
            },
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        documents_output, _ = await asyncio.wait_for(documents_process.communicate(), 90)
        assert documents_process.returncode == 0, documents_output.decode()
        async with p.admin() as session:
            assert (
                await session.scalar(
                    select(AuthSession.revoked_at).where(
                        AuthSession.user_id == p.user,
                        AuthSession.user_agent == "agent-factory-stage7-browser",
                    )
                )
                is not None
            )
    finally:
        if frontend.returncode is None:
            frontend.terminate()
        await frontend.wait()


async def test_claimed_collection_rejects_payload_identity_injection(platform):
    p = platform
    _, collection_id = await collection(p)
    run = await call(
        p, "collection_start", {"collection_id": collection_id, "request_key": uuid4().hex}
    )
    from app.modules.schedule.models import Job

    async with p.admin() as session:
        await session.execute(
            update(Job)
            .where(Job.id == UUID(run["job_id"]))
            .values(payload={"collection_run_id": run["run_id"], "workspace_id": str(p.other)})
        )
        await session.commit()
    assert await execute(p, run["job_id"]) == "failed"
    assert not p.requests


@pytest.mark.parametrize("complete_before_cancel", [False, True], ids=["claimed", "succeeded"])
async def test_cancellation_refreshes_cached_job_under_lock(platform, complete_before_cancel):
    """A second real session advances the Job after the canceller cached QUEUED."""
    p = platform
    _, collection_id = await collection(p)
    run = await call(
        p, "collection_start", {"collection_id": collection_id, "request_key": uuid4().hex}
    )
    job_id = UUID(run["job_id"])
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
                claimed.result = {"completed": True}
                claimed.finished_at = datetime.now(UTC)
                await worker_repository.append_event(claimed, "job.succeeded", {})
            finished_at, result = claimed.finished_at, claimed.result
            await worker_repository.commit()
        assert cached.status == JobStatus.QUEUED  # Keep the stale identity-map instance alive.
        service = ScheduleService(repository, CeleryJobPublisher(), p.settings)
        if complete_before_cancel:
            with pytest.raises(ConflictError) as error:
                await service.cancel(context, job_id)
            assert error.value.code == "job_not_cancellable"
            await canceller.rollback()
        else:
            cancelled = await service.cancel(context, job_id)
            assert cancelled is cached and cancelled.status == JobStatus.CANCEL_REQUESTED

    async with get_session_factory()() as observer:
        await apply_tenant_context(observer, TenantContext(p.user, p.org, p.workspace))
        repository = ScheduleRepository(observer)
        persisted = await repository.get_job(p.workspace, job_id)
        events = await repository.list_events(p.workspace, job_id)
        assert persisted.status == (
            JobStatus.SUCCEEDED if complete_before_cancel else JobStatus.CANCEL_REQUESTED
        )
        assert persisted.finished_at == finished_at and persisted.result == result
        assert persisted.attempt_count == 1
        assert [event.event_type for event in events] == [
            "job.queued",
            "job.running",
            "job.succeeded" if complete_before_cancel else "job.cancel_requested",
        ]
    assert not p.requests


async def template_transport_result(response):
    """Decode actual MCP data without placing base64 or credentials in diagnostics."""
    status = response.status_code
    assert status == 200, f"template HTTP status {status}"
    try:
        if response.headers.get("content-type", "").startswith("text/event-stream"):
            message = next(
                json.loads(line[5:].strip())
                for line in response.text.splitlines()
                if line.startswith("data:")
            )
        else:
            message = response.json()
        has_rpc_error = "error" in message
        assert not has_rpc_error, "template RPC returned an error"
        result = message["result"]
        failed = bool(result.get("isError"))
        assert not failed, "template tool returned an error"
        data_only = all(item.get("type") == "text" for item in result.get("content", []))
        assert data_only, "template response must contain only JSON text data"
        return result.get("structuredContent") or json.loads(result["content"][0]["text"])
    except (ValueError, KeyError, StopIteration, TypeError):
        pytest.fail("Malformed template MCP data response", pytrace=False)


async def test_document_template_authenticated_transport_fidelity_and_current_authority(platform):
    from app.modules.auth.models import ApiToken
    from app.modules.organization.models import OrganizationMembership
    from tests.support.inventory import assert_same_bytes, template_source_files

    p = platform
    arguments = {"request": {"operation": "manifest"}}
    params = {"name": "document_template", "arguments": arguments}
    # Actual registered transport and current read-only scope, no callback substitute.
    listed = decoded(await rpc(p, "tools/list", token="template_reader"))
    assert "document_template" in {tool["name"] for tool in listed["tools"]}
    async with p.admin() as session:
        granted = await session.scalar(
            select(ApiToken.scopes).where(
                ApiToken.user_id == p.user, ApiToken.name == "template_reader"
            )
        )
        assert set(granted) == {"workspace:read", "document:read"}
    assert (await rpc(p, "tools/call", params, token=None)).status_code == 401
    assert (
        await rpc(p, "tools/call", params, token="template_reader", workspace=p.other)
    ).status_code == 403
    denied_scope = await rpc(p, "tools/call", params, token="scope_only")
    if denied_scope.status_code == 200:
        rejected = bool(decoded(denied_scope).get("isError"))
        assert rejected, "document:read must be required for template delivery"
    else:
        assert denied_scope.status_code == 403

    async def read(request):
        response = await rpc(
            p,
            "tools/call",
            {"name": "document_template", "arguments": {"request": request}},
            token="template_reader",
        )
        return await template_transport_result(response)

    manifest = await read({"operation": "manifest"})
    assert manifest["accepted_pair"] is False
    assert manifest["chunk_limit"] == 65536
    baseline = template_source_files()  # Preserved original manifest/vendor/license bytes.
    assert set(manifest["files"]) == set(baseline)
    version = manifest["version"]
    for name, expected in baseline.items():
        metadata = manifest["files"][name]
        expected_size, expected_digest = len(expected), sha256(expected).hexdigest()
        assert metadata["size_bytes"] == expected_size, name
        assert metadata["sha256"] == expected_digest, name
        reconstructed = bytearray()
        offset = 0
        while offset is not None:
            chunk = await read(
                {
                    "operation": "read",
                    "path": name,
                    "version": version,
                    "offset": offset,
                    "limit": 65536,
                }
            )
            assert chunk["version"] == version
            assert chunk["path"] == name
            assert chunk["offset"] == offset
            try:
                content = base64.b64decode(chunk["content_base64"], validate=True)
            except ValueError:
                pytest.fail("Invalid base64 template chunk", pytrace=False)
            length = len(content)
            assert 0 < length <= 65536, name
            reconstructed.extend(content)
            next_offset = chunk["next_offset"]
            assert next_offset is None or next_offset == offset + length
            offset = next_offset
        assert_same_bytes(reconstructed, expected, name)
    # Same valid token loses effective authority when current DB membership is revoked.
    async with p.admin() as session:
        await session.execute(
            delete(OrganizationMembership).where(
                OrganizationMembership.organization_id == p.org,
                OrganizationMembership.user_id == p.user,
            )
        )
        await session.commit()
        record = await session.scalar(
            select(ApiToken).where(ApiToken.user_id == p.user, ApiToken.name == "template_reader")
        )
        assert record.revoked_at is None and record.expires_at > datetime.now(UTC)
    revoked = await rpc(p, "tools/call", params, token="template_reader")
    assert revoked.status_code in (401, 403)
    # Member bytes must be denied as well, even with a previously obtained version.
    revoked_member = await rpc(
        p,
        "tools/call",
        {
            "name": "document_template",
            "arguments": {
                "request": {"operation": "read", "path": "index.html", "version": version}
            },
        },
        token="template_reader",
    )
    assert revoked_member.status_code in (401, 403)
