"""Digest-bound, expiring Document delivery intents."""
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from alembic import op
revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("document_uploads",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("workspace_id", sa.Uuid(), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("idempotency_key", sa.String(160), nullable=False),
        sa.Column("request_sha256", sa.String(64), nullable=False),
        sa.Column("capability_sha256", sa.String(64), nullable=False),
        sa.Column("metadata_payload", JSONB(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("uploaded", sa.Boolean(), nullable=False),
        sa.Column("finalized", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("workspace_id", "idempotency_key"))
    op.create_index("ix_document_uploads_workspace_id", "document_uploads", ["workspace_id"])
    op.execute("ALTER TABLE document_uploads ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE document_uploads FORCE ROW LEVEL SECURITY")
    op.execute("CREATE POLICY document_uploads_workspace ON document_uploads USING (workspace_id = nullif(current_setting('app.current_workspace_id', true), '')::uuid) WITH CHECK (workspace_id = nullif(current_setting('app.current_workspace_id', true), '')::uuid)")

def downgrade():
    op.drop_table("document_uploads")
