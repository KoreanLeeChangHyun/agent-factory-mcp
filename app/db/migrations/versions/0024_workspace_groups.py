"""Persist personal Workspace list groups.

Revision ID: 0024
Revises: 0023
"""

import sqlalchemy as sa
from alembic import op

revision = "0024"
down_revision = "0023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "workspace_groups",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("name", sa.String(60), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("collapsed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.UniqueConstraint("organization_id", "user_id", "name"),
    )
    op.create_index("ix_workspace_groups_organization_id", "workspace_groups", ["organization_id"])
    op.create_index("ix_workspace_groups_user_id", "workspace_groups", ["user_id"])
    op.create_table(
        "workspace_group_assignments",
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column(
            "workspace_id",
            sa.Uuid(),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "group_id",
            sa.Uuid(),
            sa.ForeignKey("workspace_groups.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index(
        "ix_workspace_group_assignments_group_id", "workspace_group_assignments", ["group_id"]
    )

    group_scope = (
        "current_setting('app.is_platform_admin', true) = 'true' OR ("
        "user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid AND "
        "organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid)"
    )
    assignment_scope = (
        "current_setting('app.is_platform_admin', true) = 'true' OR ("
        "user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid AND "
        "workspace_id IN (SELECT id FROM workspaces WHERE organization_id = "
        "NULLIF(current_setting('app.current_organization_id', true), '')::uuid) AND "
        "group_id IN (SELECT id FROM workspace_groups WHERE user_id = "
        "NULLIF(current_setting('app.current_user_id', true), '')::uuid AND organization_id = "
        "NULLIF(current_setting('app.current_organization_id', true), '')::uuid))"
    )
    for table, policy, expression in (
        ("workspace_groups", "workspace_group_isolation", group_scope),
        ("workspace_group_assignments", "workspace_group_assignment_isolation", assignment_scope),
    ):
        op.execute(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY')
        op.execute(f'ALTER TABLE "{table}" FORCE ROW LEVEL SECURITY')
        op.execute(
            f'CREATE POLICY {policy} ON "{table}" USING ({expression}) WITH CHECK ({expression})'
        )


def downgrade() -> None:
    op.drop_table("workspace_group_assignments")
    op.drop_table("workspace_groups")
