"""Workspace-scoped RBAC authorization."""

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.errors import ApplicationError, NotFoundError, PermissionDeniedError
from app.db.tenant import TenantContext, apply_tenant_context
from app.modules.auth.service import Principal
from app.modules.organization.models import (
    MembershipStatus,
    Organization,
    OrganizationMembership,
    OrganizationTeam,
    Permission,
    Role,
    RolePermission,
    RoleScope,
    TeamMembership,
    TeamWorkspaceGrant,
)
from app.modules.organization.permissions import ORGANIZATION_PERMISSIONS, WORKSPACE_PERMISSIONS
from app.modules.workspace.models import Workspace, WorkspaceMembership, WorkspaceStatus


@dataclass(frozen=True, slots=True)
class AuthorizationScope:
    organization_id: UUID
    workspace_id: UUID | None = None


@dataclass(frozen=True, slots=True)
class AuthorizedContext:
    principal: Principal
    scope: AuthorizationScope
    permissions: frozenset[str]


class AuthorizationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def establish_scope(self, principal: Principal, scope: AuthorizationScope) -> None:
        await apply_tenant_context(
            self.session,
            TenantContext(
                user_id=principal.user_id,
                organization_id=scope.organization_id,
                workspace_id=scope.workspace_id,
                is_platform_admin=principal.is_platform_admin,
            ),
        )
        if scope.workspace_id is not None:
            workspace_id = await self.session.scalar(
                select(Workspace.id).where(
                    Workspace.id == scope.workspace_id,
                    Workspace.organization_id == scope.organization_id,
                    Workspace.deleted_at.is_(None),
                    Workspace.status == WorkspaceStatus.ACTIVE,
                )
            )
            if workspace_id is None:
                raise NotFoundError("workspace_not_found", "Workspace not found")

    async def permission_sources(
        self, principal: Principal, scope: AuthorizationScope
    ) -> list[dict]:
        """Return only active, same-tenant grants with their visible origin."""
        membership = await self.session.scalar(
            select(OrganizationMembership)
            .join(Organization)
            .where(
                OrganizationMembership.organization_id == scope.organization_id,
                OrganizationMembership.user_id == principal.user_id,
                OrganizationMembership.status == MembershipStatus.ACTIVE,
                Organization.deleted_at.is_(None),
            )
        )
        if membership is None:
            return []
        sources = []
        if scope.workspace_id is None:
            sources.append({"source": "organization", "role_id": membership.role_id})
        else:
            direct = await self.session.scalar(
                select(WorkspaceMembership.role_id).where(
                    WorkspaceMembership.workspace_id == scope.workspace_id,
                    WorkspaceMembership.user_id == principal.user_id,
                )
            )
            if direct:
                sources.append({"source": "direct", "role_id": direct})
            rows = await self.session.execute(
                select(TeamWorkspaceGrant.role_id, OrganizationTeam.id, OrganizationTeam.name)
                .join(OrganizationTeam, OrganizationTeam.id == TeamWorkspaceGrant.team_id)
                .join(TeamMembership, TeamMembership.team_id == OrganizationTeam.id)
                .where(
                    TeamWorkspaceGrant.organization_id == scope.organization_id,
                    TeamMembership.organization_id == scope.organization_id,
                    OrganizationTeam.organization_id == scope.organization_id,
                    TeamWorkspaceGrant.workspace_id == scope.workspace_id,
                    TeamMembership.user_id == principal.user_id,
                )
            )
            for role_id, team_id, name in rows:
                sources.append(
                    {"source": "team", "role_id": role_id, "team_id": team_id, "team_name": name}
                )
        expected_scope = RoleScope.WORKSPACE if scope.workspace_id else RoleScope.ORGANIZATION
        allowed = WORKSPACE_PERMISSIONS if scope.workspace_id else ORGANIZATION_PERMISSIONS
        valid = []
        for source in sources:
            role = await self.session.scalar(
                select(Role).where(
                    Role.id == source["role_id"],
                    Role.scope == expected_scope,
                    or_(
                        Role.organization_id.is_(None),
                        Role.organization_id == scope.organization_id,
                    ),
                )
            )
            if role is None:
                continue
            keys = await self.session.scalars(
                select(RolePermission.permission_key).where(RolePermission.role_id == role.id)
            )
            source.update(role_name=role.name, permissions=sorted(set(keys) & allowed))
            valid.append(source)
        return valid

    async def permission_keys(
        self, principal: Principal, scope: AuthorizationScope
    ) -> frozenset[str]:
        if principal.is_platform_admin:
            return frozenset(await self.session.scalars(select(Permission.key)))
        sources = await self.permission_sources(principal, scope)
        return frozenset(key for source in sources for key in source["permissions"])


class AuthorizationService:
    def __init__(self, repository: AuthorizationRepository) -> None:
        self.repository = repository

    async def authorize_any(
        self, principal: Principal, scope: AuthorizationScope, allowed: frozenset[str]
    ) -> AuthorizedContext:
        await self.repository.establish_scope(principal, scope)
        permissions = (await self.repository.permission_keys(principal, scope)) & allowed
        if not permissions:
            raise PermissionDeniedError("no_effective_token_permissions")
        return AuthorizedContext(principal, scope, permissions)

    async def authorize(
        self,
        principal: Principal,
        scope: AuthorizationScope,
        required_permission: str,
    ) -> AuthorizedContext:
        await self.repository.establish_scope(principal, scope)
        permissions = await self.repository.permission_keys(principal, scope)
        if required_permission not in permissions:
            raise PermissionDeniedError(
                "permission_required", f"Permission required: {required_permission}"
            )
        return AuthorizedContext(principal, scope, permissions)


def require_context(context: AuthorizedContext, *permissions: str) -> None:
    """Enforce operation permissions in domain services as well as HTTP adapters."""
    for permission in permissions:
        if permission not in context.permissions:
            raise PermissionDeniedError("permission_required", f"Permission required: {permission}")


def require_workspace_id(context: AuthorizedContext) -> UUID:
    """Return the authorized Workspace ID or reject an organization-only context."""

    if context.scope.workspace_id is None:
        raise ApplicationError("workspace_scope_required", "Workspace scope is required", 400)
    return context.scope.workspace_id
