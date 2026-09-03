"""Add durable schedules, jobs, and lifecycle events.

Revision ID: 0009
Revises: 0008
"""

import sqlalchemy as sa
from alembic import op

revision = "0009"
down_revision = "0008"
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
        "schedules",
        sa.Column("id", sa.Uuid(), primary_key=True),
        *_timestamps(),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
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
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("task_type", sa.String(120), nullable=False),
        sa.Column("queue", sa.String(80), nullable=False, server_default="default"),
        sa.Column("cron_expression", sa.String(120)),
        sa.Column("interval_seconds", sa.Integer()),
        sa.Column("timezone", sa.String(80), nullable=False, server_default="UTC"),
        sa.Column("payload", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_run_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_by_user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "(cron_expression IS NULL) <> (interval_seconds IS NULL)",
            name="one_schedule_expression",
        ),
        sa.CheckConstraint(
            "interval_seconds IS NULL OR interval_seconds >= 60", name="minimum_interval"
        ),
        sa.UniqueConstraint("workspace_id", "name"),
    )
    for column in ("organization_id", "workspace_id", "task_type", "next_run_at"):
        op.create_index(f"ix_schedules_{column}", "schedules", [column])
    op.create_table(
        "jobs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        *_timestamps(),
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
        sa.Column("schedule_id", sa.Uuid(), sa.ForeignKey("schedules.id", ondelete="SET NULL")),
        sa.Column(
            "requested_by_user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("task_type", sa.String(120), nullable=False),
        sa.Column("queue", sa.String(80), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="queued"),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("idempotency_key", sa.String(200), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("result", sa.JSON()),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True)),
        sa.Column("celery_task_id", sa.String(255)),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("dead_lettered_at", sa.DateTime(timezone=True)),
        sa.Column("error_code", sa.String(120)),
        sa.Column("error_message", sa.Text()),
        sa.CheckConstraint(
            "status IN ('queued', 'running', 'retry', 'succeeded', 'failed', "
            "'cancel_requested', 'cancelled', 'dead')",
            name="job_status",
        ),
        sa.CheckConstraint("priority BETWEEN 0 AND 9", name="job_priority"),
        sa.CheckConstraint("attempt_count >= 0 AND max_attempts > 0", name="job_attempts"),
        sa.UniqueConstraint("workspace_id", "idempotency_key"),
    )
    for column in (
        "organization_id",
        "workspace_id",
        "task_type",
        "status",
        "next_attempt_at",
    ):
        op.create_index(f"ix_jobs_{column}", "jobs", [column])
    op.create_table(
        "job_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        *_timestamps(),
        sa.Column(
            "workspace_id",
            sa.Uuid(),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "job_id", sa.Uuid(), sa.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(120), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False, server_default="{}"),
        sa.UniqueConstraint("job_id", "sequence"),
    )
    op.create_index("ix_job_events_workspace_id", "job_events", ["workspace_id"])
    op.create_index("ix_job_events_job_id", "job_events", ["job_id"])
    for table in ("schedules", "jobs", "job_events"):
        _enable_rls(table)


def downgrade() -> None:
    op.drop_table("job_events")
    op.drop_table("jobs")
    op.drop_table("schedules")
