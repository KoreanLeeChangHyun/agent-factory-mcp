"""Real PostgreSQL API verification. Use only a disposable migrated database."""

import asyncio
import os
from uuid import UUID, uuid4

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.db.session import dispose_engine, get_session
from app.db.tenant import TenantContext, apply_tenant_context
from app.main import create_app
from app.modules.auth.dependencies import get_current_principal
from app.modules.auth.service import Principal
from app.modules.identity.models import User
from app.modules.organization.models import Organization, OrganizationMembership
from app.modules.organization.system_roles import (
    ORGANIZATION_MEMBER_ROLE_ID,
    VIEWER_ROLE_ID,
    WORKSPACE_OWNER_ROLE_ID,
)
from app.modules.planning.models import PlanItem
from app.modules.workspace.models import Workspace, WorkspaceMembership


async def verify_imports():
    engine = create_async_engine(os.environ["PLANNING_TEST_DATABASE_URL"])
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    user_id, org_id, workspace_id, other_id = [uuid4() for _ in range(4)]
    viewer_id, foreign_domain_id = uuid4(), uuid4()
    principal = Principal(user_id, f"{user_id}@example.test", "Planning Test", False)
    original_database_url = settings.database_url
    settings.database_url = os.environ["PLANNING_TEST_DATABASE_URL"]
    app = create_app()
    try:
        async with sessions() as session:
            await apply_tenant_context(
                session, TenantContext(user_id, org_id, is_platform_admin=True)
            )
            session.add(
                User(id=user_id, email=principal.email, display_name=principal.display_name)
            )
            session.add(Organization(id=org_id, name="Planning test", slug=str(org_id)))
            await session.flush()
            session.add_all(
                [
                    Workspace(id=wid, organization_id=org_id, name=str(wid), slug=str(wid))
                    for wid in (workspace_id, other_id)
                ]
            )
            await session.flush()
            session.add(
                WorkspaceMembership(
                    workspace_id=workspace_id, user_id=user_id, role_id=WORKSPACE_OWNER_ROLE_ID
                )
            )
            session.add(
                User(id=viewer_id, email=f"{viewer_id}@example.test", display_name="Viewer")
            )
            await session.flush()
            session.add(
                WorkspaceMembership(
                    workspace_id=workspace_id, user_id=viewer_id, role_id=VIEWER_ROLE_ID
                )
            )
            session.add(
                PlanItem(
                    id=foreign_domain_id, workspace_id=other_id, kind="domain", name="Other tenant"
                )
            )
            session.add_all(
                [
                    OrganizationMembership(
                        organization_id=org_id, user_id=uid, role_id=ORGANIZATION_MEMBER_ROLE_ID
                    )
                    for uid in (user_id, viewer_id)
                ]
            )
            await session.commit()
            await session.execute(text("SET ROLE planning_verifier"))
            assert not await session.scalar(
                text("SELECT rolsuper FROM pg_roles WHERE rolname=current_user")
            )
            await session.rollback()

        async def session_dependency():
            async with sessions() as session:
                await session.execute(text("SET LOCAL ROLE planning_verifier"))
                yield session

        app.dependency_overrides[get_session] = session_dependency
        app.dependency_overrides[get_current_principal] = lambda: principal
        prefix = f"/api/organizations/{org_id}/workspaces/{workspace_id}/plan"
        other = f"/api/organizations/{org_id}/workspaces/{other_id}/plan"
        async with (
            app.router.lifespan_context(app),
            httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app),
                base_url="https://localhost:8000",
            ) as client,
        ):
            client.cookies.set("agent_factory_csrf", "planning-csrf")
            client.headers["X-CSRF-Token"] = "planning-csrf"

            async def request(method, path, expected=200, **kwargs):
                response = await client.request(method, path, **kwargs)
                assert response.status_code == expected, (response.status_code, response.text)
                return response.json() if response.status_code != 204 else None

            from test_planning_import import proposal

            p = proposal().model_dump(mode="json")
            p["items"][1]["start_date"] = "2026-09-01"
            p["items"][1]["target_date"] = "2026-09-30"
            first = await request("POST", prefix + "/imports", json=p)
            assert first["can_apply"] and first["status"] == "preview"
            assert (await request("GET", prefix))["items"] == []
            assert len(await request("GET", prefix + "/imports")) == 1
            assert (await request("GET", prefix + "/imports/" + first["id"])) == first
            assert (await request("POST", prefix + "/imports", json=p))["id"] == first["id"]
            changed = {**p, "source": {**p["source"], "label": "다른 내용"}}
            await request("POST", prefix + "/imports", 409, json=changed)
            review = {"preview_digest": first["preview_digest"], "acknowledge_warnings": True}
            apply_path = prefix + "/imports/" + first["id"] + "/apply"
            await request("POST", apply_path, 422, json={**review, "acknowledge_warnings": False})
            await request("POST", apply_path, 409, json={**review, "preview_digest": "0" * 64})
            applied = await asyncio.gather(
                *[request("POST", apply_path, json=review) for _ in range(2)]
            )
            assert applied[0] == applied[1] and applied[0]["status"] == "applied"
            assert len((await request("GET", prefix))["items"]) == 3
            import json

            from mcp.shared.inbound import MCP_METHOD_HEADER, MCP_NAME_HEADER, encode_header_value

            connection_response = await client.post(
                prefix.removesuffix("/plan") + "/mcp-connections", json={"name": "Import test"}
            )
            assert connection_response.status_code < 300, connection_response.text
            token = connection_response.json()["token"]

            async def mcp_call(name, arguments, bearer=token):
                response = await client.post(
                    f"/mcp/workspaces/{workspace_id}/",
                    headers={
                        "Authorization": "Bearer " + bearer,
                        "Accept": "application/json, text/event-stream",
                        "MCP-Protocol-Version": "2026-07-28",
                        MCP_METHOD_HEADER: "tools/call",
                        MCP_NAME_HEADER: encode_header_value(name),
                    },
                    json={
                        "jsonrpc": "2.0",
                        "id": 1,
                        "method": "tools/call",
                        "params": {
                            "_meta": {
                                "io.modelcontextprotocol/protocolVersion": "2026-07-28",
                                "io.modelcontextprotocol/clientCapabilities": {},
                                "io.modelcontextprotocol/clientInfo": {
                                    "name": "import-test",
                                    "version": "1",
                                },
                            },
                            "name": name,
                            "arguments": arguments,
                        },
                    },
                )
                if response.status_code != 200:
                    return response.status_code, None
                raw = response.text
                body = (
                    json.loads(
                        next(
                            line[5:].strip()
                            for line in raw.splitlines()
                            if line.startswith("data:")
                        )
                    )
                    if raw.startswith("event:")
                    else response.json()
                )
                return response.status_code, body["result"]

            status, schema_result = await mcp_call("planning_schema", {})
            assert status == 200 and not schema_result.get("isError"), schema_result
            _, read_result = await mcp_call("planning_read", {})
            assert not read_result.get("isError"), read_result
            mcp_proposal = {**p, "request_key": str(uuid4())}
            _, preview_result = await mcp_call(
                "planning_import_preview", {"proposal": mcp_proposal}
            )
            assert not preview_result.get("isError"), preview_result
            mcp_preview = preview_result.get("structuredContent") or json.loads(
                preview_result["content"][0]["text"]
            )
            _, apply_result = await mcp_call(
                "planning_import_apply",
                {
                    "import_id": mcp_preview["id"],
                    "review": {
                        "preview_digest": mcp_preview["preview_digest"],
                        "acknowledge_warnings": True,
                    },
                },
            )
            assert not apply_result.get("isError"), apply_result
            _, denied = await mcp_call("planning_read", {"workspace_id": str(other_id)})
            assert denied.get("isError"), denied
            assert (await mcp_call("planning_read", {}, bearer="invalid"))[0] == 401
            # Fail after at least one INSERT to prove no partial rows survive.
            from sqlalchemy import event

            from app.modules.auth.authorization import (
                AuthorizationRepository,
                AuthorizationScope,
                AuthorizationService,
            )
            from app.modules.planning.import_schemas import ImportApply
            from app.modules.planning.import_service import PlanningImportService

            fault_payload = proposal().model_dump(mode="json")
            fault_payload["source"]["external_id"] = "rollback-source"
            fault_preview = await request("POST", prefix + "/imports", json=fault_payload)
            inserts = []

            def fail_second_item(conn, cursor, statement, parameters, context, executemany):
                if statement.startswith("INSERT INTO plan_items"):
                    inserts.append(statement)
                    if len(inserts) == 2:
                        raise RuntimeError("Injected import persistence failure")

            event.listen(engine.sync_engine, "before_cursor_execute", fail_second_item)
            try:
                async with sessions() as session:
                    auth = await AuthorizationService(AuthorizationRepository(session)).authorize(
                        principal, AuthorizationScope(org_id, workspace_id), "workspace.manage"
                    )
                    import pytest

                    with pytest.raises(RuntimeError, match="Injected import persistence failure"):
                        await PlanningImportService(session, auth).apply(
                            UUID(fault_preview["id"]),
                            ImportApply(
                                preview_digest=fault_preview["preview_digest"],
                                acknowledge_warnings=True,
                            ),
                        )
            finally:
                event.remove(engine.sync_engine, "before_cursor_execute", fail_second_item)
            assert len(inserts) == 2
            assert len((await request("GET", prefix))["items"]) == 3
            assert (await request("GET", prefix + "/imports/" + fault_preview["id"]))[
                "status"
            ] == "preview"
            # Stable source identities update in place; missing fields intentionally replace defaults.
            p["request_key"] = str(uuid4())
            p["items"][2]["name"] = "로그인 수정"
            second = await request("POST", prefix + "/imports", json=p)
            assert [o["action"] for o in second["operations"]].count("update") == 1
            result = await request(
                "POST",
                prefix + "/imports/" + second["id"] + "/apply",
                json={"preview_digest": second["preview_digest"], "acknowledge_warnings": True},
            )
            assert result["status"] == "applied"
            assert len((await request("GET", prefix))["items"]) == 3
            # Two independently reviewed batches cannot silently overwrite one another.
            p["request_key"] = str(uuid4())
            stale = await request("POST", prefix + "/imports", json=p)
            await request(
                "POST", prefix + "/items", 201, json={"kind": "domain", "name": "동시 수정"}
            )
            await request(
                "POST",
                prefix + "/imports/" + stale["id"] + "/apply",
                409,
                json={"preview_digest": stale["preview_digest"], "acknowledge_warnings": True},
            )
            # Foreign targets never leak or bind across workspaces.
            p["request_key"] = str(uuid4())
            p["items"][1]["existing_id"] = str(foreign_domain_id)
            invalid = await request("POST", prefix + "/imports", json=p)
            assert not invalid["can_apply"]
            await request(
                "POST",
                prefix + "/imports/" + invalid["id"] + "/apply",
                422,
                json={"preview_digest": invalid["preview_digest"], "acknowledge_warnings": True},
            )
            await request("GET", other + "/imports/" + first["id"], 403)
            client.headers.pop("X-CSRF-Token")
            await request("POST", prefix + "/imports", 403, json=p)
            client.headers["X-CSRF-Token"] = "planning-csrf"
            app.dependency_overrides[get_current_principal] = lambda: Principal(
                viewer_id, f"{viewer_id}@example.test", "Viewer", False
            )
            await request("GET", prefix + "/imports/" + first["id"])
            await request("POST", prefix + "/imports", 403, json=p)
            await request("POST", apply_path, 403, json=review)
        async with sessions() as session:
            await session.execute(text("SET LOCAL ROLE planning_verifier"))
            await apply_tenant_context(session, TenantContext(user_id, org_id, other_id))
            for table in ("plan_imports", "plan_source_links"):
                assert not list(await session.execute(text("SELECT * FROM " + table)))
    finally:
        await engine.dispose()
        await dispose_engine()
        settings.database_url = original_database_url


def test_planning_import_postgres():
    import pytest

    if not os.environ.get("PLANNING_TEST_DATABASE_URL"):
        pytest.skip("requires disposable migrated PostgreSQL")
    asyncio.run(verify_imports())
