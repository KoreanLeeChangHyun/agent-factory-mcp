"""Browser authentication routes."""

from typing import Annotated
from uuid import UUID

from authlib.integrations.base_client.errors import OAuthError
from fastapi import APIRouter, Cookie, Depends, Request, Response
from fastapi.responses import RedirectResponse

from app.common.errors import AuthenticationError, NotFoundError
from app.core.config import settings
from app.core.urls import public_path
from app.infrastructure.email import EmailSender
from app.modules.auth.crypto import new_opaque_token
from app.modules.auth.dependencies import (
    get_auth_service,
    get_current_principal,
    get_email_sender,
    require_csrf,
)
from app.modules.auth.oauth import build_oauth, external_profile
from app.modules.auth.schemas import (
    ApiTokenCreatedResponse,
    ApiTokenCreateRequest,
    ApiTokenResponse,
    AuthSessionResponse,
    EmailRequest,
    LoginRequest,
    PasswordResetConfirmRequest,
    SessionResponse,
    TokenRequest,
    UserResponse,
)
from app.modules.auth.service import AuthService, Principal

router = APIRouter(prefix="/api/auth", tags=["authentication"])
oauth = build_oauth(settings)


def _user_response(principal: Principal) -> UserResponse:
    return UserResponse(
        id=principal.user_id,
        email=principal.email,
        display_name=principal.display_name,
        is_platform_admin=principal.is_platform_admin,
    )


def _set_auth_cookies(response: Response, session_token: str) -> None:
    max_age = settings.auth_session_ttl_hours * 60 * 60
    cookie_path = settings.root_path or "/"
    response.set_cookie(
        settings.session_cookie_name,
        session_token,
        max_age=max_age,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        path=cookie_path,
    )
    response.set_cookie(
        "agent_factory_csrf",
        new_opaque_token(),
        max_age=max_age,
        httponly=False,
        secure=settings.session_cookie_secure,
        samesite="strict",
        path=cookie_path,
    )


@router.post("/login", response_model=SessionResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> SessionResponse:
    result = await service.login(payload.email, payload.password, request.headers.get("user-agent"))
    _set_auth_cookies(response, result.session_token)
    return SessionResponse(user=_user_response(result.principal))


@router.post("/logout", status_code=204, dependencies=[Depends(require_csrf)])
async def logout(
    response: Response,
    service: Annotated[AuthService, Depends(get_auth_service)],
    session_token: Annotated[str | None, Cookie(alias=settings.session_cookie_name)] = None,
) -> None:
    await service.logout(session_token)
    cookie_path = settings.root_path or "/"
    response.delete_cookie(settings.session_cookie_name, path=cookie_path)
    response.delete_cookie("agent_factory_csrf", path=cookie_path)


@router.get("/me", response_model=SessionResponse)
async def me(principal: Annotated[Principal, Depends(get_current_principal)]) -> SessionResponse:
    return SessionResponse(user=_user_response(principal))


@router.get("/sessions", response_model=list[AuthSessionResponse])
async def sessions(
    principal: Annotated[Principal, Depends(get_current_principal)],
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> list[AuthSessionResponse]:
    records = await service.list_sessions(principal.user_id)
    return [AuthSessionResponse.model_validate(record, from_attributes=True) for record in records]


@router.delete("/sessions/{session_id}", status_code=204, dependencies=[Depends(require_csrf)])
async def revoke_session(
    session_id: UUID,
    principal: Annotated[Principal, Depends(get_current_principal)],
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> None:
    await service.revoke_session(principal.user_id, session_id)


@router.post(
    "/tokens",
    response_model=ApiTokenCreatedResponse,
    dependencies=[Depends(require_csrf)],
)
async def create_api_token(
    payload: ApiTokenCreateRequest,
    principal: Annotated[Principal, Depends(get_current_principal)],
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> ApiTokenCreatedResponse:
    record, plaintext = await service.create_api_token(
        user_id=principal.user_id,
        name=payload.name,
        scopes=payload.scopes,
        expires_in_days=payload.expires_in_days,
    )
    return ApiTokenCreatedResponse(
        id=record.id,
        name=record.name,
        token=plaintext,
        scopes=record.scopes,
        expires_at=record.expires_at,
    )


@router.get("/tokens", response_model=list[ApiTokenResponse])
async def api_tokens(
    principal: Annotated[Principal, Depends(get_current_principal)],
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> list[ApiTokenResponse]:
    records = await service.list_api_tokens(principal.user_id)
    return [ApiTokenResponse.model_validate(record, from_attributes=True) for record in records]


@router.delete("/tokens/{token_id}", status_code=204, dependencies=[Depends(require_csrf)])
async def revoke_api_token(
    token_id: UUID,
    principal: Annotated[Principal, Depends(get_current_principal)],
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> None:
    await service.revoke_api_token(principal.user_id, token_id)


@router.post(
    "/email-verification/request",
    status_code=202,
    dependencies=[Depends(require_csrf)],
)
async def request_email_verification(
    principal: Annotated[Principal, Depends(get_current_principal)],
    service: Annotated[AuthService, Depends(get_auth_service)],
    sender: Annotated[EmailSender, Depends(get_email_sender)],
) -> None:
    email, token = await service.issue_email_verification(principal.user_id)
    await sender.send_verification(email, token)


@router.post("/email-verification/confirm", status_code=204)
async def confirm_email_verification(
    payload: TokenRequest,
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> None:
    await service.verify_email(payload.token)


@router.post("/password-reset/request", status_code=202)
async def request_password_reset(
    payload: EmailRequest,
    service: Annotated[AuthService, Depends(get_auth_service)],
    sender: Annotated[EmailSender, Depends(get_email_sender)],
) -> None:
    delivery = await service.issue_password_reset(payload.email)
    if delivery is not None:
        await sender.send_password_reset(*delivery)


@router.post("/password-reset/confirm", status_code=204)
async def confirm_password_reset(
    payload: PasswordResetConfirmRequest,
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> None:
    await service.reset_password(payload.token, payload.password)


@router.get("/providers")
async def providers() -> dict[str, list[str]]:
    return {
        "providers": [
            provider for provider in ("google", "github") if oauth.create_client(provider)
        ]
    }


@router.get("/oauth/{provider}/login")
async def oauth_login(provider: str, request: Request) -> Response:
    client = oauth.create_client(provider)
    if client is None:
        raise NotFoundError("oauth_provider_not_configured", "OAuth provider is not configured")
    redirect_uri = (
        f"{settings.public_base_url.rstrip('/')}/api/auth/oauth/{provider}/callback"
    )
    return await client.authorize_redirect(request, redirect_uri)


@router.get("/oauth/{provider}/callback", name="oauth_callback")
async def oauth_callback(
    provider: str,
    request: Request,
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> Response:
    client = oauth.create_client(provider)
    if client is None:
        raise NotFoundError("oauth_provider_not_configured", "OAuth provider is not configured")
    try:
        token = await client.authorize_access_token(request)
        profile = await external_profile(provider, client, token)
    except OAuthError as exc:
        raise AuthenticationError("oauth_callback_failed") from exc
    result = await service.login_external(
        provider=profile.provider,
        subject=profile.subject,
        email=profile.email,
        display_name=profile.display_name,
        user_agent=request.headers.get("user-agent"),
    )
    response = RedirectResponse(public_path("/workspace/"), status_code=303)
    _set_auth_cookies(response, result.session_token)
    return response
