"""Persist user-owned, workspace-bound MCP client verification."""

import sqlalchemy as sa
from alembic import op

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "mcp_connections",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "workspace_id",
            sa.Uuid(),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "token_id",
            sa.Uuid(),
            sa.ForeignKey("api_tokens.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("client_name", sa.String(120)),
        sa.Column("first_confirmed_at", sa.DateTime(timezone=True)),
        sa.Column("last_seen_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_mcp_connections_user_id", "mcp_connections", ["user_id"])
    op.create_index("ix_mcp_connections_workspace_id", "mcp_connections", ["workspace_id"])
    op.execute("ALTER TABLE mcp_connections ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE mcp_connections FORCE ROW LEVEL SECURITY")
    expression = "(current_setting('app.is_platform_admin', true) = 'true' OR (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid AND workspace_id = nullif(current_setting('app.current_workspace_id', true), '')::uuid))"
    op.execute(
        f"CREATE POLICY connection_owner ON mcp_connections USING ({expression}) WITH CHECK ({expression})"
    )


def downgrade():
    op.drop_table("mcp_connections")
