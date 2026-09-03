"""Create identity, organization, RBAC, and Workspace tenancy tables.

Revision ID: 0002
Revises: 0001
"""

from uuid import UUID

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

SYSTEM_ROLES = {
    "platform_admin": UUID("00000000-0000-4000-8000-000000000001"),
    "organization_owner": UUID("00000000-0000-4000-8000-000000000002"),
    "organization_admin": UUID("00000000-0000-4000-8000-000000000003"),
    "workspace_owner": UUID("00000000-0000-4000-8000-000000000004"),
    "workspace_admin": UUID("00000000-0000-4000-8000-000000000005"),
    "member": UUID("00000000-0000-4000-8000-000000000006"),
    "viewer": UUID("00000000-0000-4000-8000-000000000007"),
}


def _timestamps() -> tuple[sa.Column[object], sa.Column[object]]:
    return (
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def _rls_expression(column: str) -> str:
    return (
        "current_setting('app.is_platform_admin', true) = 'true' OR "
        f"{column} = NULLIF(current_setting('app.current_organization_id', true), '')::uuid"
    )


def _enable_tenant_rls(table: str, column: str = "organization_id") -> None:
    expression = _rls_expression(column)
    op.execute(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY')
    op.execute(f'ALTER TABLE "{table}" FORCE ROW LEVEL SECURITY')
    op.execute(
        f'CREATE POLICY tenant_isolation ON "{table}" '
        f"USING ({expression}) WITH CHECK ({expression})"
    )


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        *_timestamps(),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("display_name", sa.String(200), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("is_platform_admin", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.CheckConstraint("status IN ('active', 'suspended', 'deactivated')", name="user_status"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "organizations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        *_timestamps(),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("is_personal", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_organizations_slug", "organizations", ["slug"])

    op.create_table(
        "permissions",
        sa.Column("key", sa.String(120), primary_key=True),
        *_timestamps(),
        sa.Column("description", sa.String(500), nullable=False),
    )
    op.create_table(
        "roles",
        sa.Column("id", sa.Uuid(), primary_key=True),
        *_timestamps(),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
        ),
        sa.Column("scope", sa.String(20), nullable=False),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.CheckConstraint("scope IN ('platform', 'organization', 'workspace')", name="role_scope"),
        sa.UniqueConstraint("organization_id", "scope", "name"),
    )
    op.create_index("ix_roles_organization_id", "roles", ["organization_id"])
    op.create_index(
        "uq_roles_system_scope_name",
        "roles",
        ["scope", "name"],
        unique=True,
        postgresql_where=sa.text("organization_id IS NULL"),
    )
    op.create_table(
        "role_permissions",
        sa.Column(
            "role_id",
            sa.Uuid(),
            sa.ForeignKey("roles.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "permission_key",
            sa.String(120),
            sa.ForeignKey("permissions.key", ondelete="CASCADE"),
            primary_key=True,
        ),
    )
    op.create_table(
        "organization_memberships",
        sa.Column("id", sa.Uuid(), primary_key=True),
        *_timestamps(),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "role_id",
            sa.Uuid(),
            sa.ForeignKey("roles.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.UniqueConstraint("organization_id", "user_id"),
    )
    op.create_index(
        "ix_organization_memberships_organization_id",
        "organization_memberships",
        ["organization_id"],
    )
    op.create_index("ix_organization_memberships_user_id", "organization_memberships", ["user_id"])

    op.create_table(
        "workspaces",
        sa.Column("id", sa.Uuid(), primary_key=True),
        *_timestamps(),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.UniqueConstraint("organization_id", "slug"),
    )
    op.create_index("ix_workspaces_organization_id", "workspaces", ["organization_id"])
    op.create_table(
        "workspace_memberships",
        sa.Column("id", sa.Uuid(), primary_key=True),
        *_timestamps(),
        sa.Column(
            "workspace_id",
            sa.Uuid(),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "role_id",
            sa.Uuid(),
            sa.ForeignKey("roles.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.UniqueConstraint("workspace_id", "user_id"),
    )
    op.create_index(
        "ix_workspace_memberships_workspace_id", "workspace_memberships", ["workspace_id"]
    )
    op.create_index("ix_workspace_memberships_user_id", "workspace_memberships", ["user_id"])
    op.create_table(
        "workspace_repositories",
        sa.Column("id", sa.Uuid(), primary_key=True),
        *_timestamps(),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "workspace_id",
            sa.Uuid(),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("canonical_location", sa.String(2048), nullable=False),
        sa.Column("remote_url", sa.String(2048)),
        sa.Column("repository_metadata", sa.JSON(), nullable=False, server_default="{}"),
        sa.UniqueConstraint("workspace_id", "canonical_location"),
    )
    op.create_index(
        "ix_workspace_repositories_workspace_id", "workspace_repositories", ["workspace_id"]
    )

    permissions = sa.table(
        "permissions", sa.column("key", sa.String), sa.column("description", sa.String)
    )
    permission_rows = [
        {"key": "platform.manage", "description": "Manage the Agent Factory platform"},
        {"key": "organization.manage", "description": "Manage an organization"},
        {"key": "workspace.read", "description": "Read Workspace resources"},
        {"key": "workspace.manage", "description": "Manage a Workspace"},
        {"key": "document.manage", "description": "Manage Workspace Documents"},
        {"key": "agent.execute", "description": "Execute Workspace Agents"},
        {"key": "integration.manage", "description": "Manage external integrations"},
        {"key": "audit.read", "description": "Read audit events"},
    ]
    op.bulk_insert(permissions, permission_rows)

    roles = sa.table(
        "roles",
        sa.column("id", sa.Uuid),
        sa.column("organization_id", sa.Uuid),
        sa.column("scope", sa.String),
        sa.column("name", sa.String),
        sa.column("is_system", sa.Boolean),
    )
    role_scopes = {
        "platform_admin": "platform",
        "organization_owner": "organization",
        "organization_admin": "organization",
        "workspace_owner": "workspace",
        "workspace_admin": "workspace",
        "member": "workspace",
        "viewer": "workspace",
    }
    op.bulk_insert(
        roles,
        [
            {
                "id": role_id,
                "organization_id": None,
                "scope": role_scopes[name],
                "name": name,
                "is_system": True,
            }
            for name, role_id in SYSTEM_ROLES.items()
        ],
    )

    grants = {
        "platform_admin": [row["key"] for row in permission_rows],
        "organization_owner": [
            "organization.manage",
            "workspace.read",
            "workspace.manage",
            "document.manage",
            "agent.execute",
            "integration.manage",
            "audit.read",
        ],
        "organization_admin": [
            "organization.manage",
            "workspace.read",
            "workspace.manage",
            "document.manage",
            "agent.execute",
            "integration.manage",
            "audit.read",
        ],
        "workspace_owner": [
            "workspace.read",
            "workspace.manage",
            "document.manage",
            "agent.execute",
            "integration.manage",
            "audit.read",
        ],
        "workspace_admin": [
            "workspace.read",
            "workspace.manage",
            "document.manage",
            "agent.execute",
            "integration.manage",
            "audit.read",
        ],
        "member": ["workspace.read", "document.manage", "agent.execute"],
        "viewer": ["workspace.read"],
    }
    role_permissions = sa.table(
        "role_permissions",
        sa.column("role_id", sa.Uuid),
        sa.column("permission_key", sa.String),
    )
    op.bulk_insert(
        role_permissions,
        [
            {"role_id": SYSTEM_ROLES[role], "permission_key": permission}
            for role, role_permissions_list in grants.items()
            for permission in role_permissions_list
        ],
    )

    user_expression = (
        "current_setting('app.is_platform_admin', true) = 'true' OR "
        "id = NULLIF(current_setting('app.current_user_id', true), '')::uuid"
    )
    op.execute('ALTER TABLE "users" ENABLE ROW LEVEL SECURITY')
    op.execute('ALTER TABLE "users" FORCE ROW LEVEL SECURITY')
    op.execute(
        f'CREATE POLICY user_isolation ON "users" USING ({user_expression}) '
        f"WITH CHECK ({user_expression})"
    )
    _enable_tenant_rls("organizations", "id")
    for table in ("organization_memberships", "workspaces"):
        _enable_tenant_rls(table)
    role_read_expression = (
        "current_setting('app.is_platform_admin', true) = 'true' OR "
        "organization_id IS NULL OR "
        "organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid"
    )
    role_write_expression = (
        "current_setting('app.is_platform_admin', true) = 'true' OR ("
        "organization_id IS NOT NULL AND "
        "organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid)"
    )
    op.execute('ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY')
    op.execute('ALTER TABLE "roles" FORCE ROW LEVEL SECURITY')
    op.execute(f'CREATE POLICY role_read ON "roles" FOR SELECT USING ({role_read_expression})')
    op.execute(
        f'CREATE POLICY role_write ON "roles" FOR ALL USING ({role_write_expression}) '
        f"WITH CHECK ({role_write_expression})"
    )
    role_permission_read = (
        "current_setting('app.is_platform_admin', true) = 'true' OR EXISTS ("
        "SELECT 1 FROM roles WHERE roles.id = role_permissions.role_id)"
    )
    role_permission_write = (
        "current_setting('app.is_platform_admin', true) = 'true' OR EXISTS ("
        "SELECT 1 FROM roles WHERE roles.id = role_permissions.role_id "
        "AND roles.organization_id IS NOT NULL)"
    )
    op.execute('ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY')
    op.execute('ALTER TABLE "role_permissions" FORCE ROW LEVEL SECURITY')
    op.execute(
        f'CREATE POLICY role_permission_read ON "role_permissions" FOR SELECT '
        f"USING ({role_permission_read})"
    )
    op.execute(
        f'CREATE POLICY role_permission_write ON "role_permissions" FOR ALL '
        f"USING ({role_permission_write}) WITH CHECK ({role_permission_write})"
    )
    workspace_expression = (
        "current_setting('app.is_platform_admin', true) = 'true' OR "
        "workspace_id = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid"
    )
    for table in ("workspace_memberships", "workspace_repositories"):
        op.execute(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY')
        op.execute(f'ALTER TABLE "{table}" FORCE ROW LEVEL SECURITY')
        op.execute(
            f'CREATE POLICY workspace_isolation ON "{table}" '
            f"USING ({workspace_expression}) WITH CHECK ({workspace_expression})"
        )


def downgrade() -> None:
    for table in (
        "workspace_repositories",
        "workspace_memberships",
        "workspaces",
        "organization_memberships",
        "role_permissions",
        "roles",
        "permissions",
        "organizations",
        "users",
    ):
        op.drop_table(table)
