"""First-use personal provisioning keeps ownership and authorization bound to the caller."""

from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.db.session import get_session
from app.main import create_app
from app.modules.auth.dependencies import get_current_principal
from app.modules.auth.service import Principal
from app.modules.organization.models import (
    MembershipStatus,
    OrganizationMembership,
    Role,
    RoleScope,
)
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
        if parameters and "app.current_organization_id" in sql:
            self.context.update(
                {
                    "app.current_user_id": parameters["user_id"],
                    "app.current_organization_id": parameters["organization_id"],
                    "app.current_workspace_id": parameters["workspace_id"],
                    "app.is_platform_admin": parameters["is_admin"],
                }
            )
        if "FROM organization_memberships m JOIN roles r" in sql:
            return [
                SimpleNamespace(
                    source="organization",
                    role_id=ORGANIZATION_OWNER_ROLE_ID,
                    role_name="organization_owner",
                    team_id=None,
                    team_name=None,
                    permissions=["workspace.create"],
                )
            ]

    async def scalar(self, statement):
        sql = str(statement)
        if "SELECT m.status FROM organization_memberships m" in sql:
            return "active"
        if "FROM organization_memberships JOIN organizations" in sql:
            return OrganizationMembership(
                role_id=ORGANIZATION_OWNER_ROLE_ID, status=MembershipStatus.ACTIVE
            )
        if "FROM roles" in sql:
            return Role(
                id=ORGANIZATION_OWNER_ROLE_ID,
                name="organization_owner",
                scope=RoleScope.ORGANIZATION,
            )
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
async def test_personal_create_uses_target_account_composition(monkeypatch):
    principal = Principal(uuid4(), "owner@example.com", "Owner", False)
    session = ProvisionSession()
    organization_id = uuid4()

    class ComposedAccount:
        async def create_personal_workspace(self, caller, *, name, slug):
            assert caller == principal
            now = datetime.now(UTC)
            return Workspace(
                id=uuid4(),
                organization_id=organization_id,
                name=name,
                slug=slug,
                status=WorkspaceStatus.ACTIVE,
                revision=1,
                created_at=now,
                updated_at=now,
            )

    monkeypatch.setattr("app.router.account.workspace_use_cases", lambda actual: ComposedAccount())
    result = await create_personal_workspace(
        WorkspaceCreate(name="Project", slug="project"), principal, session
    )
    assert result.organization_id == organization_id


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
