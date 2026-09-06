"""Organization lifecycle, invitations, teams and explicit permission grants."""

from uuid import UUID

import sqlalchemy as sa
from alembic import op

revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None


def timestamps():
    return [
        sa.Column(n, sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now())
        for n in ("created_at", "updated_at")
    ]


def upgrade():
    op.add_column("schedules", sa.Column("execution_user_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_schedules_execution_user",
        "schedules",
        "users",
        ["execution_user_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.add_column(
        "organization_memberships",
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
    )
    op.create_check_constraint(
        "organization_membership_status",
        "organization_memberships",
        "status IN ('active', 'suspended', 'removed')",
    )
    op.create_unique_constraint(
        "uq_workspaces_organization_id_id", "workspaces", ["organization_id", "id"]
    )
    op.create_table(
        "organization_teams",
        sa.Column("id", sa.Uuid(), primary_key=True),
        *timestamps(),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.String(1000), nullable=False),
        sa.UniqueConstraint("organization_id", "name"),
        sa.UniqueConstraint(
            "organization_id", "id", name="uq_organization_teams_organization_id_id"
        ),
    )
    op.create_table(
        "team_memberships",
        *timestamps(),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("team_id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), primary_key=True),
        sa.ForeignKeyConstraint(
            ["organization_id", "team_id"],
            ["organization_teams.organization_id", "organization_teams.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "user_id"],
            ["organization_memberships.organization_id", "organization_memberships.user_id"],
            ondelete="CASCADE",
        ),
    )
    op.create_table(
        "team_workspace_grants",
        *timestamps(),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("team_id", sa.Uuid(), primary_key=True),
        sa.Column("workspace_id", sa.Uuid(), primary_key=True),
        sa.Column(
            "role_id", sa.Uuid(), sa.ForeignKey("roles.id", ondelete="RESTRICT"), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "team_id"],
            ["organization_teams.organization_id", "organization_teams.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "workspace_id"],
            ["workspaces.organization_id", "workspaces.id"],
            ondelete="CASCADE",
        ),
    )
    op.create_table(
        "organization_invitations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        *timestamps(),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column(
            "role_id", sa.Uuid(), sa.ForeignKey("roles.id", ondelete="SET NULL"), nullable=True
        ),
        sa.Column(
            "invited_by", sa.Uuid(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
        ),
        sa.Column("token_digest", sa.LargeBinary(32), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True)),
        sa.Column("cancelled_at", sa.DateTime(timezone=True)),
        sa.Column("workspace_grants", sa.JSON(), nullable=False),
    )
    op.create_index("ix_organization_invitations_email", "organization_invitations", ["email"])
    for table in (
        "organization_teams",
        "team_memberships",
        "team_workspace_grants",
        "organization_invitations",
    ):
        op.create_index(f"ix_{table}_organization_id", table, ["organization_id"])
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        expression = "current_setting('app.is_platform_admin', true) = 'true' OR organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid"
        op.execute(
            f"CREATE POLICY tenant_isolation ON {table} USING ({expression}) WITH CHECK ({expression})"
        )
    # Organization-scoped member management needs to enumerate scoped workspace grants.
    expression = "current_setting('app.is_platform_admin', true) = 'true' OR EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_memberships.workspace_id AND w.organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)"
    op.execute(
        f"CREATE POLICY organization_membership_management ON workspace_memberships USING ({expression}) WITH CHECK ({expression})"
    )
    op.execute(
        "CREATE POLICY organization_member_directory ON users FOR SELECT USING (EXISTS (SELECT 1 FROM organization_memberships m WHERE m.user_id = users.id AND m.organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid))"
    )
    op.execute(
        "CREATE POLICY organization_audit_insert ON audit_events FOR INSERT WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid AND workspace_id IS NULL AND actor_user_id = nullif(current_setting('app.current_user_id', true), '')::uuid AND source = 'http')"
    )
    # Seed frozen definitions below; migrations must not import a changing runtime catalog.
    connection = op.get_bind()
    connection.execute(sa.text("SELECT set_config('app.is_platform_admin', 'true', true)"))
    for key, label in PERMISSIONS.items():
        connection.execute(
            sa.text(
                "INSERT INTO permissions (key, description) VALUES (:key, :label) ON CONFLICT (key) DO NOTHING"
            ),
            {"key": key, "label": label},
        )
    connection.execute(
        sa.text(
            "INSERT INTO roles (id, scope, name, is_system) VALUES (:id, 'organization', 'organization_member', true)"
        ),
        {"id": UUID("00000000-0000-4000-8000-000000000008")},
    )
    for suffix, keys in ROLE_GRANTS.items():
        role_id = UUID(f"00000000-0000-4000-8000-{suffix:012d}")
        for key in keys:
            connection.execute(
                sa.text(
                    "INSERT INTO role_permissions (role_id, permission_key) VALUES (:role, :key) ON CONFLICT DO NOTHING"
                ),
                {"role": role_id, "key": key},
            )
    for legacy, expanded in LEGACY_GRANTS.items():
        for key in expanded:
            connection.execute(
                sa.text(
                    "INSERT INTO role_permissions (role_id, permission_key) SELECT rp.role_id, :key FROM role_permissions rp JOIN roles r ON r.id = rp.role_id WHERE rp.permission_key = :legacy AND r.is_system = false AND r.scope = :scope ON CONFLICT DO NOTHING"
                ),
                {"key": key, "legacy": legacy, "scope": PERMISSION_SCOPES[key]},
            )
    # Direct workspace memberships predate mandatory organization membership.
    connection.execute(
        sa.text(
            "INSERT INTO organization_memberships (id, organization_id, user_id, role_id) SELECT gen_random_uuid(), w.organization_id, wm.user_id, '00000000-0000-4000-8000-000000000008'::uuid FROM workspace_memberships wm JOIN workspaces w ON w.id = wm.workspace_id GROUP BY w.organization_id, wm.user_id ON CONFLICT (organization_id, user_id) DO NOTHING"
        )
    )
    connection.execute(sa.text("SELECT set_config('app.is_platform_admin', 'false', true)"))


def downgrade():
    op.drop_constraint("fk_schedules_execution_user", "schedules", type_="foreignkey")
    op.drop_column("schedules", "execution_user_id")
    op.execute("SELECT set_config('app.is_platform_admin', 'true', true)")
    op.execute(
        "DELETE FROM role_permissions WHERE role_id = '00000000-0000-4000-8000-000000000008'"
    )
    # Refuse a lossy downgrade once the new organization member role is in use.
    op.execute("DELETE FROM roles WHERE id = '00000000-0000-4000-8000-000000000008'")
    op.execute("DROP POLICY organization_audit_insert ON audit_events")
    op.execute("DROP POLICY organization_member_directory ON users")
    op.execute("DROP POLICY organization_membership_management ON workspace_memberships")
    for table in (
        "organization_invitations",
        "team_workspace_grants",
        "team_memberships",
        "organization_teams",
    ):
        op.drop_table(table)
    op.drop_constraint("uq_workspaces_organization_id_id", "workspaces", type_="unique")
    op.drop_constraint("organization_membership_status", "organization_memberships", type_="check")
    op.drop_column("organization_memberships", "status")


PERMISSIONS = {
    "agent.create": "에이전트 생성",
    "agent.delete": "에이전트 삭제",
    "agent.execute": "에이전트 실행",
    "agent.read": "에이전트 조회",
    "agent.report": "에이전트 보고",
    "agent.stop": "에이전트 중지",
    "agent.update": "에이전트 수정",
    "audit.export": "로그 내보내기",
    "audit.read": "로그 조회",
    "document.create": "문서 생성",
    "document.delete": "문서 삭제",
    "document.export": "문서 내보내기",
    "document.import": "문서 가져오기",
    "document.read": "문서 조회",
    "document.update": "문서 수정",
    "integration.create": "외부 연결 생성",
    "integration.delete": "외부 연결 삭제",
    "integration.read": "외부 연결 조회",
    "integration.update": "외부 연결 수정",
    "integration.use": "외부 연결 사용",
    "job.cancel": "작업 실행 취소",
    "job.create": "작업 실행 생성",
    "job.read": "작업 실행 조회",
    "job.retry": "작업 실행 재시도",
    "member.cancel_invite": "구성원 초대 취소",
    "member.invite": "구성원 초대",
    "member.read": "구성원 조회",
    "member.remove": "구성원 제거",
    "member.suspend": "구성원 활동 정지·복구",
    "member.update_role": "구성원 역할 변경",
    "organization.delete": "조직 삭제",
    "organization.read": "조직 조회",
    "organization.transfer": "조직 소유권 이전",
    "organization.update": "조직 수정",
    "planning.create": "계획 생성",
    "planning.delete": "계획 삭제",
    "planning.import": "계획 가져오기",
    "planning.read": "계획 조회",
    "planning.update": "계획 수정",
    "repository.create": "저장소 생성",
    "repository.delete": "저장소 삭제",
    "repository.read": "저장소 조회",
    "role.assign": "역할 역할 부여",
    "role.create": "역할 생성",
    "role.delete": "역할 삭제",
    "role.read": "역할 조회",
    "role.update": "역할 수정",
    "schedule.create": "일정 생성",
    "schedule.delete": "일정 삭제",
    "schedule.read": "일정 조회",
    "schedule.toggle": "일정 활성화·비활성화",
    "schedule.update": "일정 수정",
    "team.create": "팀 생성",
    "team.delete": "팀 삭제",
    "team.manage_members": "팀 참여자 관리",
    "team.read": "팀 조회",
    "team.update": "팀 수정",
    "test.execute": "테스트 실행",
    "test.read": "테스트 조회",
    "token.create": "토큰 생성",
    "token.read": "토큰 조회",
    "token.revoke": "토큰 폐기",
    "workspace.create": "작업공간 생성",
    "workspace.delete": "작업공간 삭제",
    "workspace.manage_members": "작업공간 참여자 관리",
    "workspace.read": "작업공간 조회",
    "workspace.update": "작업공간 수정",
}

ROLE_GRANTS = {
    1: [
        "agent.create",
        "agent.delete",
        "agent.execute",
        "agent.read",
        "agent.report",
        "agent.stop",
        "agent.update",
        "audit.export",
        "audit.read",
        "document.create",
        "document.delete",
        "document.export",
        "document.import",
        "document.read",
        "document.update",
        "integration.create",
        "integration.delete",
        "integration.read",
        "integration.update",
        "integration.use",
        "job.cancel",
        "job.create",
        "job.read",
        "job.retry",
        "member.cancel_invite",
        "member.invite",
        "member.read",
        "member.remove",
        "member.suspend",
        "member.update_role",
        "organization.delete",
        "organization.read",
        "organization.transfer",
        "organization.update",
        "planning.create",
        "planning.delete",
        "planning.import",
        "planning.read",
        "planning.update",
        "repository.create",
        "repository.delete",
        "repository.read",
        "role.assign",
        "role.create",
        "role.delete",
        "role.read",
        "role.update",
        "schedule.create",
        "schedule.delete",
        "schedule.read",
        "schedule.toggle",
        "schedule.update",
        "team.create",
        "team.delete",
        "team.manage_members",
        "team.read",
        "team.update",
        "test.execute",
        "test.read",
        "token.create",
        "token.read",
        "token.revoke",
        "workspace.create",
        "workspace.delete",
        "workspace.manage_members",
        "workspace.read",
        "workspace.update",
    ],
    2: [
        "member.cancel_invite",
        "member.invite",
        "member.read",
        "member.remove",
        "member.suspend",
        "member.update_role",
        "organization.delete",
        "organization.read",
        "organization.transfer",
        "organization.update",
        "role.assign",
        "role.create",
        "role.delete",
        "role.read",
        "role.update",
        "team.create",
        "team.delete",
        "team.manage_members",
        "team.read",
        "team.update",
        "workspace.create",
    ],
    3: [
        "member.cancel_invite",
        "member.invite",
        "member.read",
        "member.remove",
        "member.suspend",
        "member.update_role",
        "organization.read",
        "organization.update",
        "role.assign",
        "role.create",
        "role.delete",
        "role.read",
        "role.update",
        "team.create",
        "team.delete",
        "team.manage_members",
        "team.read",
        "team.update",
        "workspace.create",
    ],
    4: [
        "agent.create",
        "agent.delete",
        "agent.execute",
        "agent.read",
        "agent.report",
        "agent.stop",
        "agent.update",
        "audit.export",
        "audit.read",
        "document.create",
        "document.delete",
        "document.export",
        "document.import",
        "document.read",
        "document.update",
        "integration.create",
        "integration.delete",
        "integration.read",
        "integration.update",
        "integration.use",
        "job.cancel",
        "job.create",
        "job.read",
        "job.retry",
        "planning.create",
        "planning.delete",
        "planning.import",
        "planning.read",
        "planning.update",
        "repository.create",
        "repository.delete",
        "repository.read",
        "schedule.create",
        "schedule.delete",
        "schedule.read",
        "schedule.toggle",
        "schedule.update",
        "test.execute",
        "test.read",
        "token.create",
        "token.read",
        "token.revoke",
        "workspace.delete",
        "workspace.manage_members",
        "workspace.read",
        "workspace.update",
    ],
    5: [
        "agent.create",
        "agent.delete",
        "agent.execute",
        "agent.read",
        "agent.report",
        "agent.stop",
        "agent.update",
        "audit.export",
        "audit.read",
        "document.create",
        "document.delete",
        "document.export",
        "document.import",
        "document.read",
        "document.update",
        "integration.create",
        "integration.delete",
        "integration.read",
        "integration.update",
        "integration.use",
        "job.cancel",
        "job.create",
        "job.read",
        "job.retry",
        "planning.create",
        "planning.delete",
        "planning.import",
        "planning.read",
        "planning.update",
        "repository.create",
        "repository.delete",
        "repository.read",
        "schedule.create",
        "schedule.delete",
        "schedule.read",
        "schedule.toggle",
        "schedule.update",
        "test.execute",
        "test.read",
        "token.create",
        "token.read",
        "token.revoke",
        "workspace.delete",
        "workspace.manage_members",
        "workspace.read",
        "workspace.update",
    ],
    6: [
        "agent.execute",
        "agent.read",
        "agent.report",
        "agent.stop",
        "document.create",
        "document.export",
        "document.import",
        "document.read",
        "document.update",
        "integration.read",
        "integration.use",
        "job.cancel",
        "job.create",
        "job.read",
        "job.retry",
        "planning.create",
        "planning.import",
        "planning.read",
        "planning.update",
        "repository.read",
        "schedule.read",
        "test.read",
        "token.create",
        "token.read",
        "token.revoke",
        "workspace.read",
    ],
    7: [
        "agent.read",
        "document.read",
        "job.read",
        "planning.read",
        "repository.read",
        "schedule.read",
        "test.read",
        "workspace.read",
    ],
    8: ["member.read", "organization.read", "role.read", "team.read"],
}


LEGACY_GRANTS = {
    "document.manage": [
        "document.create",
        "document.delete",
        "document.export",
        "document.import",
        "document.read",
        "document.update",
    ],
    "integration.manage": [
        "integration.create",
        "integration.delete",
        "integration.read",
        "integration.update",
        "integration.use",
    ],
    "organization.manage": [
        "member.cancel_invite",
        "member.invite",
        "member.read",
        "member.remove",
        "member.suspend",
        "member.update_role",
        "organization.read",
        "organization.update",
        "role.assign",
        "role.create",
        "role.delete",
        "role.read",
        "role.update",
        "team.create",
        "team.delete",
        "team.manage_members",
        "team.read",
        "team.update",
        "workspace.create",
    ],
    "workspace.manage": [
        "agent.create",
        "agent.delete",
        "agent.execute",
        "agent.read",
        "agent.report",
        "agent.stop",
        "agent.update",
        "audit.export",
        "audit.read",
        "document.create",
        "document.delete",
        "document.export",
        "document.import",
        "document.read",
        "document.update",
        "integration.create",
        "integration.delete",
        "integration.read",
        "integration.update",
        "integration.use",
        "job.cancel",
        "job.create",
        "job.read",
        "job.retry",
        "planning.create",
        "planning.delete",
        "planning.import",
        "planning.read",
        "planning.update",
        "repository.create",
        "repository.delete",
        "repository.read",
        "schedule.create",
        "schedule.delete",
        "schedule.read",
        "schedule.toggle",
        "schedule.update",
        "test.execute",
        "test.read",
        "token.create",
        "token.read",
        "token.revoke",
        "workspace.delete",
        "workspace.manage_members",
        "workspace.read",
        "workspace.update",
    ],
}
PERMISSION_SCOPES = {
    "agent.create": "workspace",
    "agent.delete": "workspace",
    "agent.execute": "workspace",
    "agent.read": "workspace",
    "agent.report": "workspace",
    "agent.stop": "workspace",
    "agent.update": "workspace",
    "audit.export": "workspace",
    "audit.read": "workspace",
    "document.create": "workspace",
    "document.delete": "workspace",
    "document.export": "workspace",
    "document.import": "workspace",
    "document.read": "workspace",
    "document.update": "workspace",
    "integration.create": "workspace",
    "integration.delete": "workspace",
    "integration.read": "workspace",
    "integration.update": "workspace",
    "integration.use": "workspace",
    "job.cancel": "workspace",
    "job.create": "workspace",
    "job.read": "workspace",
    "job.retry": "workspace",
    "member.cancel_invite": "organization",
    "member.invite": "organization",
    "member.read": "organization",
    "member.remove": "organization",
    "member.suspend": "organization",
    "member.update_role": "organization",
    "organization.delete": "organization",
    "organization.read": "organization",
    "organization.transfer": "organization",
    "organization.update": "organization",
    "planning.create": "workspace",
    "planning.delete": "workspace",
    "planning.import": "workspace",
    "planning.read": "workspace",
    "planning.update": "workspace",
    "repository.create": "workspace",
    "repository.delete": "workspace",
    "repository.read": "workspace",
    "role.assign": "organization",
    "role.create": "organization",
    "role.delete": "organization",
    "role.read": "organization",
    "role.update": "organization",
    "schedule.create": "workspace",
    "schedule.delete": "workspace",
    "schedule.read": "workspace",
    "schedule.toggle": "workspace",
    "schedule.update": "workspace",
    "team.create": "organization",
    "team.delete": "organization",
    "team.manage_members": "organization",
    "team.read": "organization",
    "team.update": "organization",
    "test.execute": "workspace",
    "test.read": "workspace",
    "token.create": "workspace",
    "token.read": "workspace",
    "token.revoke": "workspace",
    "workspace.create": "organization",
    "workspace.delete": "workspace",
    "workspace.manage_members": "workspace",
    "workspace.read": "workspace",
    "workspace.update": "workspace",
}
