"""Authenticated user's tenant discovery API."""

from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_session
from app.modules.auth.authorization import (
    AuthorizationRepository,
    AuthorizationScope,
    AuthorizationService,
)
from app.modules.auth.dependencies import get_current_principal, require_csrf
from app.modules.auth.repository import AuthRepository
from app.modules.auth.service import Principal
from app.modules.organization.models import Organization, OrganizationMembership, MembershipStatus
from app.modules.organization.system_roles import ORGANIZATION_OWNER_ROLE_ID
from app.modules.workspace.repository import WorkspaceRepositoryStore
from app.modules.workspace.schemas import OrganizationSummary, WorkspaceCreate, WorkspaceResponse
from app.modules.workspace.service import WorkspaceService

router = APIRouter(prefix="/api/account", tags=["account"])


@router.get("/organizations", response_model=list[OrganizationSummary])
async def organizations(
    principal: Annotated[Principal, Depends(get_current_principal)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[OrganizationSummary]:
    await session.execute(
        text("SELECT set_config('app.current_user_id', :user_id, true)"),
        {"user_id": str(principal.user_id)},
    )
    await session.execute(
        text("SELECT set_config('app.is_platform_admin', :value, true)"),
        {"value": "true" if principal.is_platform_admin else "false"},
    )
    records = await session.scalars(
        select(Organization)
        .join(
            OrganizationMembership,
            OrganizationMembership.organization_id == Organization.id,
        )
        .where(
            OrganizationMembership.user_id == principal.user_id,
            OrganizationMembership.status == MembershipStatus.ACTIVE,
            Organization.deleted_at.is_(None),
        )
        .order_by(Organization.name)
    )
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
    # Serialize first-use provisioning for this authenticated user only.
    await session.execute(
        text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"),
        {"key": f"personal-workspace:{principal.user_id}"},
    )
    await AuthRepository(session)._enable_identity_lookup()
    organization = await session.scalar(
        select(Organization)
        .join(OrganizationMembership, OrganizationMembership.organization_id == Organization.id)
        .where(
            OrganizationMembership.user_id == principal.user_id,
            OrganizationMembership.status == MembershipStatus.ACTIVE,
            Organization.is_personal.is_(True),
            Organization.deleted_at.is_(None),
        )
        .order_by(Organization.created_at, Organization.id)
        .limit(1)
    )
    if organization is None:
        organization = Organization(
            id=uuid4(),
            name=f"{principal.display_name[:180]} Personal",
            slug=f"personal-{uuid4().hex}",
            is_personal=True,
        )
        session.add(organization)
        await session.flush()
        session.add(
            OrganizationMembership(
                organization_id=organization.id,
                user_id=principal.user_id,
                role_id=ORGANIZATION_OWNER_ROLE_ID,
            )
        )
        await session.flush()
    # Restore real caller privileges before normal workspace authorization.
    context = await AuthorizationService(AuthorizationRepository(session)).authorize(
        principal, AuthorizationScope(organization.id), "workspace.create"
    )
    workspace = await WorkspaceService(WorkspaceRepositoryStore(session), settings).create(
        context, payload.name, payload.slug
    )
    return WorkspaceResponse.model_validate(workspace, from_attributes=True)
