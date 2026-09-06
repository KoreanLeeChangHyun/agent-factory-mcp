"""Optional immutable runtime association and separate observed heartbeat facts."""

import sqlalchemy as sa
from alembic import op

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("report_tasks", sa.Column("runtime_binding", sa.JSON(), nullable=True))
    op.add_column("report_tasks", sa.Column("runtime_observation", sa.JSON(), nullable=True))
    # Existing owner/workspace policies continue to protect task writes.
    op.execute("""
        CREATE FUNCTION preserve_report_runtime_binding() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
            IF OLD.runtime_binding::jsonb IS DISTINCT FROM NEW.runtime_binding::jsonb THEN
                RAISE EXCEPTION 'report runtime binding is immutable';
            END IF;
            RETURN NEW;
        END;
        $$
    """)
    op.execute("""
        CREATE TRIGGER report_runtime_binding_immutable BEFORE UPDATE ON report_tasks
        FOR EACH ROW EXECUTE FUNCTION preserve_report_runtime_binding()
    """)
    op.execute("""
        CREATE POLICY external_reporting_heartbeat_insert ON audit_events
        FOR INSERT WITH CHECK (
            workspace_id = nullif(current_setting('app.current_workspace_id', true), '')::uuid
            AND EXISTS (
                SELECT 1 FROM workspaces w WHERE w.id = workspace_id
                AND w.organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
            )
            AND actor_user_id = nullif(current_setting('app.current_user_id', true), '')::uuid
            AND source = 'mcp' AND action = 'external_report.heartbeat'
            AND target_type = 'report_task'
        )
    """)


def downgrade():
    op.execute("DROP POLICY external_reporting_heartbeat_insert ON audit_events")
    op.execute("DROP TRIGGER report_runtime_binding_immutable ON report_tasks")
    op.execute("DROP FUNCTION preserve_report_runtime_binding()")
    op.drop_column("report_tasks", "runtime_observation")
    op.drop_column("report_tasks", "runtime_binding")
