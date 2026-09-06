"""Embedding-independent text projection and idempotent document imports."""
import sqlalchemy as sa
from alembic import op
revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None

def upgrade():
    for name in ("document_imports", "document_texts"):
        columns = [sa.Column("id", sa.Uuid(), primary_key=True),
                   sa.Column("workspace_id", sa.Uuid(), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False),
                   sa.Column("document_id", sa.Uuid(), nullable=False),
                   sa.Column("revision_id", sa.Uuid(), sa.ForeignKey("document_revisions.id", ondelete="CASCADE"), nullable=False)]
        if name == "document_imports":
            columns += [sa.Column("idempotency_key", sa.String(160), nullable=False),
                        sa.Column("request_sha256", sa.String(64), nullable=False),
                        sa.Column("revision_number", sa.Integer(), nullable=False),
                        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
                        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
                        sa.UniqueConstraint("workspace_id", "idempotency_key")]
        else:
            columns += [sa.Column("chunk_index", sa.Integer(), nullable=False),
                        sa.Column("source_path", sa.String(1024), nullable=False),
                        sa.Column("content", sa.Text(), nullable=False),
                        sa.UniqueConstraint("revision_id", "chunk_index")]
        columns.append(sa.ForeignKeyConstraint(["workspace_id", "document_id"], ["documents.workspace_id", "documents.id"], ondelete="CASCADE"))
        op.create_table(name, *columns)
        op.create_index(f"ix_{name}_workspace_id", name, ["workspace_id"])
        op.execute(f"ALTER TABLE {name} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {name} FORCE ROW LEVEL SECURITY")
        op.execute(f"CREATE POLICY {name}_workspace ON {name} USING (workspace_id = nullif(current_setting('app.current_workspace_id', true), '')::uuid) WITH CHECK (workspace_id = nullif(current_setting('app.current_workspace_id', true), '')::uuid)")
    op.create_index("ix_document_texts_revision_id", "document_texts", ["revision_id"])

def downgrade():
    op.drop_table("document_texts")
    op.drop_table("document_imports")
