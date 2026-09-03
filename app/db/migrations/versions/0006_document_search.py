"""Add pgvector-backed hybrid Document search.

Revision ID: 0006
Revises: 0005
"""

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def _timestamps() -> tuple[sa.Column[object], sa.Column[object]]:
    return (
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )


def _enable_workspace_rls(table: str) -> None:
    expression = (
        "current_setting('app.is_platform_admin', true) = 'true' OR "
        "workspace_id = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid"
    )
    op.execute(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY')
    op.execute(f'ALTER TABLE "{table}" FORCE ROW LEVEL SECURITY')
    op.execute(
        f'CREATE POLICY workspace_isolation ON "{table}" '
        f"USING ({expression}) WITH CHECK ({expression})"
    )


def upgrade() -> None:
    op.create_table(
        "embedding_profiles",
        sa.Column("id", sa.Uuid(), primary_key=True),
        *_timestamps(),
        sa.Column(
            "workspace_id",
            sa.Uuid(),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("provider", sa.String(80), nullable=False),
        sa.Column("model", sa.String(200), nullable=False),
        sa.Column("dimensions", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.CheckConstraint("dimensions = 1536", name="supported_dimensions"),
        sa.UniqueConstraint("workspace_id", "name"),
    )
    op.create_index("ix_embedding_profiles_workspace_id", "embedding_profiles", ["workspace_id"])
    op.create_table(
        "document_chunks",
        sa.Column("id", sa.Uuid(), primary_key=True),
        *_timestamps(),
        sa.Column(
            "workspace_id",
            sa.Uuid(),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "document_id",
            sa.Uuid(),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "document_revision_id",
            sa.Uuid(),
            sa.ForeignKey("document_revisions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "embedding_profile_id",
            sa.Uuid(),
            sa.ForeignKey("embedding_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("token_count", sa.Integer()),
        sa.Column("embedding", Vector(1536), nullable=False),
        sa.Column(
            "search_vector",
            sa.dialects.postgresql.TSVECTOR(),
            sa.Computed("to_tsvector('simple', content)", persisted=True),
            nullable=False,
        ),
        sa.Column("chunk_metadata", sa.JSON(), nullable=False, server_default="{}"),
        sa.CheckConstraint("chunk_index >= 0", name="nonnegative_chunk_index"),
        sa.UniqueConstraint("document_revision_id", "embedding_profile_id", "chunk_index"),
    )
    op.create_index("ix_document_chunks_workspace_id", "document_chunks", ["workspace_id"])
    op.create_index("ix_document_chunks_document_id", "document_chunks", ["document_id"])
    op.create_index(
        "ix_document_chunks_document_revision_id", "document_chunks", ["document_revision_id"]
    )
    op.create_index(
        "ix_document_chunks_embedding_profile_id", "document_chunks", ["embedding_profile_id"]
    )
    op.create_index(
        "ix_document_chunks_embedding_hnsw",
        "document_chunks",
        ["embedding"],
        postgresql_using="hnsw",
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )
    op.create_index(
        "ix_document_chunks_search_vector_gin",
        "document_chunks",
        ["search_vector"],
        postgresql_using="gin",
    )
    for table in ("embedding_profiles", "document_chunks"):
        _enable_workspace_rls(table)


def downgrade() -> None:
    op.drop_table("document_chunks")
    op.drop_table("embedding_profiles")
