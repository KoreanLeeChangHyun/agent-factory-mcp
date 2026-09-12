from typing import Annotated

from agent_factory_api.composition.workbenches import build_workbench_service
from agent_factory_api.http.routes.workbenches import WorkbenchService, create_workbench_router
from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.modules.auth.authorization import (
    AuthorizationRepository,
    AuthorizationScope,
    AuthorizationService,
    AuthorizedContext,
)
from app.modules.auth.dependencies import get_current_principal, require_csrf
from app.modules.auth.service import Principal

WORKBENCH_PERMISSIONS = frozenset(
    {
        "workbench.read",
        "workbench.preview",
        "workbench.create",
        "workbench.update",
        "workbench.publish",
        "workbench.archive",
        "workbench.restore",
    }
)


async def get_workbench_context(
    workspace_id: str,
    principal: Annotated[Principal, Depends(get_current_principal)],
    session: Annotated[AsyncSession, Depends(get_session)],
    request: Request,
) -> AuthorizedContext:
    from uuid import UUID

    organization_id = request.headers.get("X-Organization-ID")
    if not organization_id:
        from app.common.errors import ApplicationError

        raise ApplicationError("organization_scope_required", "Organization scope is required", 400)
    return await AuthorizationService(AuthorizationRepository(session)).authorize_any(
        principal,
        AuthorizationScope(UUID(organization_id), UUID(workspace_id)),
        WORKBENCH_PERMISSIONS,
    )


def get_service(
    request: Request, session: Annotated[AsyncSession, Depends(get_session)]
) -> WorkbenchService:
    return build_workbench_service(session, request_id=getattr(request.state, "request_id", None))


router = create_workbench_router(get_service, get_workbench_context, require_csrf)
