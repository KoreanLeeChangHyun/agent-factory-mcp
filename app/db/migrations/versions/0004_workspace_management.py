"""Add Workspace lifecycle and recent-use state.

Revision ID: 0004
Revises: 0003
"""

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "workspaces",
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
    )
    op.create_check_constraint("workspace_status", "workspaces", "status IN ('active', 'inactive')")
    op.create_table(
        "workspace_visits",
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "workspace_id",
            sa.Uuid(),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            primary_key=True,
        ),
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
        sa.Column("last_opened_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_favorite", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_workspace_visits_workspace_id", "workspace_visits", ["workspace_id"])
    expression = (
        "current_setting('app.is_platform_admin', true) = 'true' OR ("
        "user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid AND "
        "workspace_id IN (SELECT id FROM workspaces WHERE organization_id = "
        "NULLIF(current_setting('app.current_organization_id', true), '')::uuid))"
    )
    op.execute('ALTER TABLE "workspace_visits" ENABLE ROW LEVEL SECURITY')
    op.execute('ALTER TABLE "workspace_visits" FORCE ROW LEVEL SECURITY')
    op.execute(
        'CREATE POLICY workspace_visit_isolation ON "workspace_visits" '
        f"USING ({expression}) WITH CHECK ({expression})"
    )


def downgrade() -> None:
    op.drop_table("workspace_visits")
    op.drop_constraint("ck_workspaces_workspace_status", "workspaces", type_="check")
    op.drop_column("workspaces", "status")
