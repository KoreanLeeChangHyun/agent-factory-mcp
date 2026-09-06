"""Retain encrypted MCP credentials for owner-authorized retrieval."""

import sqlalchemy as sa
from alembic import op

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("mcp_connections", sa.Column("encrypted_token", sa.LargeBinary(), nullable=True))
    op.add_column(
        "mcp_connections", sa.Column("encryption_key_version", sa.Integer(), nullable=True)
    )


def downgrade():
    op.drop_column("mcp_connections", "encryption_key_version")
    op.drop_column("mcp_connections", "encrypted_token")
