"""Add versioned Agents and durable execution records.

Revision ID: 0007
Revises: 0006
"""

import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"
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


def _workspace_id() -> sa.Column[object]:
    return sa.Column(
        "workspace_id",
        sa.Uuid(),
        sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
    )


def _enable_rls(table: str) -> None:
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
        "agent_definitions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        *_timestamps(),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        _workspace_id(),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("slug", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("current_version_number", sa.Integer(), nullable=False, server_default="0"),
        sa.CheckConstraint("status IN ('active', 'inactive')", name="agent_status"),
        sa.UniqueConstraint("workspace_id", "slug"),
    )
    op.create_index("ix_agent_definitions_workspace_id", "agent_definitions", ["workspace_id"])
    op.create_table(
        "agent_versions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        *_timestamps(),
        _workspace_id(),
        sa.Column(
            "agent_definition_id",
            sa.Uuid(),
            sa.ForeignKey("agent_definitions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("instructions", sa.Text(), nullable=False),
        sa.Column("model", sa.String(200), nullable=False),
        sa.Column("configuration", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("allowed_tools", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column(
            "created_by_user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.CheckConstraint("version_number > 0", name="positive_version"),
        sa.UniqueConstraint("agent_definition_id", "version_number"),
    )
    op.create_index("ix_agent_versions_workspace_id", "agent_versions", ["workspace_id"])
    op.create_index(
        "ix_agent_versions_agent_definition_id", "agent_versions", ["agent_definition_id"]
    )
    op.create_table(
        "agent_runs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        *_timestamps(),
        _workspace_id(),
        sa.Column(
            "agent_definition_id",
            sa.Uuid(),
            sa.ForeignKey("agent_definitions.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "agent_version_id",
            sa.Uuid(),
            sa.ForeignKey("agent_versions.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "requested_by_user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "retry_of_run_id", sa.Uuid(), sa.ForeignKey("agent_runs.id", ondelete="SET NULL")
        ),
        sa.Column("status", sa.String(30), nullable=False, server_default="queued"),
        sa.Column("idempotency_key", sa.String(160), nullable=False),
        sa.Column("input_payload", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("output_payload", sa.JSON()),
        sa.Column("error_code", sa.String(120)),
        sa.Column("error_message", sa.Text()),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("input_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("output_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("estimated_cost_usd", sa.Numeric(14, 6), nullable=False, server_default="0"),
        sa.CheckConstraint(
            "status IN ('queued', 'running', 'succeeded', 'failed', 'cancel_requested', 'cancelled')",
            name="agent_run_status",
        ),
        sa.CheckConstraint("input_tokens >= 0 AND output_tokens >= 0", name="nonnegative_usage"),
        sa.UniqueConstraint("workspace_id", "idempotency_key"),
    )
    op.create_index("ix_agent_runs_workspace_id", "agent_runs", ["workspace_id"])
    op.create_index("ix_agent_runs_agent_definition_id", "agent_runs", ["agent_definition_id"])
    op.create_index("ix_agent_runs_agent_version_id", "agent_runs", ["agent_version_id"])
    op.create_index("ix_agent_runs_status", "agent_runs", ["status"])
    op.create_table(
        "agent_run_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        *_timestamps(),
        _workspace_id(),
        sa.Column(
            "agent_run_id",
            sa.Uuid(),
            sa.ForeignKey("agent_runs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(120), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False, server_default="{}"),
        sa.UniqueConstraint("agent_run_id", "sequence"),
    )
    op.create_index("ix_agent_run_events_workspace_id", "agent_run_events", ["workspace_id"])
    op.create_index("ix_agent_run_events_agent_run_id", "agent_run_events", ["agent_run_id"])
    op.create_table(
        "agent_run_artifacts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        *_timestamps(),
        _workspace_id(),
        sa.Column(
            "agent_run_id",
            sa.Uuid(),
            sa.ForeignKey("agent_runs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(80), nullable=False),
        sa.Column("storage_key", sa.String(1024)),
        sa.Column("artifact_metadata", sa.JSON(), nullable=False, server_default="{}"),
    )
    op.create_index("ix_agent_run_artifacts_workspace_id", "agent_run_artifacts", ["workspace_id"])
    op.create_index("ix_agent_run_artifacts_agent_run_id", "agent_run_artifacts", ["agent_run_id"])
    op.create_table(
        "agent_run_tool_calls",
        sa.Column("id", sa.Uuid(), primary_key=True),
        *_timestamps(),
        _workspace_id(),
        sa.Column(
            "agent_run_id",
            sa.Uuid(),
            sa.ForeignKey("agent_runs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tool_name", sa.String(200), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("request_payload", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("response_payload", sa.JSON()),
        sa.Column("error_message", sa.Text()),
        sa.CheckConstraint("status IN ('started', 'succeeded', 'failed')", name="tool_call_status"),
    )
    op.create_index(
        "ix_agent_run_tool_calls_workspace_id", "agent_run_tool_calls", ["workspace_id"]
    )
    op.create_index(
        "ix_agent_run_tool_calls_agent_run_id", "agent_run_tool_calls", ["agent_run_id"]
    )
    op.create_table(
        "agent_document_links",
        sa.Column("id", sa.Uuid(), primary_key=True),
        *_timestamps(),
        _workspace_id(),
        sa.Column(
            "agent_run_id",
            sa.Uuid(),
            sa.ForeignKey("agent_runs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "document_id",
            sa.Uuid(),
            sa.ForeignKey("documents.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("relation", sa.String(40), nullable=False),
        sa.CheckConstraint(
            "relation IN ('input', 'output', 'reference')", name="document_relation"
        ),
        sa.UniqueConstraint("agent_run_id", "document_id", "relation"),
    )
    op.create_index(
        "ix_agent_document_links_workspace_id", "agent_document_links", ["workspace_id"]
    )
    op.create_index(
        "ix_agent_document_links_agent_run_id", "agent_document_links", ["agent_run_id"]
    )
    op.create_index("ix_agent_document_links_document_id", "agent_document_links", ["document_id"])
    for table in (
        "agent_definitions",
        "agent_versions",
        "agent_runs",
        "agent_run_events",
        "agent_run_artifacts",
        "agent_run_tool_calls",
        "agent_document_links",
    ):
        _enable_rls(table)


def downgrade() -> None:
    for table in (
        "agent_document_links",
        "agent_run_tool_calls",
        "agent_run_artifacts",
        "agent_run_events",
        "agent_runs",
        "agent_versions",
        "agent_definitions",
    ):
        op.drop_table(table)
