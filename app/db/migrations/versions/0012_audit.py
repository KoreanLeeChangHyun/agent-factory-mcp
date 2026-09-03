"""Add immutable audit events.

Revision ID: 0012
Revises: 0011
"""

import sqlalchemy as sa
from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "audit_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column(
            "organization_id", sa.Uuid(), sa.ForeignKey("organizations.id", ondelete="SET NULL")
        ),
        sa.Column("workspace_id", sa.Uuid(), sa.ForeignKey("workspaces.id", ondelete="SET NULL")),
        sa.Column("action", sa.String(200), nullable=False),
        sa.Column("target_type", sa.String(120)),
        sa.Column("target_id", sa.String(500)),
        sa.Column("outcome", sa.String(30), nullable=False),
        sa.Column("request_id", sa.String(64)),
        sa.Column("source", sa.String(40), nullable=False, server_default="http"),
        sa.Column("event_metadata", sa.JSON(), nullable=False, server_default="{}"),
        sa.CheckConstraint("outcome IN ('success', 'failure')", name="audit_outcome"),
    )
    for column in ("occurred_at", "organization_id", "workspace_id", "action", "request_id"):
        op.create_index(f"ix_audit_events_{column}", "audit_events", [column])
    expression = (
        "current_setting('app.is_platform_admin', true) = 'true' OR "
        "organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid"
    )
    op.execute('ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY')
    op.execute('ALTER TABLE "audit_events" FORCE ROW LEVEL SECURITY')
    op.execute(f'CREATE POLICY audit_read ON "audit_events" FOR SELECT USING ({expression})')
    op.execute(
        'CREATE POLICY audit_insert ON "audit_events" FOR INSERT WITH CHECK '
        "(current_setting('app.is_platform_admin', true) = 'true')"
    )
    op.execute(
        "CREATE FUNCTION reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ "
        "BEGIN RAISE EXCEPTION 'audit events are immutable'; END $$"
    )
    op.execute(
        "CREATE TRIGGER audit_events_immutable BEFORE UPDATE OR DELETE ON audit_events "
        "FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation()"
    )


def downgrade() -> None:
    op.drop_table("audit_events")
    op.execute("DROP FUNCTION reject_audit_mutation()")
