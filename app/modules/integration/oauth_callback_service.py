"""First-party OAuth callback ownership, authorization, and state consumption."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.modules.auth.authorization import (
    AuthorizationRepository,
    AuthorizationScope,
    AuthorizationService,
)
from app.modules.auth.crypto import token_digest
from app.modules.auth.repository import AuthRepository
from app.modules.auth.service import AuthService, Principal
from app.modules.integration.cloud_factory import cloud_services
from app.modules.integration.cloud_http import ProviderError
from app.modules.integration.cloud_oauth import environment_oauth
from app.modules.integration.models import IntegrationOAuthState, IntegrationProvider
from app.modules.workspace.models import Workspace


@dataclass(frozen=True, slots=True)
class OAuthCallbackState:
    id: UUID
    organization_id: UUID
    workspace_id: UUID


class OAuthCallbackRepository:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self.session = session
        self.settings = settings

    async def resolve(
        self, principal: Principal, provider: str, state: str
    ) -> OAuthCallbackState | None:
        await AuthRepository(self.session).enable_identity_lookup()
        row = (
            await self.session.execute(
                select(IntegrationOAuthState, Workspace.organization_id)
                .join(Workspace, Workspace.id == IntegrationOAuthState.workspace_id)
                .join(
                    IntegrationProvider,
                    IntegrationProvider.id == IntegrationOAuthState.provider_id,
                )
                .where(
                    IntegrationOAuthState.user_id == principal.user_id,
                    IntegrationOAuthState.state_digest
                    == token_digest(
                        state,
                        self.settings.auth_token_secret.get_secret_value(),
                    ),
                    IntegrationProvider.key == provider,
                    IntegrationOAuthState.consumed_at.is_(None),
                    IntegrationOAuthState.expires_at > datetime.now(UTC),
                )
            )
        ).first()
        if row is None:
            return None
        return OAuthCallbackState(row[0].id, row[1], row[0].workspace_id)

    async def consume_denial(self, state: OAuthCallbackState, principal: Principal) -> None:
        record = await self.session.scalar(
            select(IntegrationOAuthState)
            .where(
                IntegrationOAuthState.id == state.id,
                IntegrationOAuthState.user_id == principal.user_id,
                IntegrationOAuthState.workspace_id == state.workspace_id,
                IntegrationOAuthState.consumed_at.is_(None),
            )
            .with_for_update()
        )
        if record is not None:
            record.consumed_at = datetime.now(UTC)
            await self.session.commit()

    async def rollback(self) -> None:
        await self.session.rollback()


class OAuthCallbackService:
    def __init__(
        self,
        session: AsyncSession,
        auth: AuthService,
        settings: Settings,
    ) -> None:
        self.session = session
        self.auth = auth
        self.settings = settings
        self.repository = OAuthCallbackRepository(session, settings)

    async def handle(
        self,
        provider: str,
        session_token: str | None,
        state_value: str,
        code: str,
        denied: bool,
    ) -> None:
        try:
            await self._handle(provider, session_token, state_value, code, denied)
        except Exception:
            await self.repository.rollback()
            raise

    async def _handle(
        self,
        provider: str,
        session_token: str | None,
        state_value: str,
        code: str,
        denied: bool,
    ) -> None:
        if environment_oauth(self.settings).get(provider) is None:
            raise ProviderError("oauth_not_configured")
        principal = await self.auth.authenticate_session(session_token)
        if not 1 <= len(state_value) <= 512:
            raise ProviderError("invalid_oauth_state")
        state = await self.repository.resolve(principal, provider, state_value)
        if state is None:
            raise ProviderError("invalid_oauth_state")

        # Drop the temporary identity lookup authority before applying tenant RLS.
        await self.repository.rollback()
        context = await AuthorizationService(AuthorizationRepository(self.session)).authorize(
            principal,
            AuthorizationScope(state.organization_id, state.workspace_id),
            "integration.update",
        )
        async with cloud_services(self.session, context) as service:
            if denied:
                await self.repository.consume_denial(state, principal)
            else:
                await service.connections.complete(state_value, code)
