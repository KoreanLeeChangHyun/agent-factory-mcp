"""First-party callback retaining durable OAuth user/workspace ownership."""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.errors import ApplicationError
from app.core.config import settings
from app.db.session import get_session
from app.modules.auth.authorization import AuthorizationRepository, AuthorizationScope, AuthorizationService
from app.modules.auth.crypto import token_digest
from app.modules.auth.dependencies import get_auth_service
from app.modules.auth.repository import AuthRepository
from app.modules.auth.service import AuthService
from app.modules.integration.cloud_factory import cloud_services
from app.modules.integration.cloud_http import ProviderError
from app.modules.integration.cloud_oauth import environment_oauth
from app.modules.integration.models import IntegrationOAuthState, IntegrationProvider
from app.modules.workspace.models import Workspace

router = APIRouter(tags=['integrations'])


@router.get('/api/integrations/oauth/{provider}/callback')
async def callback(provider: str, request: Request,
                   session: Annotated[AsyncSession, Depends(get_session)],
                   auth: Annotated[AuthService, Depends(get_auth_service)]):
    # Never reflect provider parameters, codes, tokens or error bodies in the result URL.
    response = RedirectResponse(settings.public_base_url.rstrip('/') + '/workspace/', status_code=303,
        headers={'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer'})
    try:
        config = environment_oauth(settings).get(provider)
        if config is None:
            raise ProviderError('oauth_not_configured')
        principal = await auth.authenticate_session(request.cookies.get(settings.session_cookie_name))
        state = request.query_params.get('state', '')
        if not 1 <= len(state) <= 512:
            raise ProviderError('invalid_oauth_state')
        # Identity lookup can find only this authenticated user's exact state.
        await AuthRepository(session)._enable_identity_lookup()
        row = (await session.execute(select(IntegrationOAuthState, Workspace.organization_id)
            .join(Workspace, Workspace.id == IntegrationOAuthState.workspace_id)
            .join(IntegrationProvider, IntegrationProvider.id == IntegrationOAuthState.provider_id)
            .where(IntegrationOAuthState.user_id == principal.user_id,
                IntegrationOAuthState.state_digest == token_digest(state, settings.auth_token_secret.get_secret_value()),
                IntegrationProvider.key == provider,
                IntegrationOAuthState.consumed_at.is_(None), IntegrationOAuthState.expires_at > datetime.now(UTC)))).first()
        if row is None:
            raise ProviderError('invalid_oauth_state')
        state_id, workspace_id, organization_id = row[0].id, row[0].workspace_id, row[1]
        await session.rollback()
        context = await AuthorizationService(AuthorizationRepository(session)).authorize(
            principal, AuthorizationScope(organization_id, workspace_id), 'integration.update')
        async with cloud_services(session, context) as service:
            if request.query_params.get('error'):
                record = await session.scalar(select(IntegrationOAuthState).where(
                    IntegrationOAuthState.id == state_id, IntegrationOAuthState.user_id == principal.user_id,
                    IntegrationOAuthState.workspace_id == workspace_id,
                    IntegrationOAuthState.consumed_at.is_(None)).with_for_update())
                if record is not None:
                    record.consumed_at = datetime.now(UTC)
                    await session.commit()
            else:
                await service.connections.complete(state, request.query_params.get('code', ''))
    except (ApplicationError, ProviderError, ValueError):
        await session.rollback()
        # The clean destination displays cached connection state, not provider errors.
    except Exception:
        # Preserve ambiguous exchanges for authenticated inspection; never log callback input.
        await session.rollback()
    return response
