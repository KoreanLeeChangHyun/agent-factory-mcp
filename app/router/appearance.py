"""Compatibility mounting bridge for the target appearance HTTP adapter."""

from typing import Annotated

from agent_factory_api.composition import build_theme_service
from agent_factory_api.http.routes.appearance import ThemeService, create_appearance_router
from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.modules.auth.dependencies import get_current_principal, require_csrf


def get_theme_service(
    request: Request, session: Annotated[AsyncSession, Depends(get_session)]
) -> ThemeService:
    return build_theme_service(session, request_id=getattr(request.state, "request_id", None))


router = create_appearance_router(get_theme_service, get_current_principal, require_csrf)
