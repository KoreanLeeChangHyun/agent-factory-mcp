"""Add Workspace Documents, immutable revisions, and provenance.

Revision ID: 0005
Revises: 0004
"""

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
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
        "documents",
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
        sa.Column("document_type", sa.String(30), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("slug", sa.String(160), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("document_metadata", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("current_revision_number", sa.Integer(), nullable=False, server_default="0"),
        sa.CheckConstraint(
            "document_type IN ('original', 'processed', 'specification')", name="document_type"
        ),
        sa.CheckConstraint("status IN ('active', 'archived')", name="document_status"),
        sa.UniqueConstraint("workspace_id", "slug"),
    )
    op.create_index("ix_documents_workspace_id", "documents", ["workspace_id"])
    op.create_table(
        "document_revisions",
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
        sa.Column("revision_number", sa.Integer(), nullable=False),
        sa.Column("storage_key", sa.String(1024), nullable=False, unique=True),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("media_type", sa.String(255), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column(
            "created_by_user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("revision_metadata", sa.JSON(), nullable=False, server_default="{}"),
        sa.CheckConstraint("revision_number > 0", name="positive_revision"),
        sa.CheckConstraint("size_bytes > 0", name="positive_size"),
        sa.UniqueConstraint("document_id", "revision_number"),
    )
    op.create_index("ix_document_revisions_workspace_id", "document_revisions", ["workspace_id"])
    op.create_index("ix_document_revisions_document_id", "document_revisions", ["document_id"])
    op.create_table(
        "document_provenance",
        sa.Column("id", sa.Uuid(), primary_key=True),
        *_timestamps(),
        sa.Column(
            "workspace_id",
            sa.Uuid(),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "source_document_id",
            sa.Uuid(),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "target_document_id",
            sa.Uuid(),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("relation", sa.String(30), nullable=False),
        sa.Column("provenance_metadata", sa.JSON(), nullable=False, server_default="{}"),
        sa.CheckConstraint("source_document_id <> target_document_id", name="not_self"),
        sa.CheckConstraint(
            "relation IN ('derived_from', 'processed_from', 'specifies')",
            name="provenance_relation",
        ),
        sa.UniqueConstraint("source_document_id", "target_document_id", "relation"),
    )
    op.create_index("ix_document_provenance_workspace_id", "document_provenance", ["workspace_id"])
    op.create_index(
        "ix_document_provenance_source_document_id", "document_provenance", ["source_document_id"]
    )
    op.create_index(
        "ix_document_provenance_target_document_id", "document_provenance", ["target_document_id"]
    )
    for table in ("documents", "document_revisions", "document_provenance"):
        _enable_workspace_rls(table)


def downgrade() -> None:
    op.drop_table("document_provenance")
    op.drop_table("document_revisions")
    op.drop_table("documents")
