"""Real PostgreSQL RLS and official MCP HTTP transport, on disposable databases only."""

import os
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import httpx
import pytest
from sqlalchemy import delete, select, text, update

from app.core.config import settings
from app.db.session import dispose_engine, get_session_factory
from app.main import create_app
from app.modules.auth.crypto import token_digest
from app.modules.auth.models import ApiToken
from app.modules.auth.repository import AuthRepository
from app.modules.auth.service import Principal
from app.modules.identity.models import User
from app.modules.mcp_connection.models import MCPConnection
from app.modules.workspace.models import Workspace, WorkspaceMembership, WorkspaceStatus
from app.modules.workspace.schemas import WorkspaceCreate
from app.router.account import create_personal_workspace


@pytest.mark.integration
@pytest.mark.asyncio
async def test_workspace_connection_enrollment_isolation_and_verification(monkeypatch):
    url = os.environ.get("MCP_TEST_DATABASE_URL")
    if not url:
        pytest.skip("requires disposable migrated MCP_TEST_DATABASE_URL with non-superuser role")
    await dispose_engine()
    monkeypatch.setattr(settings, "database_url", url)
    monkeypatch.setattr(settings, "root_path", "/factory")
    monkeypatch.setattr(settings, "rate_limit_enabled", False)
    sessions = get_session_factory()
    owner = Principal(uuid4(), f"{uuid4().hex}@example.test", "MCP Test", False)
    login_token = uuid4().hex
    async with sessions() as session:
        assert not await session.scalar(
            text("SELECT rolsuper FROM pg_roles WHERE rolname=current_user")
        )
        await AuthRepository(session)._enable_identity_lookup()
        session.add(User(id=owner.user_id, email=owner.email, display_name=owner.display_name))
        await session.flush()
        await AuthRepository(session).create_session(
            user_id=owner.user_id,
            digest=token_digest(login_token, settings.auth_token_secret.get_secret_value()),
            expires_at=datetime.now(UTC) + timedelta(hours=1),
            user_agent="test",
        )
        await session.commit()
    async with sessions() as session:
        first = await create_personal_workspace(
            WorkspaceCreate(name="First", slug=uuid4().hex), owner, session
        )
    async with sessions() as session:
        second = await create_personal_workspace(
            WorkspaceCreate(name="Second", slug=uuid4().hex), owner, session
        )
    app = create_app()
    other_worker = create_app()
    async with (
        app.router.lifespan_context(app),
        other_worker.router.lifespan_context(other_worker),
        httpx.AsyncClient(
            transport=httpx.ASGITransport(app=other_worker), base_url="http://127.0.0.1:8000"
        ) as worker_client,
        httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://127.0.0.1:8000",
            cookies={settings.session_cookie_name: login_token, "agent_factory_csrf": "check"},
            headers={"X-CSRF-Token": "check"},
        ) as client,
    ):
        base = f"/factory/api/organizations/{first.organization_id}/workspaces/{first.id}/mcp-connections"
        result = await client.get(base)
        assert result.status_code == 200, result.text
        assert result.json() == {"state": "pending", "connections": []}
        issued = await client.post(base, json={"name": "VS Code"})
        assert issued.status_code == 201, issued.text
        connection = issued.json()
        assert issued.headers["cache-control"] == "no-store"
        assert (await client.get(base)).json()["state"] == "pending"
        secret_url = f"{base}/{connection['id']}/secret"
        revealed = await client.post(secret_url)
        assert revealed.status_code == 200, revealed.text
        assert revealed.json()["token"] == connection["token"]
        assert revealed.headers["cache-control"] == "no-store"
        assert (await client.delete(f"{base}/{connection['id']}/purge")).status_code == 409
        assert (await client.post(secret_url, headers={"X-CSRF-Token": "wrong"})).status_code == 403
        wrong_scope = f"/factory/api/organizations/{second.organization_id}/workspaces/{second.id}/mcp-connections/{connection['id']}/secret"
        assert (await client.post(wrong_scope)).status_code == 404
        state = (await client.get(base)).json()
        assert state["connections"][0]["retrievable"] is True
        assert connection["token"] not in str(state)
        async with sessions() as session:
            await AuthRepository(session)._enable_identity_lookup()
            stored = await session.scalar(
                select(MCPConnection).where(MCPConnection.id == connection["id"])
            )
            assert (
                stored.encrypted_token
                and connection["token"].encode() not in stored.encrypted_token
            )
        encrypted = stored.encrypted_token
        async with sessions() as session:
            await AuthRepository(session)._enable_identity_lookup()
            await session.execute(
                update(MCPConnection)
                .where(MCPConnection.id == connection["id"])
                .values(encrypted_token=b"invalid-ciphertext")
            )
            await session.commit()
        assert (await client.post(secret_url)).status_code == 409
        async with sessions() as session:
            await AuthRepository(session)._enable_identity_lookup()
            await session.execute(
                update(MCPConnection)
                .where(MCPConnection.id == connection["id"])
                .values(encrypted_token=encrypted)
            )
            await session.commit()
        assert (await client.post(secret_url)).json()["token"] == connection["token"]
        endpoint = f"/factory/mcp/workspaces/{first.id}/"
        headers = {
            "Authorization": f"Bearer {connection['token']}",
            "Accept": "application/json, text/event-stream",
            "MCP-Protocol-Version": "2026-07-28",
        }

        async def rpc(method, params=None, target=endpoint):
            return await client.post(
                target,
                headers={
                    **headers,
                    "MCP-Method": method,
                    **({"MCP-Name": params["name"]} if params and "name" in params else {}),
                },
                json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": method,
                    "params": {
                        "_meta": {
                            "io.modelcontextprotocol/protocolVersion": "2026-07-28",
                            "io.modelcontextprotocol/clientCapabilities": {},
                            "io.modelcontextprotocol/clientInfo": {
                                "name": "integration-test",
                                "version": "1",
                            },
                        },
                        **(params or {}),
                    },
                },
            )

        response = await rpc("tools/list", target=f"/factory/mcp/workspaces/{second.id}/")
        assert response.status_code == 403, response.text
        assert (await client.get(base)).json()["state"] == "pending"
        failed = await rpc(
            "tools/call", {"name": "document_list", "arguments": {"workspace_id": str(second.id)}}
        )
        assert '"isError":true' in failed.text
        assert (await client.get(base)).json()["state"] == "pending"
        denied = await client.post(
            base, headers={"X-CSRF-Token": "wrong"}, json={"name": "No CSRF"}
        )
        assert denied.status_code == 403
        response = await rpc("tools/list")
        assert response.status_code == 200, response.text
        assert "workspace_list" in response.text
        state = (await client.get(base)).json()
        assert state["state"] == "verified", state
        assert state["connections"][0]["first_confirmed_at"]
        # Legacy-protocol initialization and follow-up may land on different workers.
        legacy_headers = {
            "Authorization": f"Bearer {connection['token']}",
            "Accept": "application/json, text/event-stream",
        }
        initialized = await client.post(
            endpoint,
            headers=legacy_headers,
            json={
                "jsonrpc": "2.0",
                "id": 10,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-11-25",
                    "capabilities": {},
                    "clientInfo": {"name": "worker-test", "version": "1"},
                },
            },
        )
        assert initialized.status_code == 200
        legacy_headers["MCP-Protocol-Version"] = "2025-11-25"
        if initialized.headers.get("mcp-session-id"):
            legacy_headers["Mcp-Session-Id"] = initialized.headers["mcp-session-id"]
        cross_worker = await worker_client.post(
            endpoint,
            headers=legacy_headers,
            json={"jsonrpc": "2.0", "id": 11, "method": "tools/list", "params": {}},
        )
        assert cross_worker.status_code == 200, "MCP initialized on one worker must work on another"
        assert "workspace_list" in cross_worker.text
        assert "mcp-session-id" not in initialized.headers
        response = await rpc("tools/call", {"name": "document_list", "arguments": {}})
        assert response.status_code == 200 and '"isError":true' not in response.text, response.text
        response = await rpc(
            "tools/call",
            {"name": "document_list", "arguments": {"workspace_id": str(second.id)}},
        )
        assert '"isError":true' in response.text, response.text
        legacy = (await client.post(base, json={"name": "Legacy"})).json()
        async with sessions() as session:
            await AuthRepository(session)._enable_identity_lookup()
            await session.execute(
                update(MCPConnection)
                .where(MCPConnection.id == legacy["id"])
                .values(encrypted_token=None, encryption_key_version=None)
            )
            await session.commit()
        assert (await client.post(f"{base}/{legacy['id']}/secret")).status_code == 409
        await client.delete(f"{base}/{legacy['id']}")
        assert (
            await client.delete(f"{base}/{legacy['id']}/purge", headers={"X-CSRF-Token": "wrong"})
        ).status_code == 403
        assert (await client.delete(f"{base}/{legacy['id']}/purge")).status_code == 204
        assert (await client.post(f"{base}/{legacy['id']}/secret")).status_code == 404
        assert (await client.delete(f"{base}/{legacy['id']}/purge")).status_code == 404
        async with sessions() as session:
            await AuthRepository(session)._enable_identity_lookup()
            assert (
                await session.scalar(select(MCPConnection).where(MCPConnection.id == legacy["id"]))
                is None
            )
            assert (
                await session.scalar(
                    select(ApiToken).where(
                        ApiToken.token_digest
                        == token_digest(
                            legacy["token"], settings.auth_token_secret.get_secret_value()
                        )
                    )
                )
                is None
            )

        other = (await client.post(base, json={"name": "Second client"})).json()
        state = (await client.get(base)).json()
        assert state["state"] == "verified" and len(state["connections"]) == 2
        assert (
            next(row for row in state["connections"] if row["id"] == other["id"])["state"]
            == "pending"
        )
        revoked = await client.delete(f"{base}/{connection['id']}")
        assert revoked.status_code == 204, revoked.text
        assert (await client.post(secret_url)).status_code == 409
        assert (await rpc("tools/list")).status_code == 401
        assert (await client.get(base)).json()["state"] == "pending"
        headers["Authorization"] = f"Bearer {other['token']}"
        async with sessions() as session:
            await AuthRepository(session)._enable_identity_lookup()
            await session.execute(
                update(ApiToken)
                .where(ApiToken.name == "Second client", ApiToken.user_id == owner.user_id)
                .values(expires_at=datetime.now(UTC) - timedelta(seconds=1))
            )
            await session.commit()
        assert (await rpc("tools/list")).status_code == 401
        assert (await client.get(base)).json()["state"] == "reauth_required"
        assert (await client.post(f"{base}/{other['id']}/secret")).status_code == 409
        # A second authorized user sees only their own clients and cannot revoke ours.
        another = Principal(uuid4(), f"{uuid4().hex}@example.test", "Other user", False)
        another_login = uuid4().hex
        async with sessions() as session:
            repo = AuthRepository(session)
            await repo._enable_identity_lookup()
            role_id = await session.scalar(
                select(WorkspaceMembership.role_id).where(
                    WorkspaceMembership.workspace_id == first.id,
                    WorkspaceMembership.user_id == owner.user_id,
                )
            )
            session.add(
                User(id=another.user_id, email=another.email, display_name=another.display_name)
            )
            await session.flush()
            session.add(
                WorkspaceMembership(workspace_id=first.id, user_id=another.user_id, role_id=role_id)
            )
            await repo.create_session(
                user_id=another.user_id,
                digest=token_digest(another_login, settings.auth_token_secret.get_secret_value()),
                expires_at=datetime.now(UTC) + timedelta(hours=1),
                user_agent="other",
            )
            await session.commit()
        original_cookie = client.cookies.get(settings.session_cookie_name)
        client.cookies.set(settings.session_cookie_name, another_login)
        other_state = await client.get(base)
        assert other_state.status_code == 200, other_state.text
        assert other_state.json() == {"state": "pending", "connections": []}
        assert (await client.delete(f"{base}/{connection['id']}")).status_code == 404
        assert (await client.post(secret_url)).status_code == 404
        assert (await client.delete(f"{base}/{connection['id']}/purge")).status_code == 404
        own_connection = (await client.post(base, json={"name": "Other user's client"})).json()
        headers["Authorization"] = f"Bearer {own_connection['token']}"
        assert (await rpc("tools/list")).status_code == 200
        async with sessions() as session:
            await AuthRepository(session)._enable_identity_lookup()
            await session.execute(
                delete(WorkspaceMembership).where(WorkspaceMembership.user_id == another.user_id)
            )
            await session.commit()
        assert (await rpc("tools/list")).status_code == 401
        assert (await client.get(base)).status_code in {403, 404}
        assert (await client.post(f"{base}/{own_connection['id']}/secret")).status_code in {
            403,
            404,
        }
        client.cookies.set(settings.session_cookie_name, original_cookie)
        third = (await client.post(base, json={"name": "Inactive test"})).json()
        headers["Authorization"] = f"Bearer {third['token']}"
        async with sessions() as session:
            await AuthRepository(session)._enable_identity_lookup()
            await session.execute(
                update(Workspace)
                .where(Workspace.id == first.id)
                .values(status=WorkspaceStatus.INACTIVE)
            )
            await session.commit()
        assert (await rpc("tools/list")).status_code == 401
        assert (await rpc("tools/list", target="/factory/mcp/")).status_code == 401
