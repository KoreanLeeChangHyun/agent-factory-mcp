"""Organization HTTP behavior under PostgreSQL forced tenant RLS."""

import os
from uuid import uuid4

import httpx
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db.session import get_session
from app.main import create_app
from app.modules.auth.dependencies import get_current_principal, get_email_sender
from app.modules.auth.service import Principal
from app.modules.identity.models import User
from app.modules.organization.permissions import CATALOG, validate_permissions
from app.modules.organization.system_roles import (
    ORGANIZATION_MEMBER_ROLE_ID,
    ORGANIZATION_OWNER_ROLE_ID,
    VIEWER_ROLE_ID,
)


def test_permission_catalog_has_distinct_actions_and_boundaries():
    assert CATALOG["document.delete"].scope == "workspace"
    assert CATALOG["workspace.create"].scope == "organization"
    assert validate_permissions("workspace", ["document.read"]) == {"document.read"}
    from app.common.errors import ApplicationError

    with pytest.raises(ApplicationError):
        validate_permissions("organization", ["document.read"])
    with pytest.raises(ApplicationError):
        validate_permissions("organization", ["organization.transfer"])
    with pytest.raises(ApplicationError):
        validate_permissions("workspace", ["document.manage"])


@pytest.mark.integration
@pytest.mark.asyncio
async def test_organization_members_roles_teams_invitations_and_isolation(monkeypatch):
    url = os.environ.get("ORGANIZATION_TEST_DATABASE_URL")
    if not url:
        pytest.skip("requires disposable ORGANIZATION_TEST_DATABASE_URL")
    engine = create_async_engine(url)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    owner = Principal(uuid4(), f"{uuid4().hex}@example.com", "Owner", False)
    member = Principal(uuid4(), f"{uuid4().hex}@example.com", "Member", False)
    outsider = Principal(uuid4(), f"{uuid4().hex}@example.com", "Other", False)
    current = owner
    messages = []

    class Sender:
        async def send_organization_invitation(self, email, organization_id, token):
            messages.append((email, str(organization_id), token))

    async def session_dependency():
        async with sessions() as session:
            await session.execute(text("SET LOCAL ROLE organization_verifier"))
            assert not await session.scalar(
                text("SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user")
            )
            yield session

    app = create_app()
    app.dependency_overrides[get_session] = session_dependency
    app.dependency_overrides[get_current_principal] = lambda: current
    app.dependency_overrides[get_email_sender] = Sender
    try:
        async with sessions() as session:
            for p in (owner, member, outsider):
                session.add(User(id=p.user_id, email=p.email, display_name=p.display_name))
            await session.commit()
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://localhost"
        ) as client:
            client.cookies.set("agent_factory_csrf", "organization-test")
            client.headers["X-CSRF-Token"] = "organization-test"

            async def request(method, path, expected=200, **kwargs):
                r = await client.request(method, path, **kwargs)
                assert r.status_code == expected, (method, path, r.status_code, r.text)
                return r.json() if r.content else None

            org = await request(
                "POST",
                "/api/organizations",
                201,
                json={"name": "Organization test", "slug": "organization-test"},
            )
            base = "/api/organizations/" + org["id"]
            overview = await request("GET", base)
            assert overview["slug"] == "organization-test"
            await request(
                "POST",
                "/api/organizations",
                409,
                json={"name": "Duplicate slug", "slug": "organization-test"},
            )
            await request(
                "POST",
                "/api/organizations",
                422,
                json={"name": "Invalid slug", "slug": "Invalid--Slug"},
            )
            generated_org = await request(
                "POST", "/api/organizations", 201, json={"name": "한글 조직"}
            )
            generated_overview = await request("GET", "/api/organizations/" + generated_org["id"])
            assert generated_overview["slug"].startswith("organization-")
            boundary_org = await request(
                "POST",
                "/api/organizations",
                201,
                json={"name": "a" * 29 + " b"},
            )
            boundary_overview = await request("GET", "/api/organizations/" + boundary_org["id"])
            assert "--" not in boundary_overview["slug"]
            await request(
                "PATCH",
                base,
                409,
                json={
                    "name": "Conflicting identifier",
                    "slug": generated_overview["slug"],
                    "revision": overview["revision"],
                },
            )
            await request("DELETE", "/api/organizations/" + generated_org["id"])
            await request("DELETE", "/api/organizations/" + boundary_org["id"])
            await request(
                "PATCH",
                base,
                json={
                    "name": "Renamed",
                    "slug": "renamed-organization",
                    "revision": overview["revision"],
                },
            )
            assert (await request("GET", base))["slug"] == "renamed-organization"
            await request(
                "PATCH", base, 409, json={"name": "Stale", "revision": overview["revision"]}
            )
            await request(
                "PATCH", f"{base}/members/{owner.user_id}", 409, json={"status": "suspended"}
            )
            catalog = await request("GET", base + "/permission-catalog")
            assert any(p["key"] == "document.delete" for p in catalog)
            ws = await request(
                "POST", base + "/workspaces", 201, json={"name": "Space", "slug": "space"}
            )
            role = await request(
                "POST",
                base + "/roles",
                201,
                json={
                    "name": "Reader",
                    "scope": "workspace",
                    "permissions": ["workspace.read", "document.read"],
                },
            )
            await request(
                "POST",
                base + "/roles",
                400,
                json={"name": "Wrong", "scope": "workspace", "permissions": ["member.remove"]},
            )
            invite = await request(
                "POST",
                base + "/invitations",
                201,
                json={
                    "email": member.email,
                    "role_id": str(ORGANIZATION_MEMBER_ROLE_ID),
                    "workspace_grants": [{"workspace_id": ws["id"], "role_id": role["id"]}],
                },
            )
            old_token = messages[-1][2]
            await request("POST", f"{base}/invitations/{invite['id']}/resend")
            token = messages[-1][2]
            assert token != old_token
            current = outsider
            await request("GET", base + "/members", 403)
            await request("POST", base + "/accept-invitation", 403, json={"token": token})
            current = member
            await request("POST", base + "/accept-invitation", 409, json={"token": old_token})
            await request("POST", base + "/accept-invitation", json={"token": token})
            await request("POST", base + "/accept-invitation", 409, json={"token": token})
            await request("GET", f"{base}/workspaces/{ws['id']}")
            await request(
                "PATCH",
                f"{base}/members/{owner.user_id}",
                403,
                json={"role_id": str(ORGANIZATION_MEMBER_ROLE_ID)},
            )
            await request("GET", f"{base}/workspaces/{ws['id']}/documents")
            await request(
                "POST",
                f"{base}/workspaces/{ws['id']}/documents",
                403,
                json={"title": "Forbidden", "slug": "forbidden", "document_type": "processed"},
            )
            await request("GET", f"{base}/workspaces/{ws['id']}/agents/definitions", 403)
            await request(
                "POST",
                "/api/auth/tokens",
                403,
                json={
                    "organization_id": org["id"],
                    "workspace_id": ws["id"],
                    "name": "forbidden",
                    "scopes": ["document:read"],
                },
            )
            current = owner
            token_record = await request(
                "POST",
                "/api/auth/tokens",
                200,
                json={
                    "organization_id": org["id"],
                    "workspace_id": ws["id"],
                    "name": "reader token",
                    "scopes": ["workspace:read", "document:read"],
                },
            )
            assert token_record["scopes"] == ["document:read", "workspace:read"]
            # Each newly exposed lifecycle action uses its dedicated permission.
            scope_base = f"{base}/workspaces/{ws['id']}"
            schedule_body = {
                "name": "Schedule",
                "task_type": "system.noop",
                "queue": "default",
                "interval_seconds": 60,
            }
            schedule = await request("POST", scope_base + "/schedules", 201, json=schedule_body)
            current = member
            await request(
                "PUT",
                scope_base + f"/schedules/{schedule['id']}",
                403,
                json={**schedule_body, "revision": schedule["revision"]},
            )
            await request(
                "PATCH",
                scope_base + f"/schedules/{schedule['id']}/enabled",
                403,
                json={"revision": schedule["revision"], "is_enabled": False},
            )
            await request("DELETE", scope_base + f"/schedules/{schedule['id']}", 403)
            await request("GET", scope_base + "/audit/export", 403)
            current = owner
            updated_schedule = await request(
                "PUT",
                scope_base + f"/schedules/{schedule['id']}",
                json={
                    **schedule_body,
                    "name": "Updated schedule",
                    "revision": schedule["revision"],
                },
            )
            await request(
                "PATCH",
                scope_base + f"/schedules/{schedule['id']}/enabled",
                409,
                json={"revision": schedule["revision"], "is_enabled": False},
            )
            toggled = await request(
                "PATCH",
                scope_base + f"/schedules/{schedule['id']}/enabled",
                json={"revision": updated_schedule["revision"], "is_enabled": False},
            )
            assert toggled["is_enabled"] is False
            await request("DELETE", scope_base + f"/schedules/{schedule['id']}", 204)
            assert await request("GET", scope_base + "/schedules") == []
            definition = await request(
                "POST",
                scope_base + "/agents/definitions",
                201,
                json={"name": "Disposable agent", "slug": "disposable-agent"},
            )
            current = member
            await request("DELETE", scope_base + f"/agents/definitions/{definition['id']}", 403)
            current = owner
            await request("DELETE", scope_base + f"/agents/definitions/{definition['id']}", 204)
            assert await request("GET", scope_base + "/agents/definitions") == []
            repository = await request(
                "POST",
                scope_base + "/repositories",
                201,
                json={"location": "https://example.com/repo.git"},
            )
            current = member
            await request("DELETE", scope_base + f"/repositories/{repository['id']}", 403)
            current = owner
            await request("DELETE", scope_base + f"/repositories/{repository['id']}", 204)
            assert await request("GET", scope_base + "/repositories") == []
            exported = await request("GET", scope_base + "/audit/export")
            assert exported["scope"] == "most_recent" and exported["limit"] == 200
            # Toggle and export work independently of update/read permissions.
            limited = await request(
                "POST",
                base + "/roles",
                201,
                json={
                    "name": "Schedule operator",
                    "scope": "workspace",
                    "permissions": ["schedule.toggle", "audit.export", "schedule.create"],
                },
            )
            await request(
                "PUT",
                f"{base}/assignments/{ws['id']}/members/{member.user_id}",
                json={"role_id": limited["id"]},
            )
            operator_schedule = await request(
                "POST",
                scope_base + "/schedules",
                201,
                json={**schedule_body, "name": "Operator schedule"},
            )
            current = member
            await request(
                "PUT",
                scope_base + f"/schedules/{operator_schedule['id']}",
                403,
                json={**schedule_body, "revision": operator_schedule["revision"]},
            )
            await request(
                "PATCH",
                scope_base + f"/schedules/{operator_schedule['id']}/enabled",
                json={"revision": operator_schedule["revision"], "is_enabled": True},
            )
            await request("GET", scope_base + "/audit", 403)
            await request("GET", scope_base + "/audit/export")
            await request(
                "POST",
                scope_base + "/schedules",
                403,
                json={**schedule_body, "task_type": "agent.run", "queue": "agents"},
            )
            async with sessions() as session:
                from uuid import UUID

                from app.modules.schedule.models import Schedule

                persisted = await session.get(Schedule, UUID(operator_schedule["id"]))
                assert persisted.created_by_user_id == owner.user_id
                assert persisted.execution_user_id == member.user_id
            current = owner
            await request("DELETE", scope_base + f"/schedules/{operator_schedule['id']}", 204)
            await request(
                "PUT",
                f"{base}/assignments/{ws['id']}/members/{member.user_id}",
                json={"role_id": role["id"]},
            )
            await request("DELETE", f"{base}/roles/{limited['id']}")
            members = await request("GET", base + "/members", params={"search": member.email})
            assert len(members) == 1
            detail = await request("GET", f"{base}/members/{member.user_id}")
            assert detail["workspaces"][0]["sources"][0]["source"] == "direct"
            await request("DELETE", f"{base}/roles/{role['id']}", 409)
            team = await request("POST", base + "/teams", 201, json={"name": "Design"})
            await request("PUT", f"{base}/teams/{team['id']}/members/{member.user_id}")
            await request(
                "PUT",
                f"{base}/teams/{team['id']}/workspaces/{ws['id']}",
                json={"role_id": str(VIEWER_ROLE_ID)},
            )
            detail = await request("GET", f"{base}/members/{member.user_id}")
            assert {s["source"] for s in detail["workspaces"][0]["sources"]} == {"direct", "team"}
            await request("DELETE", f"{base}/assignments/{ws['id']}/members/{member.user_id}")
            current = member
            await request("GET", f"{base}/workspaces/{ws['id']}")
            current = owner
            await request("PATCH", f"{base}/members/{member.user_id}", json={"status": "suspended"})
            current = member
            await request("GET", f"{base}/workspaces/{ws['id']}", 403)
            assert await request("GET", "/api/account/organizations") == []
            current = owner
            await request("PATCH", f"{base}/members/{member.user_id}", json={"status": "active"})
            await request("POST", base + "/transfer", json={"user_id": str(member.user_id)})
            current = member
            await request(
                "PATCH", f"{base}/members/{member.user_id}", 409, json={"status": "removed"}
            )
            current = owner
            await request(
                "PATCH", f"{base}/members/{member.user_id}", 403, json={"status": "suspended"}
            )
            current = member
            events = await request("GET", base + "/events")
            assert any(e["action"] == "organization.transfer" for e in events)
            # Organization removal must not strand a workspace's last active owner.
            await request(
                "PATCH", f"{base}/members/{owner.user_id}", 409, json={"status": "removed"}
            )
            await request(
                "PATCH", f"{base}/members/{owner.user_id}", 409, json={"status": "suspended"}
            )
            from app.modules.organization.system_roles import WORKSPACE_OWNER_ROLE_ID

            await request(
                "PUT",
                f"{base}/assignments/{ws['id']}/members/{member.user_id}",
                json={"role_id": str(WORKSPACE_OWNER_ROLE_ID)},
            )
            await request("PATCH", f"{base}/members/{owner.user_id}", json={"status": "suspended"})
            await request(
                "PUT",
                f"{base}/assignments/{ws['id']}/members/{member.user_id}",
                409,
                json={"role_id": str(VIEWER_ROLE_ID)},
            )
            await request("DELETE", f"{base}/assignments/{ws['id']}/members/{member.user_id}", 409)
            await request("PATCH", f"{base}/members/{owner.user_id}", json={"status": "active"})
            await request(
                "PUT",
                f"{base}/teams/{team['id']}",
                json={"name": "Renamed team", "description": "Updated"},
            )
            assert (await request("GET", base + "/teams"))[0]["name"] == "Renamed team"
            await request("DELETE", f"{base}/teams/{team['id']}")
            assert await request("GET", base + "/teams") == []
            await request(
                "PUT",
                f"{base}/roles/{role['id']}",
                json={
                    "name": "Read only document",
                    "scope": "workspace",
                    "permissions": ["document.read", "token.create"],
                },
            )
            # A pending invitation's JSON workspace grant prevents role deletion.
            invitation = await request(
                "POST",
                base + "/invitations",
                201,
                json={
                    "email": outsider.email,
                    "role_id": str(ORGANIZATION_MEMBER_ROLE_ID),
                    "workspace_grants": [{"workspace_id": ws["id"], "role_id": role["id"]}],
                },
            )
            await request("DELETE", f"{base}/roles/{role['id']}", 409)
            expired_token = messages[-1][2]
            async with sessions() as seed:
                await seed.execute(
                    text(
                        "UPDATE organization_invitations SET expires_at = now() - interval '1 second' WHERE id = :id"
                    ),
                    {"id": invitation["id"]},
                )
                await seed.commit()
            current = outsider
            await request("POST", base + "/accept-invitation", 409, json={"token": expired_token})
            current = member
            await request("POST", f"{base}/invitations/{invitation['id']}/resend")
            accept_token = messages[-1][2]
            current = outsider
            await request("POST", base + "/accept-invitation", json={"token": accept_token})
            # A token with just document.read must authenticate and keep its exact ceiling.
            issued = await request(
                "POST",
                "/api/auth/tokens",
                json={
                    "organization_id": org["id"],
                    "workspace_id": ws["id"],
                    "name": "Document only",
                    "scopes": ["document:read"],
                },
            )
            await request(
                "POST",
                "/api/auth/tokens",
                403,
                json={
                    "organization_id": org["id"],
                    "workspace_id": ws["id"],
                    "name": "Escalate",
                    "scopes": ["document:delete"],
                },
            )
            from app.common.errors import PermissionDeniedError
            from app.core.config import settings
            from app.mcp import server as mcp_module
            from app.mcp.auth import ApiTokenVerifier

            verified = await ApiTokenVerifier(settings).verify_token(issued["token"])
            assert verified is not None
            monkeypatch.setattr(mcp_module, "get_access_token", lambda: verified)
            token_session, token_context = await mcp_module._authorized_session(
                org["id"], ws["id"], "document:read", "document.read"
            )
            assert token_context.permissions == {"document.read"}
            await token_session.close()
            with pytest.raises(PermissionDeniedError):
                await mcp_module._authorized_session(
                    org["id"], ws["id"], "document:write", "document.delete"
                )
            current = member
            await request(
                "PATCH", f"{base}/members/{outsider.user_id}", json={"status": "suspended"}
            )
            assert await ApiTokenVerifier(settings).verify_token(issued["token"]) is None
            await request("PATCH", f"{base}/members/{outsider.user_id}", json={"status": "active"})
            await request("PATCH", f"{base}/members/{outsider.user_id}", json={"status": "removed"})
            await request(
                "PATCH", f"{base}/members/{outsider.user_id}", 409, json={"status": "active"}
            )
            await request(
                "PATCH", f"{base}/members/{outsider.user_id}", 409, json={"status": "suspended"}
            )
            reinvite = await request(
                "POST",
                base + "/invitations",
                201,
                json={"email": outsider.email, "role_id": str(ORGANIZATION_MEMBER_ROLE_ID)},
            )
            cancelled_token = messages[-1][2]
            await request("DELETE", f"{base}/invitations/{reinvite['id']}")
            current = outsider
            await request("POST", base + "/accept-invitation", 409, json={"token": cancelled_token})
            current = member
            await request(
                "POST",
                base + "/invitations",
                201,
                json={"email": outsider.email, "role_id": str(ORGANIZATION_MEMBER_ROLE_ID)},
            )
            current = outsider
            await request("POST", base + "/accept-invitation", json={"token": messages[-1][2]})
            assert await request("GET", f"{base}/workspaces") == []
            current = member
            await request("DELETE", f"{base}/roles/{role['id']}")
            # Closed invitations retain history without permanently pinning custom roles.
            transient = await request(
                "POST",
                base + "/roles",
                201,
                json={
                    "name": "Temporary",
                    "scope": "organization",
                    "permissions": ["organization.read"],
                },
            )
            closed = await request(
                "POST",
                base + "/invitations",
                201,
                json={"email": f"{uuid4().hex}@example.com", "role_id": transient["id"]},
            )
            await request("DELETE", f"{base}/invitations/{closed['id']}")
            await request("DELETE", f"{base}/roles/{transient['id']}")
            await request("POST", f"{base}/invitations/{closed['id']}/resend", 409)
            # Same caller owning two organizations cannot mix their role/team/workspace IDs.
            foreign = await request("POST", "/api/organizations", 201, json={"name": "Foreign"})
            foreign_base = "/api/organizations/" + foreign["id"]
            foreign_role = await request(
                "POST",
                foreign_base + "/roles",
                201,
                json={
                    "name": "Foreign role",
                    "scope": "workspace",
                    "permissions": ["document.read"],
                },
            )
            await request(
                "PUT",
                f"{base}/assignments/{ws['id']}/members/{outsider.user_id}",
                400,
                json={"role_id": foreign_role["id"]},
            )
            foreign_team = await request(
                "POST", foreign_base + "/teams", 201, json={"name": "Foreign team"}
            )
            await request(
                "PUT", f"{base}/teams/{foreign_team['id']}/members/{outsider.user_id}", 404
            )
            foreign_space = await request(
                "POST",
                foreign_base + "/workspaces",
                201,
                json={"name": "Foreign space", "slug": "foreign-space"},
            )
            foreign_schedule = await request(
                "POST",
                foreign_base + f"/workspaces/{foreign_space['id']}/schedules",
                201,
                json={**schedule_body, "name": "Deleted organization schedule"},
            )
            async with sessions() as session:
                from datetime import UTC, datetime, timedelta

                from app.modules.schedule.repository import ScheduleRepository
                from app.modules.workspace.models import Workspace, WorkspaceStatus

                space_record = await session.get(Workspace, UUID(foreign_space["id"]))
                space_record.status = WorkspaceStatus.INACTIVE
                await session.flush()
                due = await ScheduleRepository(session).due_schedules(
                    datetime.now(UTC) + timedelta(days=1)
                )
                assert UUID(foreign_schedule["id"]) not in {row.id for row in due}
                await session.rollback()
            await request("DELETE", foreign_base)
            async with sessions() as session:
                from datetime import UTC, datetime, timedelta

                from app.common.errors import ApplicationError
                from app.modules.schedule.models import Job
                from app.modules.schedule.repository import ScheduleRepository
                from app.worker.authority import authorize_job

                due = await ScheduleRepository(session).due_schedules(
                    datetime.now(UTC) + timedelta(days=1)
                )
                assert UUID(foreign_schedule["id"]) not in {row.id for row in due}
                with pytest.raises(ApplicationError):
                    await authorize_job(
                        session,
                        Job(
                            organization_id=UUID(foreign["id"]),
                            workspace_id=UUID(foreign_space["id"]),
                            requested_by_user_id=current.user_id,
                            task_type="system.noop",
                            schedule_id=UUID(foreign_schedule["id"]),
                        ),
                    )

            assert foreign["id"] not in {
                o["id"] for o in await request("GET", "/api/account/organizations")
            }
            await request("GET", foreign_base, 403)
            # Administrators cannot demote a higher custom workspace role or inherit it through a team.
            high = await request(
                "POST",
                base + "/roles",
                201,
                json={
                    "name": "High",
                    "scope": "workspace",
                    "permissions": ["workspace.read", "document.delete"],
                },
            )
            low = await request(
                "POST",
                base + "/roles",
                201,
                json={
                    "name": "Low",
                    "scope": "workspace",
                    "permissions": ["workspace.read", "workspace.manage_members"],
                },
            )
            await request(
                "PUT",
                f"{base}/assignments/{ws['id']}/members/{outsider.user_id}",
                json={"role_id": high["id"]},
            )
            await request(
                "PUT",
                f"{base}/assignments/{ws['id']}/members/{owner.user_id}",
                json={"role_id": low["id"]},
            )
            high_team = await request("POST", base + "/teams", 201, json={"name": "Privileged"})
            await request(
                "PUT",
                f"{base}/teams/{high_team['id']}/workspaces/{ws['id']}",
                json={"role_id": high["id"]},
            )
            current = owner
            await request(
                "PUT",
                f"{base}/assignments/{ws['id']}/members/{outsider.user_id}",
                403,
                json={"role_id": low["id"]},
            )
            await request("PUT", f"{base}/teams/{high_team['id']}/members/{owner.user_id}", 403)
            current = member
            # Two concurrent self-suspensions serialize; one active organization owner survives.
            concurrent = await request(
                "POST", "/api/organizations", 201, json={"name": "Concurrent owners"}
            )
            concurrent_base = "/api/organizations/" + concurrent["id"]
            await request(
                "POST",
                concurrent_base + "/invitations",
                201,
                json={"email": outsider.email, "role_id": str(ORGANIZATION_OWNER_ROLE_ID)},
            )
            current = outsider
            await request(
                "POST", concurrent_base + "/accept-invitation", json={"token": messages[-1][2]}
            )
            import asyncio
            from uuid import UUID

            from app.common.errors import ConflictError
            from app.modules.organization.schemas import MemberUpdate
            from app.modules.organization.command_service import OrganizationCommandService

            async def suspend_self(caller):
                async with sessions() as transaction:
                    await transaction.execute(text("SET LOCAL ROLE organization_verifier"))
                    service = OrganizationCommandService(
                        transaction, caller, UUID(concurrent["id"])
                    )
                    try:
                        await service.update_member(
                            caller.user_id, MemberUpdate(status="suspended")
                        )
                        return "suspended"
                    except ConflictError as exc:
                        await transaction.rollback()
                        return exc.code

            results = await asyncio.gather(suspend_self(member), suspend_self(outsider))
            assert sorted(results) == ["last_organization_owner", "suspended"]
    finally:
        await engine.dispose()


def test_token_scope_intersection_cannot_recover_ungranted_actions():
    from app.modules.organization.permissions import token_permissions

    user_permissions = frozenset({"document.read", "document.delete", "agent.execute"})
    assert user_permissions & token_permissions(["document:read"]) == {"document.read"}
    assert not token_permissions(["document:read"]) & {"document.delete", "document.update"}
    assert token_permissions(["document:write"]) >= {
        "document.create",
        "document.update",
        "document.delete",
    }
    assert not token_permissions(["organization:transfer", "unknown:action"])
