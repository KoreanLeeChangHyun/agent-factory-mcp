"""First-use personal provisioning keeps ownership and authorization bound to the caller."""

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.db.session import get_session
from app.main import create_app
from app.modules.auth.dependencies import get_current_principal
from app.modules.auth.service import Principal
from app.modules.organization.models import Organization, OrganizationMembership, Role, RoleScope, MembershipStatus
from app.modules.organization.system_roles import ORGANIZATION_OWNER_ROLE_ID
from app.modules.workspace.models import Workspace, WorkspaceStatus
from app.modules.workspace.schemas import WorkspaceCreate
from app.router.account import create_personal_workspace


class ProvisionSession:
    def __init__(self, existing=None):
        self.existing = existing
        self.added = []
        self.context = {}
        self.query = None
        self.lock = None
        self.scalar_calls = 0

    async def execute(self, statement, parameters=None):
        sql = str(statement)
        if "pg_advisory_xact_lock" in sql:
            self.lock = parameters["key"]
        if "'app.is_platform_admin', 'true'" in sql:
            self.context["app.is_platform_admin"] = "true"
        if parameters and "key" in parameters and "value" in parameters:
            self.context[parameters["key"]] = parameters["value"]

    async def scalar(self, statement):
        sql = str(statement)
        if "FROM organization_memberships JOIN organizations" in sql:
            return OrganizationMembership(role_id=ORGANIZATION_OWNER_ROLE_ID, status=MembershipStatus.ACTIVE)
        if "FROM roles" in sql:
            return Role(id=ORGANIZATION_OWNER_ROLE_ID, name="organization_owner", scope=RoleScope.ORGANIZATION)
        self.query = statement
        return self.existing

    async def scalars(self, statement):
        self.scalar_calls += 1
        return ["workspace.create"]

    def add(self, record):
        self.added.append(record)

    async def flush(self):
        pass


@pytest.mark.asyncio
@pytest.mark.parametrize("has_personal", [False, True])
async def test_personal_create_reuses_owner_and_restores_privileges(monkeypatch, has_personal):
    principal = Principal(uuid4(), "owner@example.com", "Owner", False)
    existing = (
        Organization(id=uuid4(), name="Personal", slug="personal", is_personal=True)
        if has_personal
        else None
    )
    session = ProvisionSession(existing)

    async def create(service, context, name, slug):
        assert context.principal == principal
        assert context.permissions == frozenset({"workspace.create"})
        assert session.context["app.is_platform_admin"] == "false"
        assert session.context["app.current_user_id"] == str(principal.user_id)
        assert session.context["app.current_organization_id"] == str(context.scope.organization_id)
        now = datetime.now(UTC)
        return Workspace(
            id=uuid4(),
            organization_id=context.scope.organization_id,
            name=name,
            slug=slug,
            status=WorkspaceStatus.ACTIVE,
            revision=1,
            created_at=now,
            updated_at=now,
        )

    monkeypatch.setattr("app.router.account.WorkspaceService.create", create)
    result = await create_personal_workspace(
        WorkspaceCreate(name="Project", slug="project"), principal, session
    )
    assert session.lock == f"personal-workspace:{principal.user_id}"
    assert principal.user_id in session.query.compile().params.values()
    memberships = [row for row in session.added if isinstance(row, OrganizationMembership)]
    if has_personal:
        assert result.organization_id == existing.id
        assert not session.added
    else:
        assert len(memberships) == 1
        assert memberships[0].user_id == principal.user_id
        assert memberships[0].organization_id == result.organization_id
        assert memberships[0].role_id == ORGANIZATION_OWNER_ROLE_ID


def test_personal_create_requires_csrf_before_provisioning():
    app = create_app()
    app.dependency_overrides[get_current_principal] = lambda: Principal(
        uuid4(), "a@example.com", "A", False
    )
    app.dependency_overrides[get_session] = lambda: ProvisionSession()
    with TestClient(app) as client:
        response = client.post(
            "/api/account/personal-workspaces", json={"name": "Project", "slug": "project"}
        )
    assert response.status_code == 403


def test_workspace_name_rejects_whitespace_and_normalizes_edges():
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        WorkspaceCreate(name="   ", slug="project")
    assert WorkspaceCreate(name="  프로젝트  ", slug="project").name == "프로젝트"
