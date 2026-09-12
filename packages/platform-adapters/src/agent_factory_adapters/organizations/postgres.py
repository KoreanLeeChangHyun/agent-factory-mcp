"""PostgreSQL organization repository with locked mutations and atomic audit."""

import json
from datetime import datetime
from uuid import UUID

from agent_factory_core.organizations import (
    InvitationRecord,
    InviterAuthority,
    MemberRecord,
    MembershipStatus,
    OrganizationRecord,
    OrganizationSnapshot,
    RoleRecord,
    RoleScope,
    TeamRecord,
    WorkspaceGrant,
)
from agent_factory_core.organizations.domain import (
    InvitationProjection,
    MemberDetailProjection,
    MemberProjection,
    PermissionSourceProjection,
    RoleProjection,
    TeamProjection,
    WorkspaceAccessProjection,
    WorkspaceOptionProjection,
)
from agent_factory_core.organizations.permissions import CATALOG
from agent_factory_core.organizations.system_roles import (
    ORGANIZATION_ADMIN_ROLE_ID,
    ORGANIZATION_OWNER_ROLE_ID,
    WORKSPACE_OWNER_ROLE_ID,
)
from agent_factory_core.shared.errors import ConflictError, NotFoundError
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession


class PostgresOrganizationRepository:
    """Maps deployed tables to core DTOs; it owns no authorization decisions."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self._conflict = (
            "organization_conflict",
            "중복된 이름 또는 사용 중인 항목입니다.",
        )

    async def get_organization(self, organization_id: UUID) -> OrganizationRecord | None:
        row = (
            await self.session.execute(
                text("""
                SELECT id, name, slug, is_personal, revision, deleted_at
                  FROM organizations WHERE id = :id AND deleted_at IS NULL
            """),
                {"id": organization_id},
            )
        ).first()
        if row is None:
            return None
        return OrganizationRecord(
            row.id, row.name, row.slug, row.is_personal, row.revision, row.deleted_at
        )

    async def list_members(
        self, organization_id: UUID, *, search: str, status: str | None
    ) -> list[MemberProjection]:
        pattern = f"%{search.replace('%', '').replace('_', '')}%"
        rows = await self.session.execute(
            text("""
            SELECT m.user_id, u.email, u.display_name, m.role_id, r.name AS role_name,
                   m.status, m.created_at
              FROM organization_memberships m
              JOIN users u ON u.id = m.user_id
              JOIN roles r ON r.id = m.role_id
             WHERE m.organization_id = :organization_id AND u.deleted_at IS NULL
               AND (CAST(:status AS text) IS NULL OR m.status = CAST(:status AS text))
               AND (:search = '' OR u.email ILIKE :pattern OR u.display_name ILIKE :pattern)
             ORDER BY u.display_name, u.id
        """),
            {
                "organization_id": organization_id,
                "status": status,
                "search": search,
                "pattern": pattern,
            },
        )
        return [
            MemberProjection(
                user_id=row.user_id,
                email=row.email,
                name=row.display_name,
                role_id=row.role_id,
                role_name=row.role_name,
                status=MembershipStatus(row.status),
                joined_at=row.created_at,
            )
            for row in rows
        ]

    async def list_roles(self, organization_id: UUID) -> list[RoleProjection]:
        rows = await self.session.execute(
            text("""
            SELECT r.id, r.name, r.scope, r.is_system,
                   COALESCE(array_agg(rp.permission_key ORDER BY rp.permission_key)
                     FILTER (WHERE rp.permission_key IS NOT NULL), ARRAY[]::text[]) permissions
              FROM roles r LEFT JOIN role_permissions rp ON rp.role_id = r.id
             WHERE r.scope IN ('organization', 'workspace')
               AND (r.organization_id IS NULL OR r.organization_id = :organization_id)
             GROUP BY r.id ORDER BY r.scope, r.name
        """),
            {"organization_id": organization_id},
        )
        return [
            RoleProjection(
                id=row.id,
                name=row.name,
                scope=RoleScope(row.scope),
                is_system=row.is_system,
                permissions=[key for key in row.permissions if key in CATALOG],
            )
            for row in rows
        ]

    async def list_teams(self, organization_id: UUID) -> list[TeamProjection]:
        rows = await self.session.execute(
            text("""
            SELECT t.id, t.name, t.description,
                   COALESCE(array_agg(DISTINCT tm.user_id)
                     FILTER (WHERE tm.user_id IS NOT NULL), ARRAY[]::uuid[]) members
              FROM organization_teams t
              LEFT JOIN team_memberships tm ON tm.organization_id = t.organization_id
                                            AND tm.team_id = t.id
             WHERE t.organization_id = :organization_id
             GROUP BY t.id ORDER BY t.name
        """),
            {"organization_id": organization_id},
        )
        result: list[TeamProjection] = []
        for row in rows:
            grants = await self.session.execute(
                text("""
                SELECT workspace_id, role_id FROM team_workspace_grants
                 WHERE organization_id = :organization_id AND team_id = :team_id
                 ORDER BY workspace_id
            """),
                {"organization_id": organization_id, "team_id": row.id},
            )
            result.append(
                TeamProjection(
                    id=row.id,
                    name=row.name,
                    description=row.description,
                    members=list(row.members),
                    workspaces=[
                        {"workspace_id": grant.workspace_id, "role_id": grant.role_id}
                        for grant in grants
                    ],
                )
            )
        return result

    async def list_invitations(
        self, organization_id: UUID, now: datetime
    ) -> list[InvitationProjection]:
        rows = await self.session.execute(
            text("""
            SELECT id, email, role_id, workspace_grants, expires_at, accepted_at, cancelled_at
              FROM organization_invitations WHERE organization_id = :organization_id
             ORDER BY created_at DESC
        """),
            {"organization_id": organization_id},
        )
        return [
            InvitationProjection(
                id=row.id,
                email=row.email,
                role_id=row.role_id,
                workspace_grants=row.workspace_grants or [],
                expires_at=row.expires_at,
                status=(
                    "accepted"
                    if row.accepted_at
                    else "cancelled"
                    if row.cancelled_at
                    else "expired"
                    if row.expires_at <= now
                    else "pending"
                ),
            )
            for row in rows
        ]

    async def member_detail(
        self, organization_id: UUID, user_id: UUID
    ) -> MemberDetailProjection | None:
        member = (
            await self.session.execute(
                text("""
                SELECT m.role_id, m.status, u.email, u.display_name
                  FROM organization_memberships m JOIN users u ON u.id = m.user_id
                 WHERE m.organization_id = :organization_id AND m.user_id = :user_id
                   AND u.deleted_at IS NULL
            """),
                {"organization_id": organization_id, "user_id": user_id},
            )
        ).first()
        if member is None:
            return None
        team_rows = await self.session.execute(
            text("""
            SELECT t.id, t.name FROM organization_teams t
              JOIN team_memberships tm ON tm.organization_id = t.organization_id
                                      AND tm.team_id = t.id
             WHERE t.organization_id = :organization_id AND tm.user_id = :user_id
             ORDER BY t.name
        """),
            {"organization_id": organization_id, "user_id": user_id},
        )
        source_rows = await self.session.execute(
            text("""
            WITH active_member AS (
              SELECT 1 FROM organization_memberships
               WHERE organization_id = :organization_id AND user_id = :user_id
                 AND status = 'active'
            ), role_sources AS (
              SELECT NULL::uuid AS workspace_id, 'organization'::text AS source,
                     r.id AS role_id, r.name AS role_name, NULL::uuid AS team_id,
                     NULL::text AS team_name
                FROM active_member a, organization_memberships om JOIN roles r ON r.id = om.role_id
               WHERE om.organization_id = :organization_id AND om.user_id = :user_id
              UNION ALL
              SELECT wm.workspace_id, 'direct'::text, r.id, r.name, NULL::uuid, NULL::text
                FROM active_member a, workspace_memberships wm
                JOIN workspaces w ON w.id = wm.workspace_id
                JOIN roles r ON r.id = wm.role_id
               WHERE w.organization_id = :organization_id AND wm.user_id = :user_id
                 AND w.deleted_at IS NULL AND w.status = 'active'
              UNION ALL
              SELECT twg.workspace_id, 'team'::text, r.id, r.name, t.id, t.name
                FROM active_member a, team_memberships tm
                JOIN organization_teams t ON t.organization_id = tm.organization_id
                                         AND t.id = tm.team_id
                JOIN team_workspace_grants twg ON twg.organization_id = tm.organization_id
                                              AND twg.team_id = tm.team_id
                JOIN workspaces w ON w.id = twg.workspace_id
                JOIN roles r ON r.id = twg.role_id
               WHERE tm.organization_id = :organization_id AND tm.user_id = :user_id
                 AND w.deleted_at IS NULL AND w.status = 'active'
            )
            SELECT rs.*, w.name AS workspace_name,
                   COALESCE(array_agg(rp.permission_key ORDER BY rp.permission_key)
                     FILTER (WHERE rp.permission_key IS NOT NULL), ARRAY[]::text[]) permissions
              FROM role_sources rs LEFT JOIN role_permissions rp ON rp.role_id = rs.role_id
              LEFT JOIN workspaces w ON w.id = rs.workspace_id
             GROUP BY rs.workspace_id, rs.source, rs.role_id, rs.role_name,
                      rs.team_id, rs.team_name, w.name
             ORDER BY w.name NULLS FIRST, rs.source, rs.role_name
        """),
            {"organization_id": organization_id, "user_id": user_id},
        )
        organization_sources: list[PermissionSourceProjection] = []
        workspaces: dict[UUID, WorkspaceAccessProjection] = {}
        for row in source_rows:
            source = PermissionSourceProjection(
                source=row.source,
                role_id=row.role_id,
                role_name=row.role_name,
                permissions=[key for key in row.permissions if key in CATALOG],
            )
            if row.team_id is not None:
                source["team_id"] = row.team_id
                source["team_name"] = row.team_name
            if row.workspace_id is None:
                organization_sources.append(source)
                continue
            workspace = workspaces.setdefault(
                row.workspace_id,
                WorkspaceAccessProjection(
                    workspace_id=row.workspace_id,
                    name=row.workspace_name,
                    sources=[],
                    permissions=[],
                ),
            )
            workspace["sources"].append(source)
            workspace["permissions"] = sorted(
                set(workspace["permissions"]) | set(source["permissions"])
            )
        return MemberDetailProjection(
            user_id=user_id,
            name=member.display_name,
            email=member.email,
            role_id=member.role_id,
            status=MembershipStatus(member.status),
            teams=[{"id": row.id, "name": row.name} for row in team_rows],
            workspaces=list(workspaces.values()),
            organization_sources=organization_sources,
        )

    async def lock_snapshot(self, organization_id: UUID) -> OrganizationSnapshot:
        organization = (
            await self.session.execute(
                text("""
            SELECT id, name, slug, is_personal, revision, deleted_at
              FROM organizations WHERE id = :id AND deleted_at IS NULL FOR UPDATE
        """),
                {"id": organization_id},
            )
        ).first()
        if organization is None:
            raise NotFoundError("organization_not_found", "조직을 찾을 수 없습니다.")
        members = await self.session.execute(
            text("""
            SELECT m.user_id, u.email, u.display_name, m.role_id, m.status, m.created_at
              FROM organization_memberships m JOIN users u ON u.id = m.user_id
             WHERE m.organization_id = :id AND u.deleted_at IS NULL
        """),
            {"id": organization_id},
        )
        role_rows = list(
            await self.session.execute(
                text("""
            SELECT r.id, r.organization_id, r.name, r.scope, r.is_system,
                   COALESCE(array_agg(rp.permission_key)
                     FILTER (WHERE rp.permission_key IS NOT NULL), ARRAY[]::text[]) permissions
              FROM roles r LEFT JOIN role_permissions rp ON rp.role_id = r.id
             WHERE r.organization_id IS NULL OR r.organization_id = :id
             GROUP BY r.id
        """),
                {"id": organization_id},
            )
        )
        team_rows = list(
            await self.session.execute(
                text("""
            SELECT id, name, description FROM organization_teams WHERE organization_id = :id
        """),
                {"id": organization_id},
            )
        )
        teams: list[TeamRecord] = []
        for team in team_rows:
            team_members = await self.session.scalars(
                text("""
                SELECT user_id FROM team_memberships
                 WHERE organization_id = :organization_id AND team_id = :team_id
            """),
                {"organization_id": organization_id, "team_id": team.id},
            )
            grants = await self.session.execute(
                text("""
                SELECT workspace_id, role_id FROM team_workspace_grants
                 WHERE organization_id = :organization_id AND team_id = :team_id
            """),
                {"organization_id": organization_id, "team_id": team.id},
            )
            teams.append(
                TeamRecord(
                    team.id,
                    team.name,
                    team.description,
                    frozenset(team_members),
                    tuple(WorkspaceGrant(row.workspace_id, row.role_id) for row in grants),
                )
            )
        invitation_rows = await self.session.execute(
            text("""
            SELECT id, organization_id, email, role_id, invited_by, workspace_grants,
                   expires_at, accepted_at, cancelled_at
              FROM organization_invitations WHERE organization_id = :id
        """),
            {"id": organization_id},
        )
        invitations = tuple(
            InvitationRecord(
                row.id,
                row.organization_id,
                row.email,
                row.role_id,
                row.invited_by,
                tuple(
                    WorkspaceGrant(UUID(item["workspace_id"]), UUID(item["role_id"]))
                    for item in (row.workspace_grants or [])
                ),
                row.expires_at,
                row.accepted_at,
                row.cancelled_at,
            )
            for row in invitation_rows
        )
        owner_rows = await self.session.execute(
            text("""
            SELECT wm.user_id, wm.workspace_id,
                   count(*) OVER (PARTITION BY wm.workspace_id) owner_count
              FROM workspace_memberships wm
              JOIN workspaces w ON w.id = wm.workspace_id
              JOIN organization_memberships om ON om.organization_id = w.organization_id
                                                AND om.user_id = wm.user_id
             WHERE w.organization_id = :id AND w.deleted_at IS NULL AND w.status = 'active'
               AND om.status = 'active' AND wm.role_id = :owner_role
        """),
            {"id": organization_id, "owner_role": WORKSPACE_OWNER_ROLE_ID},
        )
        owner_counts: dict[UUID, dict[UUID, int]] = {}
        for row in owner_rows:
            owner_counts.setdefault(row.user_id, {})[row.workspace_id] = row.owner_count
        active_workspace_ids = frozenset(
            await self.session.scalars(
                text("""
                    SELECT id FROM workspaces WHERE organization_id = :organization_id
                       AND deleted_at IS NULL AND status = 'active'
                """),
                {"organization_id": organization_id},
            )
        )
        direct_rows = await self.session.execute(
            text("""
                SELECT wm.user_id, wm.workspace_id, wm.role_id
                  FROM workspace_memberships wm JOIN workspaces w ON w.id = wm.workspace_id
                 WHERE w.organization_id = :organization_id AND w.deleted_at IS NULL
            """),
            {"organization_id": organization_id},
        )
        direct_workspace_roles: dict[UUID, dict[UUID, UUID]] = {}
        for row in direct_rows:
            direct_workspace_roles.setdefault(row.user_id, {})[row.workspace_id] = row.role_id
        return OrganizationSnapshot(
            OrganizationRecord(
                organization.id,
                organization.name,
                organization.slug,
                organization.is_personal,
                organization.revision,
                organization.deleted_at,
            ),
            tuple(
                MemberRecord(
                    row.user_id,
                    row.email,
                    row.display_name,
                    row.role_id,
                    MembershipStatus(row.status),
                    row.created_at,
                )
                for row in members
            ),
            tuple(
                RoleRecord(
                    row.id,
                    row.organization_id,
                    row.name,
                    RoleScope(row.scope),
                    frozenset(row.permissions),
                    row.is_system,
                )
                for row in role_rows
                if row.scope in {"organization", "workspace"}
            ),
            tuple(teams),
            invitations,
            owner_counts,
            active_workspace_ids,
            direct_workspace_roles,
        )

    async def find_invitation_id_by_digest(
        self, organization_id: UUID, digest: bytes
    ) -> UUID | None:
        return await self.session.scalar(
            text("""
            SELECT id FROM organization_invitations
             WHERE organization_id = :organization_id AND token_digest = :digest
               AND accepted_at IS NULL AND cancelled_at IS NULL
        """),
            {"organization_id": organization_id, "digest": digest},
        )

    async def inviter_authority(
        self,
        organization_id: UUID,
        user_id: UUID,
        workspace_ids: tuple[UUID, ...],
    ) -> InviterAuthority:
        membership = (
            await self.session.execute(
                text("""
            SELECT m.role_id, m.status, u.status AS user_status, u.deleted_at,
                   COALESCE(array_agg(rp.permission_key)
                     FILTER (WHERE rp.permission_key IS NOT NULL), ARRAY[]::text[]) permissions
              FROM organization_memberships m JOIN roles r ON r.id = m.role_id
              JOIN users u ON u.id = m.user_id
              LEFT JOIN role_permissions rp ON rp.role_id = r.id
             WHERE m.organization_id = :organization_id AND m.user_id = :user_id
             GROUP BY m.role_id, m.status, u.status, u.deleted_at
        """),
                {"organization_id": organization_id, "user_id": user_id},
            )
        ).first()
        if membership is None or membership.status != "active":
            return InviterAuthority(False, False, frozenset(), {}, frozenset())
        workspace_permissions: dict[UUID, frozenset[str]] = {}
        active_workspaces: set[UUID] = set()
        for workspace_id in workspace_ids:
            status = await self.session.scalar(
                text("""
                SELECT status FROM workspaces WHERE id = :workspace_id
                   AND organization_id = :organization_id AND deleted_at IS NULL
            """),
                {"workspace_id": workspace_id, "organization_id": organization_id},
            )
            if status != "active":
                continue
            active_workspaces.add(workspace_id)
            permissions = await self.session.scalars(
                text("""
                SELECT DISTINCT rp.permission_key
                  FROM role_permissions rp WHERE rp.role_id IN (
                    SELECT wm.role_id FROM workspace_memberships wm
                     WHERE wm.workspace_id = :workspace_id AND wm.user_id = :user_id
                    UNION
                    SELECT twg.role_id FROM team_workspace_grants twg
                      JOIN team_memberships tm ON tm.organization_id = twg.organization_id
                                              AND tm.team_id = twg.team_id
                     WHERE twg.organization_id = :organization_id
                       AND twg.workspace_id = :workspace_id AND tm.user_id = :user_id
                  )
            """),
                {
                    "workspace_id": workspace_id,
                    "organization_id": organization_id,
                    "user_id": user_id,
                },
            )
            workspace_permissions[workspace_id] = frozenset(permissions)
        return InviterAuthority(
            membership.user_status == "active" and membership.deleted_at is None,
            membership.role_id == ORGANIZATION_OWNER_ROLE_ID,
            frozenset(membership.permissions),
            workspace_permissions,
            frozenset(active_workspaces),
        )

    async def list_workspace_options(
        self, organization_id: UUID
    ) -> list[WorkspaceOptionProjection]:
        rows = await self.session.execute(
            text("""
            SELECT id, name FROM workspaces WHERE organization_id = :organization_id
               AND deleted_at IS NULL AND status = 'active' ORDER BY name, id
        """),
            {"organization_id": organization_id},
        )
        return [WorkspaceOptionProjection(id=row.id, name=row.name) for row in rows]

    async def list_audit(self, organization_id: UUID) -> list[dict[str, object]]:
        rows = await self.session.execute(
            text("""
            SELECT id, occurred_at, actor_user_id, action, target_id, event_metadata
              FROM audit_events WHERE organization_id = :organization_id
             ORDER BY occurred_at DESC, id DESC LIMIT 200
        """),
            {"organization_id": organization_id},
        )
        return [
            {
                "id": row.id,
                "occurred_at": row.occurred_at,
                "actor_user_id": row.actor_user_id,
                "action": row.action,
                "target_id": row.target_id,
                "metadata": row.event_metadata,
            }
            for row in rows
        ]

    async def create_with_owner(
        self, *, organization_id: UUID, name: str, slug: str, owner_id: UUID
    ) -> None:
        self._conflict = (
            "organization_slug_exists",
            "이미 사용 중인 조직 식별자입니다.",
        )
        await self.session.execute(
            text("""
                SELECT set_config('app.current_user_id', :user_id, true),
                       set_config('app.current_organization_id', :organization_id, true),
                       set_config('app.current_workspace_id', '', true)
            """),
            {"user_id": str(owner_id), "organization_id": str(organization_id)},
        )
        try:
            await self.session.execute(
                text("""
                INSERT INTO organizations (id, name, slug, is_personal)
                VALUES (:id, :name, :slug, false)
            """),
                {"id": organization_id, "name": name, "slug": slug},
            )
        except IntegrityError as exc:
            await self.session.rollback()
            raise ConflictError(*self._conflict) from exc
        await self.session.execute(
            text("""
            INSERT INTO organization_memberships
                (id, organization_id, user_id, role_id, status)
            VALUES (gen_random_uuid(), :organization_id, :user_id, :role_id, 'active')
        """),
            {
                "organization_id": organization_id,
                "user_id": owner_id,
                "role_id": ORGANIZATION_OWNER_ROLE_ID,
            },
        )

    async def update_organization(
        self, organization_id: UUID, *, name: str, slug: str | None, expected_revision: int
    ) -> None:
        try:
            await self.session.execute(
                text("""
                UPDATE organizations SET name = :name, slug = COALESCE(:slug, slug),
                       revision = revision + 1, updated_at = now()
                 WHERE id = :id AND revision = :revision AND deleted_at IS NULL
            """),
                {
                    "id": organization_id,
                    "name": name,
                    "slug": slug,
                    "revision": expected_revision,
                },
            )
        except IntegrityError as exc:
            await self.session.rollback()
            raise ConflictError(*self._conflict) from exc

    async def soft_delete_organization(self, organization_id: UUID, deleted_at: datetime) -> None:
        await self.session.execute(
            text("""
            UPDATE organizations SET deleted_at = :deleted_at, revision = revision + 1,
                   updated_at = now() WHERE id = :id
        """),
            {"id": organization_id, "deleted_at": deleted_at},
        )

    async def update_member(
        self, organization_id: UUID, user_id: UUID, *, role_id: UUID, status: str
    ) -> None:
        await self.session.execute(
            text("""
            UPDATE organization_memberships SET role_id = :role_id, status = :status,
                   updated_at = now()
             WHERE organization_id = :organization_id AND user_id = :user_id
        """),
            {
                "organization_id": organization_id,
                "user_id": user_id,
                "role_id": role_id,
                "status": status,
            },
        )

    async def remove_member_grants(self, organization_id: UUID, user_id: UUID) -> None:
        await self.session.execute(
            text("""
            DELETE FROM team_memberships
             WHERE organization_id = :organization_id AND user_id = :user_id
        """),
            {"organization_id": organization_id, "user_id": user_id},
        )
        await self.session.execute(
            text("""
            DELETE FROM workspace_memberships wm USING workspaces w
             WHERE wm.workspace_id = w.id AND w.organization_id = :organization_id
               AND wm.user_id = :user_id
        """),
            {"organization_id": organization_id, "user_id": user_id},
        )

    async def transfer_ownership(
        self, organization_id: UUID, *, previous_owner_id: UUID, next_owner_id: UUID
    ) -> None:
        await self.session.execute(
            text("""
            UPDATE organization_memberships
               SET role_id = CASE
                   WHEN user_id = :next_owner THEN CAST(:owner_role AS uuid)
                   ELSE CAST(:admin_role AS uuid)
               END,
                   updated_at = now()
             WHERE organization_id = :organization_id
               AND user_id IN (:previous_owner, :next_owner)
        """),
            {
                "organization_id": organization_id,
                "previous_owner": previous_owner_id,
                "next_owner": next_owner_id,
                "owner_role": ORGANIZATION_OWNER_ROLE_ID,
                "admin_role": ORGANIZATION_ADMIN_ROLE_ID,
            },
        )

    async def save_role(self, organization_id: UUID, role: RoleRecord) -> None:
        try:
            await self.session.execute(
                text("""
                INSERT INTO roles (id, organization_id, name, scope, is_system)
                VALUES (:id, :organization_id, :name, :scope, false)
                ON CONFLICT (id) DO UPDATE SET name = excluded.name
            """),
                {
                    "id": role.id,
                    "organization_id": organization_id,
                    "name": role.name,
                    "scope": role.scope.value,
                },
            )
        except IntegrityError as exc:
            await self.session.rollback()
            raise ConflictError(*self._conflict) from exc
        await self.session.execute(
            text("DELETE FROM role_permissions WHERE role_id = :id"), {"id": role.id}
        )
        for key in sorted(role.permissions):
            await self.session.execute(
                text("""
                INSERT INTO role_permissions (role_id, permission_key) VALUES (:role_id, :key)
            """),
                {"role_id": role.id, "key": key},
            )

    async def delete_role(self, organization_id: UUID, role_id: UUID) -> None:
        await self.session.execute(
            text("""
            DELETE FROM roles WHERE id = :id AND organization_id = :organization_id
        """),
            {"id": role_id, "organization_id": organization_id},
        )

    async def set_workspace_member(
        self,
        organization_id: UUID,
        workspace_id: UUID,
        user_id: UUID,
        role_id: UUID | None,
    ) -> None:
        await self.session.execute(
            text("""
            DELETE FROM workspace_memberships wm USING workspaces w
             WHERE wm.workspace_id = w.id AND w.organization_id = :organization_id
               AND wm.workspace_id = :workspace_id AND wm.user_id = :user_id
        """),
            {"organization_id": organization_id, "workspace_id": workspace_id, "user_id": user_id},
        )
        if role_id:
            await self.session.execute(
                text("""
                INSERT INTO workspace_memberships (id, workspace_id, user_id, role_id)
                VALUES (gen_random_uuid(), :workspace_id, :user_id, :role_id)
            """),
                {"workspace_id": workspace_id, "user_id": user_id, "role_id": role_id},
            )

    async def save_team(self, organization_id: UUID, team: TeamRecord) -> None:
        try:
            await self.session.execute(
                text("""
                INSERT INTO organization_teams (id, organization_id, name, description)
                VALUES (:id, :organization_id, :name, :description)
                ON CONFLICT (id) DO UPDATE SET name = excluded.name,
                    description = excluded.description, updated_at = now()
            """),
                {
                    "id": team.id,
                    "organization_id": organization_id,
                    "name": team.name,
                    "description": team.description,
                },
            )
        except IntegrityError as exc:
            await self.session.rollback()
            raise ConflictError(*self._conflict) from exc

    async def delete_team(self, organization_id: UUID, team_id: UUID) -> None:
        await self.session.execute(
            text("""
            DELETE FROM organization_teams WHERE id = :id AND organization_id = :organization_id
        """),
            {"id": team_id, "organization_id": organization_id},
        )

    async def set_team_member(
        self, organization_id: UUID, team_id: UUID, user_id: UUID, present: bool
    ) -> None:
        await self.session.execute(
            text("""
            DELETE FROM team_memberships
             WHERE organization_id = :organization_id AND team_id = :team_id
               AND user_id = :user_id
        """),
            {"organization_id": organization_id, "team_id": team_id, "user_id": user_id},
        )
        if present:
            await self.session.execute(
                text("""
                INSERT INTO team_memberships (organization_id, team_id, user_id)
                VALUES (:organization_id, :team_id, :user_id)
            """),
                {"organization_id": organization_id, "team_id": team_id, "user_id": user_id},
            )

    async def set_team_workspace_grant(
        self,
        organization_id: UUID,
        team_id: UUID,
        grant: WorkspaceGrant | None,
        workspace_id: UUID,
    ) -> None:
        await self.session.execute(
            text("""
            DELETE FROM team_workspace_grants
             WHERE organization_id = :organization_id AND team_id = :team_id
               AND workspace_id = :workspace_id
        """),
            {"organization_id": organization_id, "team_id": team_id, "workspace_id": workspace_id},
        )
        if grant:
            await self.session.execute(
                text("""
                INSERT INTO team_workspace_grants
                    (organization_id, team_id, workspace_id, role_id)
                VALUES (:organization_id, :team_id, :workspace_id, :role_id)
            """),
                {
                    "organization_id": organization_id,
                    "team_id": team_id,
                    "workspace_id": workspace_id,
                    "role_id": grant.role_id,
                },
            )

    async def create_invitation(
        self,
        *,
        invitation_id: UUID,
        organization_id: UUID,
        email: str,
        role_id: UUID,
        invited_by: UUID,
        grants: tuple[WorkspaceGrant, ...],
        digest: bytes,
        expires_at: datetime,
    ) -> None:
        await self.session.execute(
            text("""
            INSERT INTO organization_invitations
                (id, organization_id, email, role_id, invited_by, token_digest,
                 expires_at, workspace_grants)
            VALUES (:id, :organization_id, :email, :role_id, :invited_by, :digest,
                    :expires_at, CAST(:grants AS jsonb))
        """),
            {
                "id": invitation_id,
                "organization_id": organization_id,
                "email": email,
                "role_id": role_id,
                "invited_by": invited_by,
                "digest": digest,
                "expires_at": expires_at,
                "grants": json.dumps(
                    [
                        {"workspace_id": str(item.workspace_id), "role_id": str(item.role_id)}
                        for item in grants
                    ]
                ),
            },
        )

    async def replace_invitation_token(
        self, invitation_id: UUID, *, digest: bytes, expires_at: datetime
    ) -> None:
        await self.session.execute(
            text("""
            UPDATE organization_invitations SET token_digest = :digest,
                   expires_at = :expires_at, updated_at = now()
             WHERE id = :id AND accepted_at IS NULL AND cancelled_at IS NULL
        """),
            {"id": invitation_id, "digest": digest, "expires_at": expires_at},
        )

    async def cancel_invitation(self, invitation_id: UUID, cancelled_at: datetime) -> None:
        await self.session.execute(
            text("""
            UPDATE organization_invitations SET cancelled_at = :at, updated_at = now()
             WHERE id = :id AND accepted_at IS NULL AND cancelled_at IS NULL
        """),
            {"id": invitation_id, "at": cancelled_at},
        )

    async def accept_invitation(
        self, invitation_id: UUID, *, user_id: UUID, accepted_at: datetime
    ) -> None:
        invitation = (
            await self.session.execute(
                text("""
            UPDATE organization_invitations SET accepted_at = :at, updated_at = now()
             WHERE id = :id AND accepted_at IS NULL AND cancelled_at IS NULL
            RETURNING organization_id, role_id, workspace_grants
        """),
                {"id": invitation_id, "at": accepted_at},
            )
        ).one()
        await self.session.execute(
            text("""
            INSERT INTO organization_memberships
                (id, organization_id, user_id, role_id, status)
            VALUES (gen_random_uuid(), :organization_id, :user_id, :role_id, 'active')
            ON CONFLICT (organization_id, user_id) DO UPDATE
                SET role_id = excluded.role_id, status = 'active', updated_at = now()
        """),
            {
                "organization_id": invitation.organization_id,
                "user_id": user_id,
                "role_id": invitation.role_id,
            },
        )
        for grant in invitation.workspace_grants or []:
            await self.set_workspace_member(
                invitation.organization_id,
                UUID(grant["workspace_id"]),
                user_id,
                UUID(grant["role_id"]),
            )

    async def append_audit(
        self,
        *,
        organization_id: UUID,
        actor_user_id: UUID,
        action: str,
        target_type: str,
        target_id: str,
        occurred_at: datetime,
        metadata: dict[str, object],
    ) -> None:
        await self.session.execute(
            text("""
            INSERT INTO audit_events
                (id, occurred_at, actor_user_id, organization_id, action, target_type,
                 target_id, outcome, source, event_metadata)
            VALUES (gen_random_uuid(), :occurred_at, :actor_user_id, :organization_id,
                    :action, :target_type, :target_id, 'success', 'http',
                    CAST(:metadata AS jsonb))
        """),
            {
                "occurred_at": occurred_at,
                "actor_user_id": actor_user_id,
                "organization_id": organization_id,
                "action": action,
                "target_type": target_type,
                "target_id": target_id,
                "metadata": json.dumps(metadata),
            },
        )

    async def commit(self) -> None:
        try:
            await self.session.commit()
        except IntegrityError as exc:
            raise ConflictError(*self._conflict) from exc

    async def rollback(self) -> None:
        await self.session.rollback()
