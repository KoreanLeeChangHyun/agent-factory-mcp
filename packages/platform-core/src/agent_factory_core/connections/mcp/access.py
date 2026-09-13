"""Workspace access and successful-client confirmation independent of transport."""

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol
from uuid import UUID

from agent_factory_core.identity import Principal, UserStatus
from agent_factory_core.identity.authorization import AuthorizationScope, AuthorizationService, AuthorizedContext
from agent_factory_core.identity.domain import ResolvedApiToken
from agent_factory_core.identity.ports import IdentityRepository
from agent_factory_core.organizations.permissions import token_permissions
from agent_factory_core.shared.errors import ApplicationError, PermissionDeniedError

from .ports import Clock


@dataclass(frozen=True)
class MCPTokenBinding:
    id: UUID
    user_id: UUID
    organization_id: UUID
    workspace_id: UUID


class MCPAccessRepository(Protocol):
    async def token_binding(self, token_id: UUID) -> MCPTokenBinding | None: ...
    async def workspace_available(self, organization_id: UUID, workspace_id: UUID) -> bool: ...
    async def confirm(self, binding: MCPTokenBinding, client_name: str, now: datetime) -> None: ...
    async def commit(self) -> None: ...
    async def rollback(self) -> None: ...


class TokenDigest(Protocol):
    def token_digest(self, token: str) -> bytes: ...


class MCPAccessUseCases:
    def __init__(self, repository: MCPAccessRepository, authorization: AuthorizationService, clock: Clock):
        self.repository = repository
        self.authorization = authorization
        self.clock = clock

    async def authorize(self, principal: Principal, scope: AuthorizationScope, scopes: list[str] | tuple[str, ...]) -> AuthorizedContext:
        context = await self.authorization.authorize_any(principal, scope, token_permissions(scopes))
        if scope.workspace_id is None or not await self.repository.workspace_available(scope.organization_id, scope.workspace_id):
            raise PermissionDeniedError("workspace_unavailable", "Workspace is unavailable")
        return AuthorizedContext(principal, scope, context.permissions & token_permissions(scopes))

    async def confirm(self, principal: Principal, binding: MCPTokenBinding, scopes: list[str] | tuple[str, ...], client_name: str) -> None:
        if principal.user_id != binding.user_id:
            raise PermissionDeniedError("workspace_access_denied", "Connection belongs to another user")
        await self.authorize(principal, AuthorizationScope(binding.organization_id, binding.workspace_id), scopes)
        try:
            await self.repository.confirm(binding, client_name[:120], self.clock.now())
            await self.repository.commit()
        except Exception:
            await self.repository.rollback()
            raise


class MCPTokenUseCases:
    def __init__(self, identity: IdentityRepository, access: MCPAccessUseCases, digest: TokenDigest, clock: Clock):
        self.identity, self.access, self.digest, self.clock = identity, access, digest, clock

    async def verify(self, token: str) -> tuple[ResolvedApiToken, MCPTokenBinding | None] | None:
        if not token.startswith("afm_"):
            return None
        record = await self.identity.resolve_api_token(self.digest.token_digest(token), self.clock.now())
        if record is None or record.user.status is not UserStatus.ACTIVE:
            return None
        binding = await self.access.repository.token_binding(record.token.id)
        if binding is not None:
            if binding.user_id != record.user.id:
                return None
            principal = Principal(record.user.id, record.user.email, record.user.display_name, record.user.is_platform_admin)
            try:
                await self.access.authorize(principal, AuthorizationScope(binding.organization_id, binding.workspace_id), record.token.scopes)
            except ApplicationError:
                return None
        return record, binding
