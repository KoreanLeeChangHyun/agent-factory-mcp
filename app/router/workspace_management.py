"""Tenant Workspace management API."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_session
from app.modules.auth.authorization import AuthorizedContext
from app.modules.auth.authorization_dependencies import require_permission
from app.modules.auth.dependencies import require_csrf
from app.modules.workspace.repository import WorkspaceRepositoryStore
from app.modules.workspace.schemas import (
    RepositoryCreate,
    RepositoryResponse,
    WorkspaceCreate,
    WorkspaceMemberCreate,
    WorkspaceMemberResponse,
    WorkspaceResponse,
    WorkspaceUpdate,
    WorkspaceUsageResponse,
)
from app.modules.workspace.service import WorkspaceService

router = APIRouter(prefix="/api/organizations/{organization_id}/workspaces", tags=["workspaces"])


def get_workspace_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> WorkspaceService:
    return WorkspaceService(WorkspaceRepositoryStore(session), settings)


def _workspace_response(record: object) -> WorkspaceResponse:
    return WorkspaceResponse.model_validate(record, from_attributes=True)


@router.get("", response_model=list[WorkspaceResponse])
async def list_workspaces(
    context: Annotated[
        AuthorizedContext,
        Depends(require_permission("workspace.read", workspace_required=False)),
    ],
    service: Annotated[WorkspaceService, Depends(get_workspace_service)],
) -> list[WorkspaceResponse]:
    return [_workspace_response(record) for record in await service.list(context)]


@router.get("/recent", response_model=list[WorkspaceResponse])
async def recent_workspaces(
    context: Annotated[
        AuthorizedContext,
        Depends(require_permission("workspace.read", workspace_required=False)),
    ],
    service: Annotated[WorkspaceService, Depends(get_workspace_service)],
) -> list[WorkspaceResponse]:
    return [_workspace_response(record) for record in await service.recent(context)]


@router.post(
    "",
    response_model=WorkspaceResponse,
    status_code=201,
    dependencies=[Depends(require_csrf)],
)
async def create_workspace(
    payload: WorkspaceCreate,
    context: Annotated[
        AuthorizedContext,
        Depends(require_permission("workspace.manage", workspace_required=False)),
    ],
    service: Annotated[WorkspaceService, Depends(get_workspace_service)],
) -> WorkspaceResponse:
    return _workspace_response(await service.create(context, payload.name, payload.slug))


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(
    context: Annotated[AuthorizedContext, Depends(require_permission("workspace.read"))],
    service: Annotated[WorkspaceService, Depends(get_workspace_service)],
) -> WorkspaceResponse:
    return _workspace_response(await service.get(context))


@router.put(
    "/{workspace_id}",
    response_model=WorkspaceResponse,
    dependencies=[Depends(require_csrf)],
)
async def update_workspace(
    payload: WorkspaceUpdate,
    context: Annotated[AuthorizedContext, Depends(require_permission("workspace.manage"))],
    service: Annotated[WorkspaceService, Depends(get_workspace_service)],
) -> WorkspaceResponse:
    return _workspace_response(await service.update(context, payload.name, payload.revision))


@router.delete("/{workspace_id}", status_code=204, dependencies=[Depends(require_csrf)])
async def deactivate_workspace(
    context: Annotated[AuthorizedContext, Depends(require_permission("workspace.manage"))],
    service: Annotated[WorkspaceService, Depends(get_workspace_service)],
) -> None:
    await service.deactivate(context)


@router.post("/{workspace_id}/visits", status_code=204, dependencies=[Depends(require_csrf)])
async def record_workspace_visit(
    context: Annotated[AuthorizedContext, Depends(require_permission("workspace.read"))],
    service: Annotated[WorkspaceService, Depends(get_workspace_service)],
) -> None:
    await service.record_visit(context)


@router.get("/{workspace_id}/usage", response_model=WorkspaceUsageResponse)
async def workspace_usage(
    context: Annotated[AuthorizedContext, Depends(require_permission("workspace.read"))],
    service: Annotated[WorkspaceService, Depends(get_workspace_service)],
) -> WorkspaceUsageResponse:
    members, repositories = await service.usage(context)
    return WorkspaceUsageResponse(members=members, repositories=repositories)


@router.get("/{workspace_id}/repositories", response_model=list[RepositoryResponse])
async def list_repositories(
    context: Annotated[AuthorizedContext, Depends(require_permission("workspace.read"))],
    service: Annotated[WorkspaceService, Depends(get_workspace_service)],
) -> list[RepositoryResponse]:
    records = await service.list_repositories(context)
    return [RepositoryResponse.model_validate(record, from_attributes=True) for record in records]


@router.post(
    "/{workspace_id}/repositories",
    response_model=RepositoryResponse,
    status_code=201,
    dependencies=[Depends(require_csrf)],
)
async def add_repository(
    payload: RepositoryCreate,
    context: Annotated[AuthorizedContext, Depends(require_permission("workspace.manage"))],
    service: Annotated[WorkspaceService, Depends(get_workspace_service)],
) -> RepositoryResponse:
    record = await service.add_repository(
        context,
        payload.location,
        str(payload.remote_url) if payload.remote_url else None,
        payload.metadata,
    )
    return RepositoryResponse.model_validate(record, from_attributes=True)


@router.get("/{workspace_id}/members", response_model=list[WorkspaceMemberResponse])
async def list_members(
    context: Annotated[AuthorizedContext, Depends(require_permission("workspace.manage"))],
    service: Annotated[WorkspaceService, Depends(get_workspace_service)],
) -> list[WorkspaceMemberResponse]:
    return [
        WorkspaceMemberResponse(
            user_id=user.id,
            email=user.email,
            display_name=user.display_name,
            role=role,
        )
        for user, role in await service.list_members(context)
    ]


@router.post("/{workspace_id}/members", status_code=204, dependencies=[Depends(require_csrf)])
async def add_member(
    payload: WorkspaceMemberCreate,
    context: Annotated[AuthorizedContext, Depends(require_permission("workspace.manage"))],
    service: Annotated[WorkspaceService, Depends(get_workspace_service)],
) -> None:
    await service.add_member(context, payload.email, payload.role)


@router.delete(
    "/{workspace_id}/members/{user_id}",
    status_code=204,
    dependencies=[Depends(require_csrf)],
)
async def remove_member(
    user_id: UUID,
    context: Annotated[AuthorizedContext, Depends(require_permission("workspace.manage"))],
    service: Annotated[WorkspaceService, Depends(get_workspace_service)],
) -> None:
    await service.remove_member(context, user_id)
