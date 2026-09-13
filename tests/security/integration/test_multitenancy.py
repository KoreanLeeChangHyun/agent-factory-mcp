"""Multitenancy schema and transaction-context tests."""

from pathlib import Path
from uuid import UUID

import pytest

from app.db.base import Base
from app.db.models import (  # noqa: F401
    Organization,
    OrganizationMembership,
    Permission,
    Role,
    RolePermission,
    User,
    Workspace,
    WorkspaceMembership,
    WorkspaceRepository,
)
from app.db.tenant import TenantContext, apply_tenant_context


def test_complete_tenant_schema_is_registered() -> None:
    assert {
        "users",
        "organizations",
        "permissions",
        "roles",
        "role_permissions",
        "organization_memberships",
        "workspaces",
        "workspace_memberships",
        "workspace_repositories",
    }.issubset(Base.metadata.tables)


def test_every_workspace_record_has_a_tenant_key() -> None:
    assert "organization_id" in Base.metadata.tables["workspaces"].columns
    assert "workspace_id" in Base.metadata.tables["workspace_memberships"].columns
    assert "workspace_id" in Base.metadata.tables["workspace_repositories"].columns


@pytest.mark.asyncio
async def test_tenant_context_is_transaction_local() -> None:
    calls: list[tuple[str, dict[str, str]]] = []

    class RecordingSession:
        async def execute(self, statement: object, parameters: dict[str, str]) -> None:
            calls.append((str(statement), parameters))

    tenant = TenantContext(
        user_id=UUID("11111111-1111-4111-8111-111111111111"),
        organization_id=UUID("22222222-2222-4222-8222-222222222222"),
        workspace_id=UUID("33333333-3333-4333-8333-333333333333"),
    )
    await apply_tenant_context(RecordingSession(), tenant)  # type: ignore[arg-type]

    assert len(calls) == 4
    assert all("set_config" in statement for statement, _ in calls)
    assert all(parameters["value"] != "true" for _, parameters in calls[:-1])
    assert calls[-1][1]["value"] == "false"


def test_multitenancy_migration_enforces_rls() -> None:
    migration = Path("app/db/migrations/versions/0002_multitenancy.py").read_text()

    assert "FORCE ROW LEVEL SECURITY" in migration
    assert "current_organization_id" in migration
    assert "current_workspace_id" in migration
    assert "SYSTEM_ROLES" in migration
    assert '_enable_tenant_rls("organizations", "id")' in migration
