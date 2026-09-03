"""Authenticated user's tenant discovery API."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.modules.auth.dependencies import get_current_principal
from app.modules.auth.service import Principal
from app.modules.organization.models import Organization, OrganizationMembership
from app.modules.workspace.schemas import OrganizationSummary

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
            Organization.deleted_at.is_(None),
        )
        .order_by(Organization.name)
    )
    return [OrganizationSummary.model_validate(record, from_attributes=True) for record in records]
