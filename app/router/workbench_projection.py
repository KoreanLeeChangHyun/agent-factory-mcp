"""Authorized browser bootstrap for the production React Workbench shadow route."""

from time import monotonic
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from agent_factory_api.composition.admin import react_workbench_rollout

from app.db.session import get_session
from app.modules.auth.authorization import AuthorizedContext
from app.modules.auth.authorization_dependencies import require_permission

router = APIRouter(
    prefix="/api/organizations/{organization_id}/workspaces/{workspace_id}/workbench",
    tags=["workbench-projection"],
)


class WorkbenchSelectionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mode: Literal["legacy", "react"]
    version: Literal[1] = 1
    legacy_path: str = "/workspace/"
    react_path: str = "/workbench/"
    permissions: list[str]


@router.get("/selection", response_model=WorkbenchSelectionResponse)
async def workbench_selection(
    response: Response,
    context: Annotated[AuthorizedContext, Depends(require_permission("workspace.read"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> WorkbenchSelectionResponse:
    started = monotonic()
    workspace_id = context.scope.workspace_id
    if workspace_id is None:
        raise RuntimeError("workspace authorization returned no Workspace")
    enabled = await react_workbench_rollout(
        session,
        organization_id=context.scope.organization_id,
        workspace_id=workspace_id,
    )
    response.headers["Server-Timing"] = (
        f"workbench-selection;dur={(monotonic() - started) * 1000:.2f}"
    )
    response.headers["Cache-Control"] = "no-store"
    return WorkbenchSelectionResponse(
        mode="react" if enabled else "legacy",
        permissions=sorted(context.permissions),
    )
