"""Canonical Workspace browser template served by the MCP application."""

from fastapi import APIRouter
from fastapi.responses import FileResponse, RedirectResponse

from app.core.paths import TEMPLATE_ROOT
from app.core.urls import public_path

router = APIRouter(tags=["workspace"])
WORKSPACE_TEMPLATE = TEMPLATE_ROOT / "workspace" / "index.html"


@router.get("/", include_in_schema=False)
async def root() -> RedirectResponse:
    return RedirectResponse(public_path("/workspace/"), status_code=307)


@router.api_route("/workspace/", methods=["GET", "HEAD"], include_in_schema=False)
async def workspace() -> FileResponse:
    return FileResponse(
        WORKSPACE_TEMPLATE,
        headers={
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )
