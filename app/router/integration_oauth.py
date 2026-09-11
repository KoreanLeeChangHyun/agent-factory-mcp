"""First-party callback retaining durable OAuth user/workspace ownership."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.errors import ApplicationError
from app.core.config import settings
from app.db.session import get_session
from app.modules.auth.dependencies import get_auth_service
from app.modules.auth.service import AuthService
from app.modules.integration.cloud_http import ProviderError
from app.modules.integration.oauth_callback_service import OAuthCallbackService

router = APIRouter(tags=["integrations"])


@router.get("/api/integrations/oauth/{provider}/callback")
async def callback(
    provider: str,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
    auth: Annotated[AuthService, Depends(get_auth_service)],
):
    # Never reflect provider parameters, codes, tokens or error bodies in the result URL.
    response = RedirectResponse(
        settings.public_base_url.rstrip("/") + "/workspace/",
        status_code=303,
        headers={"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"},
    )
    try:
        await OAuthCallbackService(session, auth, settings).handle(
            provider,
            request.cookies.get(settings.session_cookie_name),
            request.query_params.get("state", ""),
            request.query_params.get("code", ""),
            bool(request.query_params.get("error")),
        )
    except (ApplicationError, ProviderError, ValueError):
        # The clean destination displays cached connection state, not provider errors.
        pass
    except Exception:  # noqa: BLE001, S110 - never log callback query secrets
        # Preserve ambiguous exchanges for authenticated inspection; never log callback input.
        pass
    return response
