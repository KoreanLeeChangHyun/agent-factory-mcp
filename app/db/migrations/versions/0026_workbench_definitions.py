"""Persist mutable Workbench drafts and immutable releases.

Revision ID: 0026
Revises: 0025
"""

from uuid import UUID

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0026"
down_revision = "0025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "workbench_definitions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("definition_key", sa.String(64), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("state", sa.String(16), nullable=False, server_default="draft"),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("draft", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("latest_release_id", sa.Uuid(), nullable=True),
        sa.Column(
            "created_by", sa.Uuid(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
        ),
        sa.Column(
            "updated_by", sa.Uuid(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("archived_at", sa.DateTime(timezone=True)),
        sa.ForeignKeyConstraint(
            ["organization_id", "workspace_id"],
            ["workspaces.organization_id", "workspaces.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("workspace_id", "definition_key"),
        sa.UniqueConstraint("workspace_id", "id", name="uq_workbench_definitions_workspace_id_id"),
        sa.CheckConstraint("revision >= 1", name="workbench_definition_positive_revision"),
        sa.CheckConstraint("state IN ('draft','archived')", name="workbench_definition_state"),
        sa.CheckConstraint(
            "jsonb_typeof(draft) = 'object' AND octet_length(draft::text) <= 262144",
            name="workbench_definition_draft_bounds",
        ),
    )
    op.create_table(
        "workbench_releases",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("definition_id", sa.Uuid(), nullable=False),
        sa.Column("definition_revision", sa.Integer(), nullable=False),
        sa.Column("release_number", sa.Integer(), nullable=False),
        sa.Column("schema_version", sa.String(24), nullable=False),
        sa.Column("schema_digest", sa.String(80), nullable=False),
        sa.Column("asset_version", sa.String(24), nullable=False),
        sa.Column("definition_digest", sa.String(80), nullable=False),
        sa.Column("snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "published_by",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "published_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id", "definition_id"],
            ["workbench_definitions.workspace_id", "workbench_definitions.id"],
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint(
            "definition_id", "release_number", name="uq_workbench_releases_release_number"
        ),
        sa.UniqueConstraint(
            "definition_id",
            "definition_revision",
            name="uq_workbench_releases_definition_revision",
        ),
        sa.UniqueConstraint("workspace_id", "id", name="uq_workbench_releases_workspace_id_id"),
        sa.CheckConstraint(
            "definition_revision >= 1 AND release_number >= 1",
            name="workbench_release_positive_versions",
        ),
        sa.CheckConstraint(
            "jsonb_typeof(snapshot) = 'object' AND octet_length(snapshot::text) <= 262144",
            name="workbench_release_snapshot_bounds",
        ),
    )
    op.create_foreign_key(
        "fk_workbench_definition_latest_release",
        "workbench_definitions",
        "workbench_releases",
        ["workspace_id", "latest_release_id"],
        ["workspace_id", "id"],
        ondelete="RESTRICT",
    )
    op.create_table(
        "workbench_publish_receipts",
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("request_key", sa.String(160), nullable=False),
        sa.Column("command_digest", sa.String(64), nullable=False),
        sa.Column("release_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.PrimaryKeyConstraint("workspace_id", "request_key"),
        sa.ForeignKeyConstraint(
            ["workspace_id", "release_id"],
            ["workbench_releases.workspace_id", "workbench_releases.id"],
            ondelete="RESTRICT",
        ),
    )
    for table in ("workbench_definitions", "workbench_releases", "workbench_publish_receipts"):
        op.execute(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY')
        op.execute(f'ALTER TABLE "{table}" FORCE ROW LEVEL SECURITY')
        scope = "current_setting('app.is_platform_admin', true) = 'true' OR workspace_id = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid"
        op.execute(
            f'CREATE POLICY {table}_isolation ON "{table}" USING ({scope}) WITH CHECK ({scope})'
        )
    op.execute(
        """
        CREATE POLICY workbench_audit_insert ON audit_events FOR INSERT WITH CHECK (
            audit_events.organization_id = NULLIF(
                current_setting('app.current_organization_id', true), ''
            )::uuid
            AND audit_events.workspace_id = NULLIF(
                current_setting('app.current_workspace_id', true), ''
            )::uuid
            AND EXISTS (
                SELECT 1 FROM workspaces w
                WHERE w.id = audit_events.workspace_id
                AND w.organization_id = audit_events.organization_id
            )
            AND audit_events.actor_user_id = NULLIF(
                current_setting('app.current_user_id', true), ''
            )::uuid
            AND audit_events.source = current_setting('app.workbench_audit_source', true)
            AND audit_events.source IN ('http', 'mcp')
            AND audit_events.action = current_setting('app.workbench_audit_action', true)
            AND audit_events.action IN (
                'workbench.definition.create',
                'workbench.definition.update',
                'workbench.definition.archived',
                'workbench.definition.draft',
                'workbench.release.publish'
            )
            AND audit_events.target_type = 'workbench'
            AND audit_events.target_id = current_setting(
                'app.workbench_audit_target_id', true
            )
            AND audit_events.outcome = 'success'
        )
        """
    )
    op.execute(
        "CREATE FUNCTION reject_workbench_release_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Workbench releases are immutable' USING ERRCODE='55000'; END $$"
    )
    op.execute(
        "CREATE TRIGGER workbench_release_immutable BEFORE UPDATE OR DELETE ON workbench_releases FOR EACH ROW EXECUTE FUNCTION reject_workbench_release_mutation()"
    )
    connection = op.get_bind()
    connection.execute(sa.text("SELECT set_config('app.is_platform_admin', 'true', true)"))
    permissions = {
        "workbench.read": "Workbench 조회",
        "workbench.preview": "Workbench 초안 미리보기",
        "workbench.create": "Workbench 생성",
        "workbench.update": "Workbench 초안 수정",
        "workbench.publish": "Workbench 게시",
        "workbench.archive": "Workbench 보관",
        "workbench.restore": "Workbench 복원",
    }
    for key, label in permissions.items():
        connection.execute(
            sa.text(
                "INSERT INTO permissions (key,description) VALUES (:key,:label) ON CONFLICT (key) DO NOTHING"
            ),
            {"key": key, "label": label},
        )
    grants = {
        4: permissions.keys(),
        5: permissions.keys(),
        6: ("workbench.read", "workbench.preview", "workbench.create", "workbench.update"),
        7: ("workbench.read",),
    }
    for suffix, keys in grants.items():
        role_id = UUID(f"00000000-0000-4000-8000-{suffix:012d}")
        for key in keys:
            connection.execute(
                sa.text(
                    "INSERT INTO role_permissions (role_id,permission_key) VALUES (:role,:key) ON CONFLICT DO NOTHING"
                ),
                {"role": role_id, "key": key},
            )
    connection.execute(sa.text("SELECT set_config('app.is_platform_admin', 'false', true)"))


def downgrade() -> None:
    op.execute("DROP POLICY workbench_audit_insert ON audit_events")
    op.execute("DROP TRIGGER workbench_release_immutable ON workbench_releases")
    op.execute("DROP FUNCTION reject_workbench_release_mutation")
    op.drop_table("workbench_publish_receipts")
    op.drop_constraint(
        "fk_workbench_definition_latest_release", "workbench_definitions", type_="foreignkey"
    )
    op.drop_table("workbench_releases")
    op.drop_table("workbench_definitions")
