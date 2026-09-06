"""Organization management with scoped, transactional authorization and audit."""

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.errors import ApplicationError, ConflictError, NotFoundError, PermissionDeniedError
from app.core.config import settings
from app.modules.audit.models import AuditEvent
from app.modules.auth.authorization import (
    AuthorizationRepository,
    AuthorizationScope,
    AuthorizationService,
)
from app.modules.auth.crypto import new_opaque_token, token_digest
from app.modules.auth.service import Principal
from app.modules.identity.models import User, UserStatus
from app.modules.organization.models import (
    MembershipStatus,
    Organization,
    OrganizationInvitation,
    OrganizationMembership,
    OrganizationTeam,
    Role,
    RolePermission,
    RoleScope,
    TeamMembership,
    TeamWorkspaceGrant,
)
from app.modules.organization.permissions import (
    CATALOG,
    ORGANIZATION_PERMISSIONS,
    WORKSPACE_PERMISSIONS,
    validate_permissions,
)
from app.modules.organization.schemas import InvitationCreate, MemberUpdate, RoleWrite, TeamWrite
from app.modules.organization.system_roles import (
    ORGANIZATION_ADMIN_ROLE_ID,
    ORGANIZATION_OWNER_ROLE_ID,
    WORKSPACE_OWNER_ROLE_ID,
)
from app.modules.workspace.models import Workspace, WorkspaceMembership, WorkspaceStatus


class OrganizationService:
    def __init__(self, session: AsyncSession, principal: Principal, organization_id: UUID):
        self.session = session
        self.principal = principal
        self.organization_id = organization_id
        self.repository = AuthorizationRepository(session)

    async def require(self, key: str, workspace_id: UUID | None = None):
        return await AuthorizationService(self.repository).authorize(
            self.principal, AuthorizationScope(self.organization_id, workspace_id), key
        )

    async def lock(self) -> Organization:
        await self.repository.establish_scope(
            self.principal, AuthorizationScope(self.organization_id)
        )
        organization = await self.session.scalar(
            select(Organization)
            .where(Organization.id == self.organization_id, Organization.deleted_at.is_(None))
            .with_for_update()
        )
        if organization is None:
            raise NotFoundError("organization_not_found", "조직을 찾을 수 없습니다.")
        return organization

    def audit(self, action: str, target_id: UUID, metadata: dict | None = None):
        self.session.add(
            AuditEvent(
                occurred_at=datetime.now(UTC),
                actor_user_id=self.principal.user_id,
                organization_id=self.organization_id,
                action=action,
                target_type=action.split(".")[0],
                target_id=str(target_id),
                outcome="success",
                source="http",
                event_metadata=metadata or {},
            )
        )

    async def owner(self) -> bool:
        if self.principal.is_platform_admin:
            return True
        return bool(
            await self.session.scalar(
                select(OrganizationMembership.id).where(
                    OrganizationMembership.organization_id == self.organization_id,
                    OrganizationMembership.user_id == self.principal.user_id,
                    OrganizationMembership.status == MembershipStatus.ACTIVE,
                    OrganizationMembership.role_id == ORGANIZATION_OWNER_ROLE_ID,
                )
            )
        )

    async def member(self, user_id: UUID, *, active: bool = False) -> OrganizationMembership:
        member = await self.session.scalar(
            select(OrganizationMembership).where(
                OrganizationMembership.organization_id == self.organization_id,
                OrganizationMembership.user_id == user_id,
            )
        )
        if member is None or (active and member.status != MembershipStatus.ACTIVE):
            raise NotFoundError(
                "organization_member_not_found", "활성 조직 구성원을 찾을 수 없습니다."
            )
        return member

    async def workspace(self, workspace_id: UUID) -> Workspace:
        workspace = await self.session.scalar(
            select(Workspace).where(
                Workspace.id == workspace_id,
                Workspace.organization_id == self.organization_id,
                Workspace.deleted_at.is_(None),
                Workspace.status == WorkspaceStatus.ACTIVE,
            )
        )
        if workspace is None:
            raise NotFoundError("workspace_not_found", "작업공간을 찾을 수 없습니다.")
        return workspace

    async def role(self, role_id: UUID, scope: RoleScope) -> Role:
        role = await self.session.scalar(
            select(Role).where(
                Role.id == role_id,
                Role.scope == scope,
                or_(Role.organization_id == self.organization_id, Role.organization_id.is_(None)),
            )
        )
        if role is None:
            raise ApplicationError("invalid_role", "조직과 적용 범위에 맞는 역할을 선택하세요.")
        return role

    async def role_keys(self, role_id: UUID) -> set[str]:
        return (
            set(
                await self.session.scalars(
                    select(RolePermission.permission_key).where(RolePermission.role_id == role_id)
                )
            )
            & CATALOG.keys()
        )

    async def delegate(self, role_id: UUID, scope: RoleScope, workspace_id: UUID | None = None):
        role = await self.role(role_id, scope)
        if await self.owner():
            return role
        if role_id in {ORGANIZATION_OWNER_ROLE_ID, WORKSPACE_OWNER_ROLE_ID}:
            raise PermissionDeniedError(
                "owner_assignment_required", "소유자 역할은 조직 소유자만 부여할 수 있습니다."
            )
        keys = await self.role_keys(role_id)
        own = await self.repository.permission_keys(
            self.principal, AuthorizationScope(self.organization_id, workspace_id)
        )
        if not keys <= own:
            raise PermissionDeniedError(
                "delegation_exceeds_permissions", "보유한 권한 범위에서만 위임할 수 있습니다."
            )
        return role

    async def overview(self):
        context = await self.require("organization.read")
        org = await self.session.get(Organization, self.organization_id)
        if org is None or org.deleted_at:
            raise NotFoundError("organization_not_found", "조직을 찾을 수 없습니다.")
        return {
            "id": org.id,
            "name": org.name,
            "slug": org.slug,
            "is_personal": org.is_personal,
            "revision": org.revision,
            "permissions": sorted(context.permissions),
            "is_owner": await self.owner(),
        }

    async def update(self, name: str, revision: int):
        org = await self.lock()
        await self.require("organization.update")
        if org.revision != revision:
            raise ConflictError(
                "organization_revision_conflict", "조직 정보가 변경되었습니다. 다시 불러오세요."
            )
        org.name, org.revision = name, org.revision + 1
        self.audit("organization.update", org.id)

    async def delete_organization(self):
        organization = await self.lock()
        await self.require("organization.delete")
        if not await self.owner():
            raise PermissionDeniedError("organization_owner_required")
        if organization.is_personal:
            raise ConflictError("personal_organization_required", "개인 조직은 삭제할 수 없습니다.")
        organization.deleted_at = datetime.now(UTC)
        organization.revision += 1
        self.audit("organization.delete", organization.id)

    async def members(self, search: str = "", status: MembershipStatus | None = None):
        await self.require("member.read")
        statement = (
            select(OrganizationMembership, User, Role.name)
            .join(User, User.id == OrganizationMembership.user_id)
            .join(Role, Role.id == OrganizationMembership.role_id)
            .where(
                OrganizationMembership.organization_id == self.organization_id,
                User.deleted_at.is_(None),
            )
        )
        if search:
            pattern = f"%{search.replace('%', '').replace('_', '')}%"
            statement = statement.where(
                or_(User.email.ilike(pattern), User.display_name.ilike(pattern))
            )
        if status:
            statement = statement.where(OrganizationMembership.status == status)
        rows = await self.session.execute(statement.order_by(User.display_name, User.id))
        return [
            {
                "user_id": u.id,
                "email": u.email,
                "name": u.display_name,
                "role_id": m.role_id,
                "role_name": role,
                "status": m.status,
                "joined_at": m.created_at,
            }
            for m, u, role in rows
        ]

    async def update_member(self, user_id: UUID, payload: MemberUpdate):
        await self.lock()
        member = await self.member(user_id)
        await self.delegate(member.role_id, RoleScope.ORGANIZATION)
        if payload.role_id is not None:
            await self.require("member.update_role")
            await self.require("role.assign")
            await self.delegate(payload.role_id, RoleScope.ORGANIZATION)
        if payload.status is not None:
            await self.require(
                "member.remove" if payload.status == MembershipStatus.REMOVED else "member.suspend"
            )
        if member.role_id == ORGANIZATION_OWNER_ROLE_ID:
            if not await self.owner():
                raise PermissionDeniedError("owner_management_required")
            loses_ownership = (
                payload.role_id is not None and payload.role_id != member.role_id
            ) or payload.status in {MembershipStatus.SUSPENDED, MembershipStatus.REMOVED}
            if loses_ownership and member.status == MembershipStatus.ACTIVE:
                owners = await self.session.scalar(
                    select(func.count())
                    .select_from(OrganizationMembership)
                    .where(
                        OrganizationMembership.organization_id == self.organization_id,
                        OrganizationMembership.role_id == ORGANIZATION_OWNER_ROLE_ID,
                        OrganizationMembership.status == MembershipStatus.ACTIVE,
                    )
                )
                if (owners or 0) <= 1:
                    raise ConflictError(
                        "last_organization_owner",
                        "마지막 조직 소유자는 변경하거나 제거할 수 없습니다.",
                    )
        if member.status == MembershipStatus.REMOVED and payload.status not in {
            None,
            MembershipStatus.REMOVED,
        }:
            raise ConflictError("member_reinvite_required", "제거된 구성원은 다시 초대해야 합니다.")
        if member.status == MembershipStatus.ACTIVE and payload.status in {
            MembershipStatus.SUSPENDED,
            MembershipStatus.REMOVED,
        }:
            owned = await self.session.scalars(
                select(WorkspaceMembership.workspace_id)
                .join(Workspace, Workspace.id == WorkspaceMembership.workspace_id)
                .where(
                    Workspace.organization_id == self.organization_id,
                    Workspace.deleted_at.is_(None),
                    Workspace.status == WorkspaceStatus.ACTIVE,
                    WorkspaceMembership.user_id == user_id,
                    WorkspaceMembership.role_id == WORKSPACE_OWNER_ROLE_ID,
                )
            )
            for workspace_id in owned:
                count = await self.session.scalar(
                    select(func.count())
                    .select_from(WorkspaceMembership)
                    .join(
                        OrganizationMembership,
                        OrganizationMembership.user_id == WorkspaceMembership.user_id,
                    )
                    .where(
                        WorkspaceMembership.workspace_id == workspace_id,
                        WorkspaceMembership.role_id == WORKSPACE_OWNER_ROLE_ID,
                        OrganizationMembership.organization_id == self.organization_id,
                        OrganizationMembership.status == MembershipStatus.ACTIVE,
                    )
                )
                if (count or 0) <= 1:
                    raise ConflictError(
                        "last_workspace_owner",
                        "먼저 해당 구성원의 작업공간 소유권을 다른 활성 구성원에게 배정하세요.",
                    )
        before = {"role_id": str(member.role_id), "status": member.status}
        if payload.role_id is not None:
            member.role_id = payload.role_id
        if payload.status is not None:
            member.status = payload.status
        if payload.status == MembershipStatus.REMOVED:
            await self.session.execute(
                delete(TeamMembership).where(
                    TeamMembership.organization_id == self.organization_id,
                    TeamMembership.user_id == user_id,
                )
            )
            await self.session.execute(
                delete(WorkspaceMembership).where(
                    WorkspaceMembership.user_id == user_id,
                    WorkspaceMembership.workspace_id.in_(
                        select(Workspace.id).where(
                            Workspace.organization_id == self.organization_id
                        )
                    ),
                )
            )
        self.audit(
            "member.update",
            user_id,
            {"before": before, "after": {"role_id": str(member.role_id), "status": member.status}},
        )

    async def transfer(self, user_id: UUID):
        await self.lock()
        await self.require("organization.transfer")
        if not await self.owner():
            raise PermissionDeniedError("organization_owner_required")
        if user_id == self.principal.user_id:
            raise ApplicationError("different_owner_required", "다른 활성 구성원을 선택하세요.")
        target = await self.member(user_id, active=True)
        target.role_id = ORGANIZATION_OWNER_ROLE_ID
        if not self.principal.is_platform_admin:
            previous = await self.member(self.principal.user_id, active=True)
            previous.role_id = ORGANIZATION_ADMIN_ROLE_ID
        self.audit("organization.transfer", user_id)

    async def roles(self):
        await self.require("role.read")
        records = await self.session.scalars(
            select(Role)
            .where(
                Role.scope.in_([RoleScope.ORGANIZATION, RoleScope.WORKSPACE]),
                or_(Role.organization_id.is_(None), Role.organization_id == self.organization_id),
            )
            .order_by(Role.scope, Role.name)
        )
        return [
            {
                "id": r.id,
                "name": r.name,
                "scope": r.scope,
                "is_system": r.is_system,
                "permissions": sorted(
                    (await self.role_keys(r.id))
                    & (
                        ORGANIZATION_PERMISSIONS
                        if r.scope == RoleScope.ORGANIZATION
                        else WORKSPACE_PERMISSIONS
                    )
                ),
            }
            for r in records
        ]

    async def write_role(self, payload: RoleWrite, role_id: UUID | None = None):
        await self.lock()
        await self.require("role.update" if role_id else "role.create")
        keys = validate_permissions(payload.scope, payload.permissions)
        if not await self.owner():
            # Workspace roles may affect multiple spaces, so only owners edit their definitions.
            own = await self.repository.permission_keys(
                self.principal, AuthorizationScope(self.organization_id)
            )
            if payload.scope == "workspace" or not keys <= own:
                raise PermissionDeniedError("delegation_exceeds_permissions")
        if role_id:
            role = await self.role(role_id, RoleScope(payload.scope))
            if role.is_system or role.organization_id != self.organization_id:
                raise PermissionDeniedError("system_role_immutable")
            await self.delegate(role.id, RoleScope(payload.scope))
            await self.session.execute(
                delete(RolePermission).where(RolePermission.role_id == role.id)
            )
            role.name = payload.name
        else:
            role = Role(
                id=uuid4(),
                organization_id=self.organization_id,
                scope=RoleScope(payload.scope),
                name=payload.name,
                is_system=False,
            )
            self.session.add(role)
            await self.session.flush()
        for key in keys:
            self.session.add(RolePermission(role_id=role.id, permission_key=key))
        self.audit(
            "role.update" if role_id else "role.create", role.id, {"permissions": sorted(keys)}
        )
        return role.id

    async def delete_role(self, role_id: UUID):
        await self.lock()
        await self.require("role.delete")
        role = await self.session.scalar(
            select(Role).where(Role.id == role_id, Role.organization_id == self.organization_id)
        )
        if not role or role.is_system:
            raise PermissionDeniedError("system_role_immutable")
        await self.delegate(role.id, role.scope)
        for model in (
            OrganizationMembership,
            WorkspaceMembership,
            TeamWorkspaceGrant,
        ):
            if await self.session.scalar(
                select(model.role_id).where(model.role_id == role_id).limit(1)
            ):
                raise ConflictError("role_in_use", "사용 중인 역할은 삭제할 수 없습니다.")
        invitations = await self.session.scalars(
            select(OrganizationInvitation).where(
                OrganizationInvitation.organization_id == self.organization_id,
                OrganizationInvitation.accepted_at.is_(None),
                OrganizationInvitation.cancelled_at.is_(None),
            )
        )
        for invitation in invitations:
            if invitation.role_id == role_id or any(
                g["role_id"] == str(role_id) for g in invitation.workspace_grants
            ):
                raise ConflictError(
                    "role_in_use", "수락 대기 또는 재전송 가능한 초대에서 사용 중인 역할입니다."
                )
        await self.session.execute(delete(RolePermission).where(RolePermission.role_id == role_id))
        await self.session.delete(role)
        self.audit("role.delete", role_id)

    async def set_workspace_member(self, workspace_id: UUID, user_id: UUID, role_id: UUID | None):
        await self.lock()
        await self.workspace(workspace_id)
        if not await self.owner():
            await self.require("workspace.manage_members", workspace_id)
        target_member = await self.member(user_id, active=role_id is not None)
        existing = await self.session.scalar(
            select(WorkspaceMembership).where(
                WorkspaceMembership.workspace_id == workspace_id,
                WorkspaceMembership.user_id == user_id,
            )
        )
        if existing:
            await self.delegate(existing.role_id, RoleScope.WORKSPACE, workspace_id)
        if role_id:
            await self.delegate(role_id, RoleScope.WORKSPACE, workspace_id)
        if (
            existing
            and existing.role_id == WORKSPACE_OWNER_ROLE_ID
            and role_id != existing.role_id
            and target_member.status == MembershipStatus.ACTIVE
        ):
            if not await self.owner():
                raise PermissionDeniedError("owner_management_required")
            count = await self.session.scalar(
                select(func.count())
                .select_from(WorkspaceMembership)
                .join(
                    OrganizationMembership,
                    OrganizationMembership.user_id == WorkspaceMembership.user_id,
                )
                .where(
                    WorkspaceMembership.workspace_id == workspace_id,
                    WorkspaceMembership.role_id == WORKSPACE_OWNER_ROLE_ID,
                    OrganizationMembership.organization_id == self.organization_id,
                    OrganizationMembership.status == MembershipStatus.ACTIVE,
                )
            )
            if (count or 0) <= 1:
                raise ConflictError(
                    "last_workspace_owner", "마지막 작업공간 소유자는 제거할 수 없습니다."
                )
        if role_id:
            if existing:
                existing.role_id = role_id
            else:
                self.session.add(
                    WorkspaceMembership(workspace_id=workspace_id, user_id=user_id, role_id=role_id)
                )
        elif existing:
            await self.session.delete(existing)
        self.audit(
            "workspace.member.update",
            user_id,
            {"workspace_id": str(workspace_id), "role_id": str(role_id) if role_id else None},
        )

    async def detail(self, user_id: UUID):
        await self.require("member.read")
        member = await self.member(user_id)
        user = await self.session.get(User, user_id)
        target = Principal(user.id, user.email, user.display_name, False)
        teams = await self.session.scalars(
            select(OrganizationTeam)
            .join(TeamMembership, TeamMembership.team_id == OrganizationTeam.id)
            .where(
                OrganizationTeam.organization_id == self.organization_id,
                TeamMembership.user_id == user_id,
            )
        )
        workspaces = await self.session.scalars(
            select(Workspace).where(
                Workspace.organization_id == self.organization_id,
                Workspace.deleted_at.is_(None),
                Workspace.status == WorkspaceStatus.ACTIVE,
            )
        )
        scopes = []
        for workspace in workspaces:
            sources = await self.repository.permission_sources(
                target, AuthorizationScope(self.organization_id, workspace.id)
            )
            if sources:
                scopes.append(
                    {
                        "workspace_id": workspace.id,
                        "name": workspace.name,
                        "sources": sources,
                        "permissions": sorted(
                            {key for s in sources for key in s["permissions"] if key in CATALOG}
                        ),
                    }
                )
        return {
            "user_id": user_id,
            "name": user.display_name,
            "email": user.email,
            "role_id": member.role_id,
            "status": member.status,
            "teams": [{"id": t.id, "name": t.name} for t in teams],
            "workspaces": scopes,
            "organization_sources": await self.repository.permission_sources(
                target, AuthorizationScope(self.organization_id)
            ),
        }

    async def teams(self):
        await self.require("team.read")
        teams = await self.session.scalars(
            select(OrganizationTeam)
            .where(OrganizationTeam.organization_id == self.organization_id)
            .order_by(OrganizationTeam.name)
        )
        result = []
        for team in teams:
            members = await self.session.scalars(
                select(TeamMembership.user_id).where(
                    TeamMembership.team_id == team.id,
                    TeamMembership.organization_id == self.organization_id,
                )
            )
            grants = await self.session.scalars(
                select(TeamWorkspaceGrant).where(
                    TeamWorkspaceGrant.team_id == team.id,
                    TeamWorkspaceGrant.organization_id == self.organization_id,
                )
            )
            result.append(
                {
                    "id": team.id,
                    "name": team.name,
                    "description": team.description,
                    "members": list(members),
                    "workspaces": [
                        {"workspace_id": g.workspace_id, "role_id": g.role_id} for g in grants
                    ],
                }
            )
        return result

    async def team(self, team_id: UUID):
        team = await self.session.scalar(
            select(OrganizationTeam).where(
                OrganizationTeam.id == team_id,
                OrganizationTeam.organization_id == self.organization_id,
            )
        )
        if team is None:
            raise NotFoundError("team_not_found", "팀을 찾을 수 없습니다.")
        return team

    async def check_team_delegation(self, team_id: UUID):
        grants = await self.session.scalars(
            select(TeamWorkspaceGrant).where(
                TeamWorkspaceGrant.team_id == team_id,
                TeamWorkspaceGrant.organization_id == self.organization_id,
            )
        )
        for grant in grants:
            await self.delegate(grant.role_id, RoleScope.WORKSPACE, grant.workspace_id)

    async def write_team(self, payload: TeamWrite, team_id: UUID | None = None):
        await self.lock()
        await self.require("team.update" if team_id else "team.create")
        team = (
            await self.team(team_id)
            if team_id
            else OrganizationTeam(id=uuid4(), organization_id=self.organization_id)
        )
        team.name, team.description = payload.name, payload.description
        self.session.add(team)
        self.audit("team.update" if team_id else "team.create", team.id)
        return team.id

    async def delete_team(self, team_id: UUID):
        await self.lock()
        await self.require("team.delete")
        team = await self.team(team_id)
        await self.check_team_delegation(team_id)
        await self.session.delete(team)
        self.audit("team.delete", team_id)

    async def set_team_member(self, team_id: UUID, user_id: UUID, *, remove: bool = False):
        await self.lock()
        await self.require("team.manage_members")
        await self.team(team_id)
        await self.member(user_id, active=not remove)
        await self.check_team_delegation(team_id)
        row = await self.session.get(TeamMembership, (team_id, user_id))
        if remove and row:
            await self.session.delete(row)
        elif not remove and row is None:
            self.session.add(
                TeamMembership(
                    organization_id=self.organization_id, team_id=team_id, user_id=user_id
                )
            )
        self.audit(
            "team.member.remove" if remove else "team.member.add",
            team_id,
            {"user_id": str(user_id)},
        )

    async def set_team_workspace(self, team_id: UUID, workspace_id: UUID, role_id: UUID | None):
        await self.lock()
        await self.require("team.update")
        await self.team(team_id)
        await self.workspace(workspace_id)
        if not await self.owner():
            await self.require("workspace.manage_members", workspace_id)
        row = await self.session.get(TeamWorkspaceGrant, (team_id, workspace_id))
        if row:
            await self.delegate(row.role_id, RoleScope.WORKSPACE, workspace_id)
        if role_id:
            if role_id == WORKSPACE_OWNER_ROLE_ID:
                raise ApplicationError(
                    "direct_owner_required", "작업공간 소유자는 개인에게 직접 지정하세요."
                )
            await self.delegate(role_id, RoleScope.WORKSPACE, workspace_id)
            if row:
                row.role_id = role_id
            else:
                self.session.add(
                    TeamWorkspaceGrant(
                        organization_id=self.organization_id,
                        team_id=team_id,
                        workspace_id=workspace_id,
                        role_id=role_id,
                    )
                )
        elif row:
            await self.session.delete(row)
        self.audit(
            "team.workspace.update",
            team_id,
            {"workspace_id": str(workspace_id), "role_id": str(role_id) if role_id else None},
        )

    def digest(self, token: str) -> bytes:
        return token_digest(token, settings.auth_token_secret.get_secret_value())

    async def invitations(self):
        await self.require("member.invite")
        rows = await self.session.scalars(
            select(OrganizationInvitation)
            .where(OrganizationInvitation.organization_id == self.organization_id)
            .order_by(OrganizationInvitation.created_at.desc())
        )
        now = datetime.now(UTC)
        return [
            {
                "id": i.id,
                "email": i.email,
                "role_id": i.role_id,
                "workspace_grants": i.workspace_grants,
                "expires_at": i.expires_at,
                "status": "accepted"
                if i.accepted_at
                else "cancelled"
                if i.cancelled_at
                else "expired"
                if i.expires_at <= now
                else "pending",
            }
            for i in rows
        ]

    async def validate_invitation_grants(self, role_id: UUID, grants: list[dict]):
        await self.require("member.invite")
        await self.require("role.assign")
        await self.delegate(role_id, RoleScope.ORGANIZATION)
        seen = set()
        for grant in grants:
            workspace_id, workspace_role = UUID(grant["workspace_id"]), UUID(grant["role_id"])
            if workspace_id in seen:
                raise ApplicationError(
                    "duplicate_workspace_grant", "작업공간은 한 번만 선택하세요."
                )
            seen.add(workspace_id)
            await self.workspace(workspace_id)
            if not await self.owner():
                await self.require("workspace.manage_members", workspace_id)
            await self.delegate(workspace_role, RoleScope.WORKSPACE, workspace_id)

    async def invite(self, payload: InvitationCreate, invitation_id: UUID | None = None):
        organization = await self.lock()
        if organization.is_personal:
            raise ApplicationError(
                "personal_organization_invitation", "공동 작업을 위한 조직을 먼저 만드세요."
            )
        grants = [g.model_dump(mode="json") for g in payload.workspace_grants]
        await self.validate_invitation_grants(payload.role_id, grants)
        existing = await self.session.scalar(
            select(OrganizationMembership)
            .join(User, User.id == OrganizationMembership.user_id)
            .where(
                OrganizationMembership.organization_id == self.organization_id,
                func.lower(User.email) == payload.email,
                OrganizationMembership.status != MembershipStatus.REMOVED,
            )
        )
        if existing:
            raise ConflictError(
                "organization_member_exists",
                "이미 소속된 구성원입니다. 정지 상태는 구성원 화면에서 복구하세요.",
            )
        now = datetime.now(UTC)
        if invitation_id:
            invitation = await self.session.scalar(
                select(OrganizationInvitation).where(
                    OrganizationInvitation.id == invitation_id,
                    OrganizationInvitation.organization_id == self.organization_id,
                )
            )
            if not invitation or invitation.accepted_at or invitation.cancelled_at:
                raise ConflictError("invitation_closed", "재전송할 수 없는 초대입니다.")
        else:
            pending = await self.session.scalar(
                select(OrganizationInvitation.id).where(
                    OrganizationInvitation.organization_id == self.organization_id,
                    OrganizationInvitation.email == payload.email,
                    OrganizationInvitation.accepted_at.is_(None),
                    OrganizationInvitation.cancelled_at.is_(None),
                    OrganizationInvitation.expires_at > now,
                )
            )
            if pending:
                raise ConflictError(
                    "invitation_pending", "대기 중인 초대가 있습니다. 재전송을 이용하세요."
                )
            invitation = OrganizationInvitation(id=uuid4(), organization_id=self.organization_id)
        token = new_opaque_token()
        invitation.email, invitation.role_id = payload.email, payload.role_id
        invitation.invited_by, invitation.token_digest = self.principal.user_id, self.digest(token)
        invitation.expires_at, invitation.workspace_grants = now + timedelta(days=7), grants
        self.session.add(invitation)
        self.audit(
            "member.invitation.resend" if invitation_id else "member.invitation.create",
            invitation.id,
            {"email": payload.email, "role_id": str(payload.role_id), "workspace_grants": grants},
        )
        return invitation, token

    async def cancel_invitation(self, invitation_id: UUID):
        await self.lock()
        await self.require("member.cancel_invite")
        invitation = await self.session.scalar(
            select(OrganizationInvitation).where(
                OrganizationInvitation.id == invitation_id,
                OrganizationInvitation.organization_id == self.organization_id,
            )
        )
        if not invitation or invitation.accepted_at:
            raise ConflictError("invitation_closed", "취소할 수 없는 초대입니다.")
        invitation.cancelled_at = datetime.now(UTC)
        self.audit("member.invitation.cancel", invitation.id)

    async def accept_invitation(self, token: str):
        await self.lock()
        invitation = await self.session.scalar(
            select(OrganizationInvitation)
            .where(
                OrganizationInvitation.organization_id == self.organization_id,
                OrganizationInvitation.token_digest == self.digest(token),
            )
            .with_for_update()
        )
        now = datetime.now(UTC)
        if (
            not invitation
            or invitation.cancelled_at
            or invitation.accepted_at
            or invitation.expires_at <= now
            or invitation.role_id is None
        ):
            raise ConflictError("invalid_invitation", "초대가 만료되었거나 사용할 수 없습니다.")
        if invitation.email != self.principal.email.casefold():
            raise PermissionDeniedError(
                "invitation_email_mismatch", "초대받은 이메일 계정으로 로그인하세요."
            )
        # Recheck the inviter's current authority and the current role definitions.
        inviter_user = await self.session.get(User, invitation.invited_by)
        if not inviter_user or inviter_user.status != UserStatus.ACTIVE or inviter_user.deleted_at:
            raise PermissionDeniedError("inviter_inactive")
        inviter = OrganizationService(
            self.session,
            Principal(
                inviter_user.id,
                inviter_user.email,
                inviter_user.display_name,
                inviter_user.is_platform_admin,
            ),
            self.organization_id,
        )
        await inviter.validate_invitation_grants(invitation.role_id, invitation.workspace_grants)
        await self.repository.establish_scope(
            self.principal, AuthorizationScope(self.organization_id)
        )
        membership = await self.session.scalar(
            select(OrganizationMembership).where(
                OrganizationMembership.organization_id == self.organization_id,
                OrganizationMembership.user_id == self.principal.user_id,
            )
        )
        if membership and membership.status != MembershipStatus.REMOVED:
            raise ConflictError("organization_member_exists", "이미 조직에 소속되어 있습니다.")
        if membership:
            membership.role_id, membership.status = invitation.role_id, MembershipStatus.ACTIVE
        else:
            self.session.add(
                OrganizationMembership(
                    organization_id=self.organization_id,
                    user_id=self.principal.user_id,
                    role_id=invitation.role_id,
                )
            )
        for grant in invitation.workspace_grants:
            workspace_id = UUID(grant["workspace_id"])
            # Removed members' old direct grants are cleaned up on removal.
            existing = await self.session.scalar(
                select(WorkspaceMembership).where(
                    WorkspaceMembership.workspace_id == workspace_id,
                    WorkspaceMembership.user_id == self.principal.user_id,
                )
            )
            if existing:
                existing.role_id = UUID(grant["role_id"])
            else:
                self.session.add(
                    WorkspaceMembership(
                        workspace_id=workspace_id,
                        user_id=self.principal.user_id,
                        role_id=UUID(grant["role_id"]),
                    )
                )
        invitation.accepted_at = now
        self.audit("member.invitation.accept", invitation.id)

    async def workspace_options(self):
        await self.require("member.read")
        rows = await self.session.scalars(
            select(Workspace)
            .where(
                Workspace.organization_id == self.organization_id,
                Workspace.deleted_at.is_(None),
                Workspace.status == WorkspaceStatus.ACTIVE,
            )
            .order_by(Workspace.name)
        )
        result = []
        owner = await self.owner()
        for workspace in rows:
            permissions = await self.repository.permission_keys(
                self.principal, AuthorizationScope(self.organization_id, workspace.id)
            )
            if owner or "workspace.manage_members" in permissions:
                result.append(
                    {"id": workspace.id, "name": workspace.name, "permissions": sorted(permissions)}
                )
        return result

    async def events(self):
        await self.require("organization.read")
        if not await self.owner():
            await self.require("member.update_role")
        rows = await self.session.scalars(
            select(AuditEvent)
            .where(
                AuditEvent.organization_id == self.organization_id,
                AuditEvent.workspace_id.is_(None),
            )
            .order_by(AuditEvent.occurred_at.desc())
            .limit(200)
        )
        return [
            {
                "id": e.id,
                "occurred_at": e.occurred_at,
                "actor_user_id": e.actor_user_id,
                "action": e.action,
                "target_id": e.target_id,
                "metadata": e.event_metadata,
            }
            for e in rows
        ]
