"""Framework-independent authorization context and policy."""

from dataclasses import dataclass
from typing import Protocol
from uuid import UUID

from agent_factory_core.organizations.permissions import (
    CATALOG,
    ORGANIZATION_PERMISSIONS,
    WORKSPACE_PERMISSIONS,
)
from agent_factory_core.shared.errors import ApplicationError, NotFoundError, PermissionDeniedError

from .domain import Principal


@dataclass(frozen=True, slots=True)
class AuthorizationScope:
    organization_id: UUID
    workspace_id: UUID | None = None


@dataclass(frozen=True, slots=True)
class PermissionSource:
    source: str
    role_id: UUID
    role_name: str
    permissions: frozenset[str]
    role_scope: str
    team_id: UUID | None = None
    team_name: str | None = None


@dataclass(frozen=True, slots=True)
class AuthorizationState:
    organization_membership_active: bool
    workspace_exists: bool = True
    workspace_active: bool = True
    sources: tuple[PermissionSource, ...] = ()


@dataclass(frozen=True, slots=True)
class AuthorizedContext:
    principal: Principal
    scope: AuthorizationScope
    permissions: frozenset[str]


class AuthorizationRepository(Protocol):
    async def establish_scope(self, principal: Principal, scope: AuthorizationScope) -> None: ...
    async def authorization_state(
        self, principal: Principal, scope: AuthorizationScope
    ) -> AuthorizationState: ...


class AuthorizationService:
    def __init__(self, repository: AuthorizationRepository) -> None:
        self.repository = repository

    async def resolve(self, principal: Principal, scope: AuthorizationScope) -> AuthorizedContext:
        await self.repository.establish_scope(principal, scope)
        state = await self.repository.authorization_state(principal, scope)
        if scope.workspace_id is not None and (
            not state.workspace_exists or not state.workspace_active
        ):
            raise NotFoundError("workspace_not_found", "Workspace not found")
        if principal.is_platform_admin:
            permissions = frozenset(CATALOG)
        elif not state.organization_membership_active:
            permissions = frozenset()
        else:
            expected_scope = "workspace" if scope.workspace_id else "organization"
            allowed = WORKSPACE_PERMISSIONS if scope.workspace_id else ORGANIZATION_PERMISSIONS
            permissions = frozenset(
                permission
                for source in state.sources
                if source.role_scope == expected_scope
                for permission in source.permissions
                if permission in allowed
            )
        return AuthorizedContext(principal, scope, permissions)

    async def authorize_any(
        self, principal: Principal, scope: AuthorizationScope, allowed: frozenset[str]
    ) -> AuthorizedContext:
        context = await self.resolve(principal, scope)
        permissions = context.permissions & allowed
        if not permissions:
            raise PermissionDeniedError("no_effective_token_permissions")
        return AuthorizedContext(principal, scope, permissions)

    async def authorize(
        self, principal: Principal, scope: AuthorizationScope, required_permission: str
    ) -> AuthorizedContext:
        context = await self.resolve(principal, scope)
        permissions = context.permissions
        if required_permission not in permissions:
            raise PermissionDeniedError(
                "permission_required", f"Permission required: {required_permission}"
            )
        return AuthorizedContext(principal, scope, permissions)


def require_context(context: AuthorizedContext, *permissions: str) -> None:
    for permission in permissions:
        if permission not in context.permissions:
            raise PermissionDeniedError("permission_required", f"Permission required: {permission}")


def require_workspace_id(context: AuthorizedContext) -> UUID:
    if context.scope.workspace_id is None:
        raise ApplicationError("workspace_scope_required", "Workspace scope is required", 400)
    return context.scope.workspace_id
