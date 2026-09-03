"""FastAPI authentication dependencies."""

from typing import Annotated

from fastapi import Cookie, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.errors import PermissionDeniedError
from app.core.config import settings
from app.db.session import get_session
from app.infrastructure.email import EmailSender
from app.modules.auth.repository import AuthRepository
from app.modules.auth.service import AuthService, Principal


def get_auth_service(session: Annotated[AsyncSession, Depends(get_session)]) -> AuthService:
    return AuthService(AuthRepository(session), settings)


def get_email_sender() -> EmailSender:
    return EmailSender(settings)


async def get_current_principal(
    service: Annotated[AuthService, Depends(get_auth_service)],
    session_token: Annotated[str | None, Cookie(alias=settings.session_cookie_name)] = None,
) -> Principal:
    return await service.authenticate_session(session_token)


def require_csrf(
    csrf_header: Annotated[str | None, Header(alias="X-CSRF-Token")] = None,
    csrf_cookie: Annotated[str | None, Cookie(alias="agent_factory_csrf")] = None,
) -> None:
    from hmac import compare_digest

    if not csrf_header or not csrf_cookie or not compare_digest(csrf_header, csrf_cookie):
        raise PermissionDeniedError("csrf_validation_failed", "CSRF validation failed")
