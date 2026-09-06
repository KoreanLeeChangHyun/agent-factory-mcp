"""Persistent external schedule import previews and source mappings."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "plan_imports",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "workspace_id",
            sa.Uuid(),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("request_key", sa.String(160), nullable=False),
        sa.Column("proposal", postgresql.JSONB(), nullable=False),
        sa.Column("preview", postgresql.JSONB(), nullable=False),
        sa.Column("baseline", sa.String(64), nullable=False),
        sa.Column("digest", sa.String(64), nullable=False),
        sa.Column("result", postgresql.JSONB()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("workspace_id", "request_key"),
    )
    op.create_table(
        "plan_source_links",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "workspace_id",
            sa.Uuid(),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("provider", sa.String(30), nullable=False),
        sa.Column("source", sa.String(500), nullable=False),
        sa.Column("source_id", sa.String(500), nullable=False),
        sa.Column("item_id", sa.Uuid(), nullable=False),
        sa.UniqueConstraint("workspace_id", "provider", "source", "source_id"),
        sa.ForeignKeyConstraint(
            ["workspace_id", "item_id"],
            ["plan_items.workspace_id", "plan_items.id"],
            ondelete="CASCADE",
        ),
    )
    for table in ("plan_imports", "plan_source_links"):
        op.create_index(f"ix_{table}_workspace_id", table, ["workspace_id"])
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
    op.drop_table("plan_source_links")
    op.drop_table("plan_imports")
