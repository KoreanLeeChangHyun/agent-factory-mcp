"""FastAPI authentication dependencies."""

from typing import Annotated

from fastapi import Cookie, Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from agent_factory_api.composition.identity import IdentityCompositionSettings, compose_identity
from agent_factory_core.identity import AuthService, Principal
from app.common.errors import PermissionDeniedError
from app.core.config import settings
from app.db.session import get_session
from app.infrastructure.email import EmailSender


def get_auth_service(session: Annotated[AsyncSession, Depends(get_session)]) -> AuthService:
    return compose_identity(
        session,
        IdentityCompositionSettings(
            token_secret=settings.auth_token_secret.get_secret_value(),
            session_ttl_hours=settings.auth_session_ttl_hours,
            max_failed_attempts=settings.auth_max_failed_attempts,
            lock_minutes=settings.auth_lock_minutes,
        ),
    )


def get_email_sender() -> EmailSender:
    return EmailSender(settings)


async def get_current_principal(
    request: Request,
    service: Annotated[AuthService, Depends(get_auth_service)],
    session_token: Annotated[str | None, Cookie(alias=settings.session_cookie_name)] = None,
) -> Principal:
    principal = await service.authenticate_session(session_token)
    request.state.principal = principal
    return principal


def require_csrf(
    csrf_header: Annotated[str | None, Header(alias="X-CSRF-Token")] = None,
    csrf_cookie: Annotated[str | None, Cookie(alias="agent_factory_csrf")] = None,
) -> None:
    from hmac import compare_digest

    if not csrf_header or not csrf_cookie or not compare_digest(csrf_header, csrf_cookie):
        raise PermissionDeniedError("csrf_validation_failed", "CSRF validation failed")
