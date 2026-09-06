"""Development domains, features, issues and launch target.

Revision ID: 0013
Revises: 0012
"""

import sqlalchemy as sa
from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def timestamps():
    return [
        sa.Column(name, sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False)
        for name in ("created_at", "updated_at")
    ]


def upgrade():
    op.create_table(
        "plan_items",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "workspace_id",
            sa.Uuid(),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("parent_id", sa.Uuid()),
        sa.Column("kind", sa.String(12), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("acceptance", sa.Text(), nullable=False, server_default=""),
        sa.Column("assignee", sa.String(160), nullable=False, server_default=""),
        sa.Column("status", sa.String(12), nullable=False, server_default="pending"),
        sa.Column("blocked_reason", sa.Text(), nullable=False, server_default=""),
        sa.Column("start_date", sa.Date()),
        sa.Column("target_date", sa.Date()),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        *timestamps(),
        sa.UniqueConstraint("workspace_id", "id"),
        sa.ForeignKeyConstraint(
            ["workspace_id", "parent_id"],
            ["plan_items.workspace_id", "plan_items.id"],
            ondelete="RESTRICT",
        ),
        sa.CheckConstraint("kind IN ('domain', 'feature', 'issue')", name="plan_kind"),
        sa.CheckConstraint("status IN ('pending', 'active', 'done')", name="plan_status"),
        sa.CheckConstraint(
            "(kind = 'domain' AND parent_id IS NULL) OR (kind <> 'domain' AND parent_id IS NOT NULL)",
            name="plan_parent",
        ),
        sa.CheckConstraint(
            "start_date IS NULL OR target_date IS NULL OR start_date <= target_date",
            name="plan_dates",
        ),
    )
    op.create_index("ix_plan_items_workspace_id", "plan_items", ["workspace_id"])
    op.create_index("ix_plan_items_parent_id", "plan_items", ["parent_id"])
    op.create_table(
        "plan_settings",
        sa.Column(
            "workspace_id",
            sa.Uuid(),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("launch_date", sa.Date()),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        *timestamps(),
    )
    for table in ("plan_items", "plan_settings"):
        expression = (
            "current_setting('app.is_platform_admin', true) = 'true' OR "
            "workspace_id = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid"
        )
        op.execute(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY')
        op.execute(f'ALTER TABLE "{table}" FORCE ROW LEVEL SECURITY')
        op.execute(
            f'CREATE POLICY workspace_isolation ON "{table}" USING ({expression}) WITH CHECK ({expression})'
        )


def downgrade():
    op.drop_table("plan_settings")
    op.drop_table("plan_items")
