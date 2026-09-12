"""Authenticated user's tenant discovery API."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.modules.auth.dependencies import get_current_principal, require_csrf
from app.modules.auth.service import Principal
from app.modules.workspace.schemas import OrganizationSummary, WorkspaceCreate, WorkspaceResponse
from agent_factory_api.composition.workspaces import workspace_use_cases

router = APIRouter(prefix="/api/account", tags=["account"])


@router.get("/organizations", response_model=list[OrganizationSummary])
async def organizations(
    principal: Annotated[Principal, Depends(get_current_principal)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[OrganizationSummary]:
    records = await workspace_use_cases(session).list_organizations(principal)
    return [OrganizationSummary.model_validate(record, from_attributes=True) for record in records]


@router.post(
    "/personal-workspaces",
    response_model=WorkspaceResponse,
    status_code=201,
    dependencies=[Depends(require_csrf)],
)
async def create_personal_workspace(
    payload: WorkspaceCreate,
    principal: Annotated[Principal, Depends(get_current_principal)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> WorkspaceResponse:
    workspace = await workspace_use_cases(session).create_personal_workspace(
        principal, name=payload.name, slug=payload.slug
    )
    return WorkspaceResponse.model_validate(workspace, from_attributes=True)
