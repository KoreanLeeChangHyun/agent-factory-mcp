"""Authorized browser bootstrap for the production React Workbench shadow route."""

from time import monotonic
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.modules.admin.models import FeatureFlag
from app.modules.auth.authorization import AuthorizedContext
from app.modules.auth.authorization_dependencies import require_permission
from app.modules.workspace.workbench_selection import WORKBENCH_FEATURE_KEY, react_workbench_enabled

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
    flag = await session.get(FeatureFlag, WORKBENCH_FEATURE_KEY)
    workspace_id = context.scope.workspace_id
    if workspace_id is None:
        raise RuntimeError("workspace authorization returned no Workspace")
    enabled = flag is not None and react_workbench_enabled(
        is_enabled=flag.is_enabled,
        rules=flag.rules if isinstance(flag.rules, dict) else {},
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
