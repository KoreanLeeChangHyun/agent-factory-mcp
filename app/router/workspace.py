"""Canonical Workspace browser template served by the MCP application."""

from typing import Annotated
from urllib.parse import urlencode
from uuid import UUID

from fastapi import APIRouter, Cookie, Depends, HTTPException, Query
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from agent_factory_api.composition.admin import react_workbench_rollout

from app.common.errors import AuthenticationError
from app.core.config import settings
from app.core.paths import TEMPLATE_ROOT, WORKBENCH_WEB_ROOT
from app.core.urls import public_path
from app.db.session import get_session
from app.modules.auth.authorization import AuthorizedContext
from app.modules.auth.authorization_dependencies import require_permission
from app.modules.auth.dependencies import get_auth_service
from app.modules.auth.service import AuthService

router = APIRouter(tags=["workspace"])
WORKSPACE_TEMPLATE = TEMPLATE_ROOT / "workspace" / "index.html"
LOGIN_TEMPLATE = TEMPLATE_ROOT / "login" / "index.html"


async def _has_active_session(service: AuthService, session_token: str | None) -> bool:
    try:
        await service.authenticate_session(session_token)
    except AuthenticationError:
        return False
    return True


@router.get("/", include_in_schema=False)
async def root(
    service: Annotated[AuthService, Depends(get_auth_service)],
    session_token: Annotated[str | None, Cookie(alias=settings.session_cookie_name)] = None,
) -> RedirectResponse:
    destination = "/workspace/" if await _has_active_session(service, session_token) else "/login/"
    return RedirectResponse(public_path(destination), status_code=307)


@router.get("/login", include_in_schema=False)
async def login_root() -> RedirectResponse:
    return RedirectResponse(public_path("/login/"), status_code=307)


@router.api_route("/login/", methods=["GET", "HEAD"], include_in_schema=False, response_model=None)
async def login_page(
    service: Annotated[AuthService, Depends(get_auth_service)],
    session_token: Annotated[str | None, Cookie(alias=settings.session_cookie_name)] = None,
) -> FileResponse | RedirectResponse:
    if await _has_active_session(service, session_token):
        return RedirectResponse(public_path("/workspace/"), status_code=307)
    return FileResponse(
        LOGIN_TEMPLATE,
        headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
    )


@router.api_route(
    "/workspace/", methods=["GET", "HEAD"], include_in_schema=False, response_model=None
)
async def workspace(
    service: Annotated[AuthService, Depends(get_auth_service)],
    session_token: Annotated[str | None, Cookie(alias=settings.session_cookie_name)] = None,
) -> FileResponse | RedirectResponse:
    if not await _has_active_session(service, session_token):
        return RedirectResponse(public_path("/login/"), status_code=307)
    return FileResponse(
        WORKSPACE_TEMPLATE,
        headers={
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get(
    "/workspace/{organization_id}/{workspace_id}/entry",
    include_in_schema=False,
    response_model=None,
)
async def workspace_entry(
    organization_id: UUID,
    workspace_id: UUID,
    context: Annotated[AuthorizedContext, Depends(require_permission("workspace.read"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    task: Annotated[str | None, Query(max_length=64)] = None,
    document: Annotated[str | None, Query(max_length=128)] = None,
) -> RedirectResponse:
    """Resolve an authenticated Workspace's server-owned React or legacy entry."""
    enabled = await react_workbench_rollout(
        session,
        organization_id=context.scope.organization_id,
        workspace_id=workspace_id,
    )
    if not enabled:
        return RedirectResponse(public_path("/workspace/"), status_code=307)
    query = {
        "organization": str(organization_id),
        "workspace": str(workspace_id),
        "task": task or "documents",
    }
    if document:
        query["document"] = document
    return RedirectResponse(f"{public_path('/workbench/')}?{urlencode(query)}", status_code=307)


@router.api_route(
    "/workbench/{deep_path:path}",
    methods=["GET", "HEAD"],
    include_in_schema=False,
    response_model=None,
)
async def react_workbench(
    deep_path: str,
    service: Annotated[AuthService, Depends(get_auth_service)],
    session_token: Annotated[str | None, Cookie(alias=settings.session_cookie_name)] = None,
) -> FileResponse | HTMLResponse | RedirectResponse:
    """Serve the authenticated production React shadow route with deep-link fallback."""
    if not await _has_active_session(service, session_token):
        return RedirectResponse(public_path("/login/"), status_code=307)
    index = WORKBENCH_WEB_ROOT / "index.html"
    if not index.is_file():
        raise HTTPException(
            status_code=503,
            detail={
                "code": "workbench_build_missing",
                "message": "React Workbench build is unavailable",
            },
        )
    requested = WORKBENCH_WEB_ROOT / deep_path
    if deep_path and requested.is_file() and WORKBENCH_WEB_ROOT in requested.resolve().parents:
        cache_control = (
            "public, max-age=31536000, immutable" if deep_path.startswith("assets/") else "no-store"
        )
        return FileResponse(requested, headers={"Cache-Control": cache_control})
    html = index.read_text(encoding="utf-8").replace(
        '"/workbench/', f'"{public_path("/workbench/")}'
    )
    return HTMLResponse(
        html,
        headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
    )


@router.api_route(
    "/workbench", methods=["GET", "HEAD"], include_in_schema=False, response_model=None
)
async def react_workbench_root(
    service: Annotated[AuthService, Depends(get_auth_service)],
    session_token: Annotated[str | None, Cookie(alias=settings.session_cookie_name)] = None,
) -> RedirectResponse:
    if not await _has_active_session(service, session_token):
        return RedirectResponse(public_path("/login/"), status_code=307)
    return RedirectResponse(public_path("/workbench/"), status_code=307)


@router.get("/join/", include_in_schema=False)
async def organization_invitation_entry() -> FileResponse:
    return FileResponse(
        TEMPLATE_ROOT / "join" / "index.html",
        headers={
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
            "X-Content-Type-Options": "nosniff",
        },
    )
