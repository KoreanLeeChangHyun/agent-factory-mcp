"""Real PostgreSQL API verification. Use only a disposable migrated database."""

import asyncio
import os
from uuid import uuid4

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


async def verify():
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
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url=f"https://{settings.trusted_hosts[0] if settings.trusted_hosts[0] != '*' else 'localhost'}",
        ) as client:
            client.cookies.set("agent_factory_csrf", "planning-csrf")
            client.headers["X-CSRF-Token"] = "planning-csrf"

            async def request(method, path, expected=200, **kwargs):
                response = await client.request(method, path, **kwargs)
                assert response.status_code == expected, (response.status_code, response.text)
                return response.json() if response.status_code != 204 else None

            assert (await request("GET", prefix))["items"] == []
            await request("GET", other, 403)
            await request(
                "POST",
                prefix + "/items",
                404,
                json={
                    "kind": "feature",
                    "name": "Cross scope",
                    "parent_id": str(foreign_domain_id),
                },
            )
            domain = await request(
                "POST", prefix + "/items", 201, json={"kind": "domain", "name": "결제"}
            )
            feature = await request(
                "POST",
                prefix + "/items",
                201,
                json={
                    "kind": "feature",
                    "name": "카드 결제",
                    "parent_id": domain["id"],
                    "start_date": "2026-09-07",
                    "target_date": "2026-09-23",
                    "acceptance": "카드 승인과 취소",
                    "status": "active",
                },
            )
            issue = await request(
                "POST",
                prefix + "/items",
                201,
                json={
                    "kind": "issue",
                    "name": "승인 API",
                    "parent_id": feature["id"],
                    "assignee": "개발자",
                },
            )
            await request(
                "POST",
                prefix + "/items",
                422,
                json={"kind": "issue", "name": "잘못된 계층", "parent_id": domain["id"]},
            )
            await request(
                "POST",
                prefix + "/items",
                422,
                json={
                    "kind": "feature",
                    "name": "뒤집힌 기간",
                    "parent_id": domain["id"],
                    "start_date": "2026-09-25",
                    "target_date": "2026-09-01",
                },
            )
            await request(
                "POST",
                prefix + "/items",
                404,
                json={"kind": "feature", "name": "없는 상위 항목", "parent_id": str(uuid4())},
            )
            await request(
                "POST",
                prefix + "/items",
                422,
                json={"kind": "domain", "name": "임의 집계", "status": "done"},
            )
            await request("DELETE", prefix + f"/items/{domain['id']}?revision=1", 409)
            view = await request("GET", prefix)
            aggregate = next(r for r in view["items"] if r["id"] == domain["id"])
            assert (aggregate["start_date"], aggregate["target_date"], aggregate["status"]) == (
                "2026-09-07",
                "2026-09-23",
                "active",
            )
            await request(
                "PUT",
                prefix + f"/items/{domain['id']}",
                json={"name": "결제", "revision": 1, "start_date": "2026-09-10"},
            )
            projected = next(
                r for r in (await request("GET", prefix))["items"] if r["id"] == domain["id"]
            )
            assert projected["start_date"] == "2026-09-10"
            assert projected["configured_target_date"] is None
            assert projected["target_date"] == "2026-09-23"
            assert (
                projected["start_date_source"] == "explicit"
                and projected["target_date_source"] == "derived"
            )
            await request(
                "PUT",
                prefix + f"/items/{domain['id']}",
                422,
                json={
                    "name": "결제",
                    "revision": 2,
                    "start_date": "2026-10-01",
                    "target_date": "2026-09-01",
                },
            )
            await request(
                "PUT", prefix + f"/items/{domain['id']}", json={"name": "결제", "revision": 2}
            )
            projected = next(
                r for r in (await request("GET", prefix))["items"] if r["id"] == domain["id"]
            )
            assert (
                projected["configured_start_date"] is None
                and projected["start_date_source"] == "derived"
            )
            updated = await request(
                "PUT",
                prefix + f"/items/{issue['id']}",
                json={"name": "승인 API 수정", "status": "done", "revision": 1},
            )
            assert updated["revision"] == 2
            await request(
                "PUT",
                prefix + f"/items/{issue['id']}",
                409,
                json={"name": "오래된 수정", "revision": 1},
            )
            await request(
                "PUT", prefix + "/settings", json={"launch_date": "2026-09-30", "revision": 0}
            )
            await request(
                "PUT", prefix + "/settings", 409, json={"launch_date": None, "revision": 0}
            )
            assert (await request("GET", prefix))["settings"]["launch_date"] == "2026-09-30"
            del client.headers["X-CSRF-Token"]
            await request("POST", prefix + "/items", 403, json={"kind": "domain", "name": "CSRF"})
            client.headers["X-CSRF-Token"] = "planning-csrf"
            # A new HTTP request/session must see persisted data, without platform-admin bypass.
            assert (
                next(r for r in (await request("GET", prefix))["items"] if r["id"] == issue["id"])[
                    "status"
                ]
                == "done"
            )
            results = await asyncio.gather(
                *[
                    client.put(prefix + f"/items/{issue['id']}", json={"name": name, "revision": 2})
                    for name in ("동시 A", "동시 B")
                ]
            )
            assert sorted(r.status_code for r in results) == [200, 409]
            await request("DELETE", prefix + f"/items/{issue['id']}?revision=3", 204)
            await request("DELETE", prefix + f"/items/{feature['id']}?revision=1", 204)
            await request("DELETE", prefix + f"/items/{domain['id']}?revision=3", 204)
            assert (await request("GET", prefix))["items"] == []
            app.dependency_overrides[get_current_principal] = lambda: Principal(
                viewer_id, f"{viewer_id}@example.test", "Viewer", False
            )
            assert (await request("GET", prefix))["can_edit"] is False
            await request(
                "POST", prefix + "/items", 403, json={"kind": "domain", "name": "Viewer write"}
            )
        # Direct SELECT remains tenant-filtered even without service WHERE clauses.
        async with sessions() as session:
            await session.execute(text("SET LOCAL ROLE planning_verifier"))
            await apply_tenant_context(session, TenantContext(user_id, org_id, other_id))
            assert not list(await session.execute(text("SELECT * FROM plan_settings")))
        print(
            "Planning API PostgreSQL verification passed: CRUD, hierarchy, reload, RLS, RBAC, CSRF, dates, aggregate, revisions, concurrency, launch target."
        )
    finally:
        await engine.dispose()
        await dispose_engine()
        settings.database_url = original_database_url


def test_planning_postgres():
    import pytest

    if not os.environ.get("PLANNING_TEST_DATABASE_URL"):
        pytest.skip(
            "requires disposable migrated PLANNING_TEST_DATABASE_URL and planning_verifier role"
        )
    asyncio.run(verify())


if __name__ == "__main__":
    asyncio.run(verify())
