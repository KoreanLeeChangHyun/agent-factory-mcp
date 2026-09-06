"""Read-only Human projection of external agent reports."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.modules.auth.authorization import AuthorizedContext
from app.modules.auth.authorization_dependencies import require_permission
from app.modules.reporting.service import ReportingService

router = APIRouter(
    prefix="/api/organizations/{organization_id}/workspaces/{workspace_id}/reporting",
    tags=["external reporting"],
)
ReadContext = Annotated[AuthorizedContext, Depends(require_permission("agent.read"))]
Session = Annotated[AsyncSession, Depends(get_session)]


@router.get("")
async def snapshot(context: ReadContext, session: Session):
    return await ReportingService(session, context).snapshot()


@router.get("/tasks/{task_id}")
async def detail(
    task_id: UUID,
    context: ReadContext,
    session: Session,
    before_revision: Annotated[int | None, Query(ge=1)] = None,
):
    return await ReportingService(session, context).detail(task_id, before_revision)
