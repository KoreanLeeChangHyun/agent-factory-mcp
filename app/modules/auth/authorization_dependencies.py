"""FastAPI RBAC dependencies."""

from collections.abc import Awaitable, Callable
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.errors import ApplicationError, PermissionDeniedError
from app.db.session import get_session
from app.modules.auth.authorization import (
    AuthorizationRepository,
    AuthorizationScope,
    AuthorizationService,
    AuthorizedContext,
)
from app.modules.auth.dependencies import get_current_principal
from app.modules.auth.service import Principal


def get_authorization_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> AuthorizationService:
    return AuthorizationService(AuthorizationRepository(session))


def require_permission(
    permission: str, *, workspace_required: bool = True
) -> Callable[..., Awaitable[AuthorizedContext]]:
    async def dependency(
        request: Request,
        principal: Annotated[Principal, Depends(get_current_principal)],
        service: Annotated[AuthorizationService, Depends(get_authorization_service)],
        organization_header: Annotated[str | None, Header(alias="X-Organization-ID")] = None,
        workspace_header: Annotated[str | None, Header(alias="X-Workspace-ID")] = None,
    ) -> AuthorizedContext:
        organization_value = request.path_params.get("organization_id") or organization_header
        workspace_value = (request.path_params.get("workspace_id") or workspace_header) if workspace_required else None
        if organization_value is None:
            raise ApplicationError(
                "organization_scope_required", "Organization scope is required", 400
            )
        if workspace_required and workspace_value is None:
            raise ApplicationError("workspace_scope_required", "Workspace scope is required", 400)
        try:
            scope = AuthorizationScope(
                organization_id=UUID(str(organization_value)),
                workspace_id=UUID(str(workspace_value)) if workspace_value else None,
            )
        except ValueError as exc:
            raise ApplicationError("invalid_scope", "Invalid authorization scope", 400) from exc
        return await service.authorize(principal, scope, permission)

    return dependency


def require_platform_admin(
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> Principal:
    if not principal.is_platform_admin:
        raise PermissionDeniedError("platform_admin_required")
    return principal
