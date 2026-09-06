"""Non-superuser PostgreSQL + real authenticated MCP HTTP and read API coverage.

Run with scripts/verify-reporting.sh. Missing DB configuration is an error, not a skip.
"""

import asyncio
import json
import os
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import httpx
import pytest
from mcp.shared.inbound import (
    MCP_METHOD_HEADER,
    MCP_NAME_HEADER,
    NAME_BEARING_METHODS,
    encode_header_value,
)
from sqlalchemy import select, text, update
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.db.session import dispose_engine, get_session_factory
from app.db.tenant import TenantContext, apply_tenant_context
from app.main import create_app
from app.modules.auth.crypto import token_digest
from app.modules.auth.models import ApiToken
from app.modules.auth.repository import AuthRepository
from app.modules.auth.service import Principal
from app.modules.document.models import Document, DocumentType
from app.modules.identity.models import User
from app.modules.organization.system_roles import VIEWER_ROLE_ID, WORKSPACE_OWNER_ROLE_ID
from app.modules.planning.models import PlanItem
from app.modules.reporting.models import ReportAgent, ReportResult, ReportTask, TaskReport
from app.modules.workspace.models import WorkspaceMembership
from app.modules.workspace.schemas import WorkspaceCreate
from app.router.account import create_personal_workspace


def rpc_body(response):
    assert response.status_code == 200, response.text
    if response.headers.get("content-type", "").startswith("text/event-stream"):
        value = next(
            json.loads(line[5:].strip())
            for line in response.text.splitlines()
            if line.startswith("data:")
        )
    else:
        value = response.json()
    assert "result" in value, value
    return value["result"]


def tool_value(result):
    if result.get("isError"):
        # The entire error text is the public JSON contract; never strip SDK prefixes.
        assert len(result["content"]) == 1 and result["content"][0]["type"] == "text"
        assert result.get("structuredContent") is None
        error = json.loads(result["content"][0]["text"])
        assert set(error) == {"code", "message"}, error
        return error
    if "structuredContent" in result:
        return result["structuredContent"]
    return json.loads(next(block["text"] for block in result["content"] if block["type"] == "text"))


@pytest.mark.integration
@pytest.mark.asyncio
async def test_reporting_postgres_and_mcp(monkeypatch):
    url = os.environ["REPORTING_TEST_DATABASE_URL"]
    await dispose_engine()
    monkeypatch.setattr(settings, "database_url", url)
    monkeypatch.setattr(settings, "root_path", "")
    monkeypatch.setattr(settings, "rate_limit_enabled", False)
    sessions = get_session_factory()
    owner = Principal(uuid4(), f"{uuid4()}@example.test", "Reporting owner", False)
    login = uuid4().hex
    async with sessions() as session:
        assert not await session.scalar(
            text("SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user")
        )
        await AuthRepository(session)._enable_identity_lookup()
        session.add(User(id=owner.user_id, email=owner.email, display_name=owner.display_name))
        await session.flush()
        await AuthRepository(session).create_session(
            user_id=owner.user_id,
            digest=token_digest(login, settings.auth_token_secret.get_secret_value()),
            expires_at=datetime.now(UTC) + timedelta(hours=1),
            user_agent="report-test",
        )
        await session.commit()
    async with sessions() as session:
        first = await create_personal_workspace(
            WorkspaceCreate(name="Reports", slug=uuid4().hex), owner, session
        )
    async with sessions() as session:
        second = await create_personal_workspace(
            WorkspaceCreate(name="Other", slug=uuid4().hex), owner, session
        )
    plan_id, document_id, foreign_doc = uuid4(), uuid4(), uuid4()
    async with sessions() as session:
        await apply_tenant_context(
            session, TenantContext(owner.user_id, first.organization_id, first.id)
        )
        session.add(
            PlanItem(id=plan_id, workspace_id=first.id, kind="domain", name="Actual planning item")
        )
        session.add(
            Document(
                id=document_id,
                workspace_id=first.id,
                document_type=DocumentType.PROCESSED,
                title="Actual result",
                slug=uuid4().hex,
            )
        )
        await session.commit()
        await apply_tenant_context(
            session, TenantContext(owner.user_id, second.organization_id, second.id)
        )
        session.add(
            Document(
                id=foreign_doc,
                workspace_id=second.id,
                document_type=DocumentType.PROCESSED,
                title="Other result",
                slug=uuid4().hex,
            )
        )
        await session.commit()
    app = create_app()
    try:
        async with (
            app.router.lifespan_context(app),
            httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app),
                base_url="http://127.0.0.1:8000",
                cookies={settings.session_cookie_name: login, "agent_factory_csrf": "report-csrf"},
                headers={"X-CSRF-Token": "report-csrf"},
            ) as client,
        ):
            base = f"/api/organizations/{first.organization_id}/workspaces/{first.id}"
            other = f"/api/organizations/{second.organization_id}/workspaces/{second.id}"
            connection = (
                await client.post(base + "/mcp-connections", json={"name": "Reporter"})
            ).json()
            headers = {
                "Authorization": f"Bearer {connection['token']}",
                "Accept": "application/json, text/event-stream",
                "MCP-Protocol-Version": "2026-07-28",
            }
            endpoint = f"/mcp/workspaces/{first.id}/"

            async def rpc(method, params):
                # Mirror the SDK client's method-specific routing and header encoding.
                request_headers = {**headers, MCP_METHOD_HEADER: method}
                name_key = NAME_BEARING_METHODS.get(method)
                if name_key is not None and isinstance(name := params.get(name_key), str):
                    request_headers[MCP_NAME_HEADER] = encode_header_value(name)
                return await client.post(
                    endpoint,
                    headers=request_headers,
                    json={
                        "jsonrpc": "2.0",
                        "id": 1,
                        "method": method,
                        "params": {
                            "_meta": {
                                "io.modelcontextprotocol/protocolVersion": "2026-07-28",
                                "io.modelcontextprotocol/clientCapabilities": {},
                                "io.modelcontextprotocol/clientInfo": {
                                    "name": "reporting-test",
                                    "version": "1",
                                },
                            },
                            **params,
                        },
                    },
                )

            async def call(command, failure=False, code=None):
                result = rpc_body(
                    await rpc(
                        "tools/call", {"name": "reporting_write", "arguments": {"command": command}}
                    )
                )
                assert bool(result.get("isError")) == failure, result
                if code is not None:
                    assert failure
                    error = tool_value(result)
                    assert set(error) == {"code", "message"}, error
                    assert error["code"] == code and error["message"], error
                return result if failure else tool_value(result)

            async def read(task_id=None):
                result = rpc_body(
                    await rpc(
                        "tools/call",
                        {
                            "name": "reporting_read",
                            "arguments": {"task_id": task_id} if task_id else {},
                        },
                    )
                )
                assert not result.get("isError"), result
                return tool_value(result)

            guide = rpc_body(
                await rpc("resources/read", {"uri": "agent-factory://reporting/guide"})
            )
            assert "reporting_write" in guide["contents"][0]["text"]
            aid, bid, tid = [str(uuid4()) for _ in range(3)]
            agent = {
                "key": "agent-1",
                "operation": "agent",
                "agent": {
                    "id": aid,
                    "revision": 0,
                    "name": "Reporter",
                    "role": "Work",
                    "responsibilities": "Implement",
                },
            }
            config = await call(agent)
            assert config["record"]["last_report_at"] is None
            assert await call(agent) == config
            await call(
                {**agent, "agent": {**agent["agent"], "name": "Conflict"}},
                True,
                "report_idempotency_conflict",
            )
            child = {
                "key": "child",
                "operation": "agent",
                "agent": {**agent["agent"], "id": bid, "name": "Child", "parent_id": aid},
            }
            await call(child)
            await call(
                {
                    "key": "cycle",
                    "operation": "agent",
                    "agent": {**agent["agent"], "revision": 1, "parent_id": bid},
                },
                True,
            )
            await call(
                {
                    "key": "missing-parent",
                    "operation": "agent",
                    "agent": {**agent["agent"], "revision": 1, "parent_id": str(uuid4())},
                },
                True,
                "report_record_not_found",
            )
            await call(
                {
                    "key": "stale-config",
                    "operation": "agent",
                    "agent": {**agent["agent"], "revision": 0},
                },
                True,
                "report_revision_conflict",
            )
            config_update = {
                "key": "config-update",
                "operation": "agent",
                "agent": {**agent["agent"], "revision": 1, "name": "Updated reporter"},
            }
            updated = await call(config_update)
            assert updated["record"]["revision"] == 2
            assert updated["record"]["name"] == "Updated reporter"
            assert updated["record"]["updated_at"]
            assert await call(config_update) == updated
            persisted = next(r for r in (await read())["agents"] if r["id"] == aid)
            assert persisted == updated["record"]
            missing = rpc_body(
                await rpc(
                    "tools/call",
                    {
                        "name": "reporting_read",
                        "arguments": {"task_id": str(uuid4())},
                    },
                )
            )
            assert missing["isError"]
            assert tool_value(missing)["code"] == "report_record_not_found"
            assert tool_value(missing)["message"]
            task = {
                "key": "task-1",
                "operation": "task",
                "task": {
                    "id": tid,
                    "agent_id": aid,
                    "name": "Report work",
                    "plan_item_id": str(plan_id),
                },
            }
            await call(task)
            await call({**task, "key": "task-duplicate"}, True)
            self_id = str(uuid4())
            await call(
                {
                    "key": "self-task",
                    "operation": "task",
                    "task": {**task["task"], "id": self_id, "parent_id": self_id},
                },
                True,
            )
            assert (await read())["tasks"][0]["status"] == "pending"
            assert (await client.get(other + "/reporting")).json()["tasks"] == []
            assert (await client.get(other + f"/reporting/tasks/{tid}")).status_code == 404
            # Bound token rejects an explicitly mismatched scope even for an owner of both.
            mismatch = rpc_body(
                await rpc(
                    "tools/call",
                    {"name": "reporting_read", "arguments": {"workspace_id": str(second.id)}},
                )
            )
            assert mismatch["isError"]
            assert tool_value(mismatch)["code"] == "workspace_token_mismatch"

            async def report(key, revision, status="in_progress", **extra):
                return {
                    "key": key,
                    "operation": "report",
                    "report": {
                        "id": tid,
                        "revision": revision,
                        "status": status,
                        "message": key,
                        **extra,
                    },
                }

            await call(await report("too-early", 1, "completed"), True, "invalid_transition")
            start = await report("start", 1)
            started = await call(start)
            assert started["record"]["progress"] is None and started["record"]["started_at"]
            assert started["record"]["revision"] == 2 and started["record"]["updated_at"]
            assert (await read(tid))["task"] == started["record"]
            assert await call(start) == started
            assert len((await read(tid))["reports"]) == 1
            await call(await report("stale", 1), True, "report_revision_conflict")
            # Concurrent revision race and concurrent duplicate retry are independently checked.
            commands = [await report(f"race-{n}", 2, progress=10 + n) for n in (1, 2)]
            results = await asyncio.gather(
                *[
                    rpc("tools/call", {"name": "reporting_write", "arguments": {"command": c}})
                    for c in commands
                ]
            )
            assert sorted(bool(rpc_body(r).get("isError")) for r in results) == [False, True]
            conflict = next(rpc_body(r) for r in results if rpc_body(r).get("isError"))
            assert tool_value(conflict)["code"] == "report_revision_conflict"
            duplicate = await report("parallel-duplicate", 3, "input_required")
            duplicates = await asyncio.gather(call(duplicate), call(duplicate))
            assert duplicates[0] == duplicates[1]
            # Reconnect as same user; configuration/report history survives token replacement.
            next_connection = (
                await client.post(base + "/mcp-connections", json={"name": "Resumed reporter"})
            ).json()
            headers["Authorization"] = f"Bearer {next_connection['token']}"
            await call(await report("resume", 4))
            await call(
                await report(
                    "foreign-result",
                    5,
                    "completed",
                    results=[{"label": "no", "document_id": str(foreign_doc)}],
                ),
                True,
            )
            done = await call(
                await report(
                    "finish",
                    5,
                    "completed",
                    results=[
                        {"label": "Document", "document_id": str(document_id)},
                        {"label": "External", "url": "https://example.com/result"},
                    ],
                )
            )
            assert done["record"]["finished_at"] and done["record"]["progress"] in (11, 12)
            await call(await report("terminal-immutable", 6), True)
            detail = (await client.get(base + f"/reporting/tasks/{tid}")).json()
            assert done["record"]["revision"] == 6 and done["record"]["updated_at"]
            assert detail["task"] == done["record"]
            assert (
                len(detail["reports"]) == 5
                and len(detail["results"]) == 2
                and len(detail["logs"]) == 5
            )
            assert {r["connection_id"] for r in detail["reports"]} == {
                connection["id"],
                next_connection["id"],
            }
            assert (await client.get(base + "/plan")).json()["items"][0]["status"] == "pending"
            assert (
                await client.delete(base + f"/plan/items/{plan_id}?revision=1")
            ).status_code == 409
            assert (await client.get(base + f"/documents/{document_id}")).status_code == 200
            assert (await client.get(base + f"/reporting/tasks/{tid}?before_revision=4")).json()[
                "reports"
            ][0]["revision"] == 3
            # Terminal failure/cancellation streams and input-required resumption.
            for final in ("failed", "cancelled"):
                new_id = str(uuid4())
                await call(
                    {
                        "key": final + "-task",
                        "operation": "task",
                        "task": {**task["task"], "id": new_id},
                    }
                )
                if final == "failed":
                    await call(
                        {
                            "key": "failure-start",
                            "operation": "report",
                            "report": {
                                "id": new_id,
                                "revision": 1,
                                "status": "in_progress",
                                "message": "start",
                            },
                        }
                    )
                await call(
                    {
                        "key": final,
                        "operation": "report",
                        "report": {
                            "id": new_id,
                            "revision": 2 if final == "failed" else 1,
                            "status": final,
                            "message": final,
                        },
                    }
                )
            history_id = str(uuid4())
            await call(
                {
                    "key": "history-task",
                    "operation": "task",
                    "task": {**task["task"], "id": history_id},
                }
            )
            for revision in range(1, 53):
                await call(
                    {
                        "key": f"history-{revision}",
                        "operation": "report",
                        "report": {
                            "id": history_id,
                            "revision": revision,
                            "status": "in_progress",
                            "message": "Measured heartbeat",
                        },
                    }
                )
            history = await read(history_id)
            assert len(history["reports"]) == 50 and history["next_before_revision"] == 4
            earlier = (
                await client.get(base + f"/reporting/tasks/{history_id}?before_revision=4")
            ).json()
            assert [r["revision"] for r in earlier["reports"]] == [3, 2]
            assert earlier["next_before_revision"] is None
            # Another workspace manager can read but cannot claim this reporter.
            another = Principal(uuid4(), f"{uuid4()}@example.test", "Another", False)
            another_login = uuid4().hex
            async with sessions() as session:
                await AuthRepository(session)._enable_identity_lookup()
                session.add(
                    User(id=another.user_id, email=another.email, display_name=another.display_name)
                )
                await session.flush()
                session.add(
                    WorkspaceMembership(
                        workspace_id=first.id,
                        user_id=another.user_id,
                        role_id=WORKSPACE_OWNER_ROLE_ID,
                    )
                )
                await AuthRepository(session).create_session(
                    user_id=another.user_id,
                    digest=token_digest(
                        another_login, settings.auth_token_secret.get_secret_value()
                    ),
                    expires_at=datetime.now(UTC) + timedelta(hours=1),
                    user_agent="test",
                )
                await session.commit()
            client.cookies.set(settings.session_cookie_name, another_login)
            foreign_connection = (
                await client.post(base + "/mcp-connections", json={"name": "Another"})
            ).json()
            headers["Authorization"] = f"Bearer {foreign_connection['token']}"
            assert (await client.get(base + "/reporting")).status_code == 200
            await call(
                {
                    "key": "claim-agent",
                    "operation": "agent",
                    "agent": {**agent["agent"], "revision": 1},
                },
                True,
            )
            await call(
                {
                    "key": "claim-task",
                    "operation": "task",
                    "task": {**task["task"], "id": str(uuid4())},
                },
                True,
            )
            denied = await call(await report("claim-report", 6), True, "report_owner_required")
            assert "registering user" in str(denied)
            # Scope denial independently of RBAC.
            async with sessions() as session:
                await AuthRepository(session)._enable_identity_lookup()
                await session.execute(
                    update(ApiToken)
                    .where(ApiToken.user_id == another.user_id)
                    .values(scopes=["workspace:read", "agent:read"])
                )
                await session.commit()
            await call(
                {
                    "key": "scope-denial",
                    "operation": "agent",
                    "agent": {**agent["agent"], "id": str(uuid4())},
                },
                True,
            )
            # Restore token scope, remove manage permission: RBAC must still deny writes.
            async with sessions() as session:
                await AuthRepository(session)._enable_identity_lookup()
                await session.execute(
                    update(ApiToken)
                    .where(ApiToken.user_id == another.user_id)
                    .values(scopes=["workspace:read", "agent:read", "agent:report"])
                )
                await session.execute(
                    update(WorkspaceMembership)
                    .where(WorkspaceMembership.user_id == another.user_id)
                    .values(role_id=VIEWER_ROLE_ID)
                )
                await session.commit()
            await call(
                {
                    "key": "rbac-denial",
                    "operation": "agent",
                    "agent": {**agent["agent"], "id": str(uuid4())},
                },
                True,
            )
            assert (await client.get(base + "/reporting")).status_code == 200
            assert (await client.get(other + "/reporting")).status_code == 403
            # Revocation blocks all later MCP reports.
            client.cookies.set(settings.session_cookie_name, login)
            headers["Authorization"] = f"Bearer {next_connection['token']}"
            assert (
                await client.delete(base + f"/mcp-connections/{next_connection['id']}")
            ).status_code == 204
            assert (await rpc("tools/list", {})).status_code == 401
        # Direct non-superuser RLS reads, ownership writes, immutable report history.
        async with sessions() as session:
            await apply_tenant_context(
                session, TenantContext(owner.user_id, second.organization_id, second.id)
            )
            assert not list(await session.scalars(select(ReportAgent)))
            assert not list(await session.scalars(select(TaskReport)))
            assert not list(await session.scalars(select(ReportResult)))
            await session.rollback()
            await apply_tenant_context(
                session, TenantContext(another.user_id, first.organization_id, first.id)
            )
            changed = await session.execute(
                update(ReportAgent).where(ReportAgent.id == UUID(aid)).values(name="forged")
            )
            assert changed.rowcount == 0
            await session.rollback()
            await apply_tenant_context(
                session, TenantContext(owner.user_id, first.organization_id, first.id)
            )
            changed = await session.execute(update(TaskReport).values(message="forged"))
            assert changed.rowcount == 0
            await session.rollback()
            # RLS rejects references to another tenant's reporter.
            await apply_tenant_context(
                session, TenantContext(owner.user_id, second.organization_id, second.id)
            )
            with pytest.raises(DBAPIError):
                session.add(
                    ReportTask(
                        id=uuid4(),
                        workspace_id=second.id,
                        agent_id=UUID(aid),
                        name="cross tenant",
                        description="",
                    )
                )
                await session.flush()
            await session.rollback()
        # Bypass RLS only in this separate disposable-DB connection to prove the FK itself.
        admin_engine = create_async_engine(os.environ["REPORTING_TEST_ADMIN_DATABASE_URL"])
        try:
            async with async_sessionmaker(admin_engine)() as session:
                assert await session.scalar(
                    text("SELECT rolsuper FROM pg_roles WHERE rolname=current_user")
                )
                session.add(
                    ReportTask(
                        id=uuid4(),
                        workspace_id=second.id,
                        agent_id=UUID(aid),
                        name="invalid composite reference",
                        description="",
                    )
                )
                with pytest.raises(IntegrityError):
                    await session.flush()
                await session.rollback()
                # Composite Document reference cannot cross the tenant even for database admin.
                session.add(
                    ReportResult(
                        workspace_id=first.id,
                        report_id=UUID(detail["reports"][0]["id"]),
                        label="invalid",
                        summary="",
                        document_id=foreign_doc,
                    )
                )
                with pytest.raises(IntegrityError):
                    await session.flush()
                await session.rollback()
        finally:
            await admin_engine.dispose()
    finally:
        await dispose_engine()
