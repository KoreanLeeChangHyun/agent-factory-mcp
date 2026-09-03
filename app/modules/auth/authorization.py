"""Workspace-scoped RBAC authorization."""

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.errors import NotFoundError, PermissionDeniedError
from app.db.tenant import TenantContext, apply_tenant_context
from app.modules.auth.service import Principal
from app.modules.organization.models import (
    OrganizationMembership,
    Permission,
    RolePermission,
)
from app.modules.workspace.models import Workspace, WorkspaceMembership


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
                )
            )
            if workspace_id is None:
                raise NotFoundError("workspace_not_found", "Workspace not found")

    async def permission_keys(
        self, principal: Principal, scope: AuthorizationScope
    ) -> frozenset[str]:
        if principal.is_platform_admin:
            result = await self.session.scalars(select(Permission.key))
            return frozenset(result)

        role_ids = list(
            await self.session.scalars(
                select(OrganizationMembership.role_id).where(
                    OrganizationMembership.organization_id == scope.organization_id,
                    OrganizationMembership.user_id == principal.user_id,
                )
            )
        )
        if scope.workspace_id is not None:
            role_ids.extend(
                await self.session.scalars(
                    select(WorkspaceMembership.role_id).where(
                        WorkspaceMembership.workspace_id == scope.workspace_id,
                        WorkspaceMembership.user_id == principal.user_id,
                    )
                )
            )
        if not role_ids:
            return frozenset()
        result = await self.session.scalars(
            select(RolePermission.permission_key).where(RolePermission.role_id.in_(role_ids))
        )
        return frozenset(result)


class AuthorizationService:
    def __init__(self, repository: AuthorizationRepository) -> None:
        self.repository = repository

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
