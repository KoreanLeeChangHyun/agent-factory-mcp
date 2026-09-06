"""Workspace-scoped audit history API."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.modules.admin.schemas import AuditEventResponse
from app.modules.audit.repository import AuditRepository
from app.modules.auth.authorization import AuthorizedContext
from app.modules.auth.authorization_dependencies import require_permission

router = APIRouter(
    prefix="/api/organizations/{organization_id}/workspaces/{workspace_id}/audit",
    tags=["audit"],
)


@router.get("", response_model=list[AuditEventResponse])
async def audit_events(
    context: Annotated[AuthorizedContext, Depends(require_permission("audit.read"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[AuditEventResponse]:
    records = await AuditRepository(session).list(workspace_id=context.scope.workspace_id)
    return [AuditEventResponse.model_validate(record, from_attributes=True) for record in records]


@router.get("/export")
async def export_audit_events(
    context: Annotated[AuthorizedContext, Depends(require_permission("audit.export"))],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    from fastapi.responses import JSONResponse
    records = await AuditRepository(session).list(limit=200, workspace_id=context.scope.workspace_id)
    return JSONResponse({"scope": "most_recent", "limit": 200,
        "events": [AuditEventResponse.model_validate(r, from_attributes=True).model_dump(mode="json") for r in records]},
        headers={"Content-Disposition": 'attachment; filename="workspace-audit.json"', "Cache-Control": "no-store"})
