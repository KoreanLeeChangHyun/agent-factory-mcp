"""External reporting, independent of hosted execution contracts."""

import sqlalchemy as sa
from alembic import op

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def base_columns():
    return [
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "workspace_id",
            sa.Uuid(),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
    ]


def mutable_columns():
    return [
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        *[
            sa.Column(n, sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now())
            for n in ("created_at", "updated_at")
        ],
    ]


def link(column, table):
    return sa.ForeignKeyConstraint(
        ["workspace_id", column], [f"{table}.workspace_id", f"{table}.id"]
    )


def upgrade():
    op.create_unique_constraint(
        "uq_audit_workspace_identity", "audit_events", ["workspace_id", "id"]
    )
    op.create_unique_constraint(
        "uq_documents_workspace_identity", "documents", ["workspace_id", "id"]
    )
    op.create_table(
        "report_agents",
        *base_columns(),
        *mutable_columns(),
        sa.Column("owner_user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("parent_id", sa.Uuid()),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("role", sa.String(160), nullable=False),
        sa.Column("responsibilities", sa.Text(), nullable=False),
        sa.Column("last_report_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("workspace_id", "id"),
        link("parent_id", "report_agents"),
        sa.CheckConstraint("parent_id IS NULL OR parent_id <> id", name="report_agent_self_parent"),
    )
    op.create_table(
        "report_tasks",
        *base_columns(),
        *mutable_columns(),
        sa.Column("agent_id", sa.Uuid(), nullable=False),
        sa.Column("parent_id", sa.Uuid()),
        sa.Column("plan_item_id", sa.Uuid()),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("progress", sa.Integer()),
        *[
            sa.Column(n, sa.DateTime(timezone=True))
            for n in ("started_at", "finished_at", "last_report_at")
        ],
        sa.UniqueConstraint("workspace_id", "id"),
        link("agent_id", "report_agents"),
        link("parent_id", "report_tasks"),
        link("plan_item_id", "plan_items"),
        sa.CheckConstraint(
            "status IN ('pending','in_progress','input_required','completed','failed','cancelled')",
            name="report_task_status",
        ),
        sa.CheckConstraint(
            "progress IS NULL OR (progress >= 0 AND progress <= 100)", name="report_progress"
        ),
        sa.CheckConstraint("parent_id IS NULL OR parent_id <> id", name="report_task_self_parent"),
    )
    op.create_table(
        "task_reports",
        *base_columns(),
        sa.Column("task_id", sa.Uuid(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("reporter_user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("connection_id", sa.Uuid()),
        sa.Column("audit_event_id", sa.Uuid(), nullable=False),
        link("audit_event_id", "audit_events"),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("progress", sa.Integer()),
        sa.Column("message", sa.Text(), nullable=False),
        sa.UniqueConstraint("workspace_id", "id"),
        sa.UniqueConstraint(
            "workspace_id", "task_id", "revision", name="uq_task_reports_task_revision"
        ),
        link("task_id", "report_tasks"),
    )
    op.create_table(
        "report_results",
        *base_columns(),
        sa.Column("report_id", sa.Uuid(), nullable=False),
        sa.Column("label", sa.String(200), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("document_id", sa.Uuid()),
        sa.Column("url", sa.String(2048)),
        link("report_id", "task_reports"),
        link("document_id", "documents"),
    )
    op.create_table(
        "report_receipts",
        *base_columns(),
        sa.Column("reporter_user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("key", sa.String(120), nullable=False),
        sa.Column("payload_hash", sa.String(64), nullable=False),
        sa.Column("response", sa.JSON(), nullable=False),
        sa.UniqueConstraint("workspace_id", "reporter_user_id", "key"),
    )
    scope = "workspace_id = nullif(current_setting('app.current_workspace_id', true), '')::uuid AND EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND w.organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)"
    user = "nullif(current_setting('app.current_user_id', true), '')::uuid"
    op.execute(
        f"CREATE POLICY external_reporting_audit_insert ON audit_events FOR INSERT WITH CHECK (({scope}) AND actor_user_id = {user} AND source = 'mcp' AND action IN ('external_report.agent','external_report.task','external_report.report') AND target_type IN ('report_agent','report_task'))"
    )
    owners = {
        "report_agents": f"owner_user_id = {user}",
        "report_tasks": f"EXISTS (SELECT 1 FROM report_agents a WHERE a.workspace_id = report_tasks.workspace_id AND a.id = report_tasks.agent_id AND a.owner_user_id = {user})",
        "task_reports": f"reporter_user_id = {user} AND EXISTS (SELECT 1 FROM report_tasks t JOIN report_agents a ON a.workspace_id=t.workspace_id AND a.id=t.agent_id WHERE t.workspace_id=task_reports.workspace_id AND t.id=task_reports.task_id AND a.owner_user_id={user})",
        "report_results": f"EXISTS (SELECT 1 FROM task_reports r WHERE r.workspace_id=report_results.workspace_id AND r.id=report_results.report_id AND r.reporter_user_id={user})",
        "report_receipts": f"reporter_user_id = {user}",
    }
    for table, owner in owners.items():
        op.create_index(f"ix_{table}_workspace_id", table, ["workspace_id"])
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        read = f"({scope})" + (f" AND ({owner})" if table == "report_receipts" else "")
        op.execute(f"CREATE POLICY reporting_read ON {table} FOR SELECT USING ({read})")
        op.execute(
            f"CREATE POLICY reporting_insert ON {table} FOR INSERT WITH CHECK (({scope}) AND ({owner}))"
        )
        if table in {"report_agents", "report_tasks"}:
            # An agent heartbeat changes no configuration, but must still be owner-bound.
            op.execute(
                f"CREATE POLICY reporting_update ON {table} FOR UPDATE USING (({scope}) AND ({owner})) WITH CHECK (({scope}) AND ({owner}))"
            )
    op.create_index("ix_report_tasks_recent", "report_tasks", ["workspace_id", "updated_at"])
    op.create_index(
        "ix_task_reports_history", "task_reports", ["workspace_id", "task_id", "revision"]
    )


def downgrade():
    op.execute("DROP POLICY external_reporting_audit_insert ON audit_events")
    for table in (
        "report_receipts",
        "report_results",
        "task_reports",
        "report_tasks",
        "report_agents",
    ):
        op.drop_table(table)
    op.drop_constraint("uq_audit_workspace_identity", "audit_events", type_="unique")
    op.drop_constraint("uq_documents_workspace_identity", "documents", type_="unique")
