"""Canonical Workspace browser template served by the MCP application."""

from typing import Annotated

from fastapi import APIRouter, Cookie, Depends
from fastapi.responses import FileResponse, RedirectResponse

from app.common.errors import AuthenticationError
from app.core.config import settings
from app.core.paths import TEMPLATE_ROOT
from app.core.urls import public_path
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


@router.api_route(
    "/login/", methods=["GET", "HEAD"], include_in_schema=False, response_model=None
)
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
