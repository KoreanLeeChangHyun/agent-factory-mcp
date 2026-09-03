"""Secure integration connection and webhook lifecycle."""

from __future__ import annotations

import base64
import hmac
import json
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from uuid import UUID

from sqlalchemy.exc import IntegrityError

from app.common.errors import ApplicationError, ConflictError, NotFoundError
from app.core.config import Settings
from app.infrastructure.secret_encryption import SecretCipher
from app.modules.auth.authorization import AuthorizedContext
from app.modules.auth.crypto import new_opaque_token, token_digest
from app.modules.integration.models import (
    IntegrationConnection,
    IntegrationOAuthState,
    IntegrationProvider,
    WebhookDelivery,
    WebhookEndpoint,
)
from app.modules.integration.repository import IntegrationRepository


class IntegrationService:
    def __init__(
        self, repository: IntegrationRepository, cipher: SecretCipher, settings: Settings
    ) -> None:
        self.repository = repository
        self.cipher = cipher
        self.settings = settings

    async def list_providers(self) -> list[IntegrationProvider]:
        return await self.repository.list_providers()

    async def list_connections(self, context: AuthorizedContext) -> list[IntegrationConnection]:
        return await self.repository.list_connections(_workspace_id(context))

    async def create_connection(
        self,
        context: AuthorizedContext,
        provider_id: UUID,
        name: str,
        credentials: dict[str, object] | None,
    ) -> IntegrationConnection:
        if await self.repository.get_provider(provider_id) is None:
            raise NotFoundError("integration_provider_not_found", "Integration provider not found")
        encrypted = self.cipher.encrypt(credentials) if credentials else None
        try:
            record = await self.repository.create_connection(
                _workspace_id(context),
                provider_id,
                name.strip(),
                encrypted,
                self.cipher.key_version if encrypted else None,
            )
            await self.repository.commit()
            return record
        except IntegrityError as exc:
            await self.repository.rollback()
            raise ConflictError(
                "integration_connection_exists", "Integration connection already exists"
            ) from exc

    async def disconnect(self, context: AuthorizedContext, connection_id: UUID) -> None:
        if not await self.repository.disconnect(_workspace_id(context), connection_id):
            raise NotFoundError(
                "integration_connection_not_found", "Integration connection not found"
            )
        await self.repository.commit()

    async def update_cursor(
        self, context: AuthorizedContext, connection_id: UUID, cursor: dict[str, object]
    ) -> None:
        if not await self.repository.update_cursor(_workspace_id(context), connection_id, cursor):
            raise ConflictError("integration_not_active", "Integration connection is not active")
        await self.repository.commit()

    async def begin_oauth(
        self, context: AuthorizedContext, provider_id: UUID
    ) -> tuple[str, str, datetime]:
        provider = await self.repository.get_provider(provider_id)
        if provider is None or provider.auth_type.value != "oauth2":
            raise NotFoundError("oauth_provider_not_found", "OAuth provider not found")
        state = new_opaque_token()
        verifier = new_opaque_token()
        challenge = (
            base64.urlsafe_b64encode(sha256(verifier.encode()).digest()).rstrip(b"=").decode()
        )
        expires_at = datetime.now(UTC) + timedelta(minutes=10)
        record = IntegrationOAuthState(
            workspace_id=_workspace_id(context),
            provider_id=provider_id,
            user_id=context.principal.user_id,
            state_digest=token_digest(state, self.settings.auth_token_secret.get_secret_value()),
            encrypted_pkce_verifier=self.cipher.encrypt(verifier),
            expires_at=expires_at,
        )
        await self.repository.create_oauth_state(record)
        await self.repository.commit()
        return state, challenge, expires_at

    async def complete_oauth_state(self, state: str) -> tuple[IntegrationOAuthState, str]:
        digest = token_digest(state, self.settings.auth_token_secret.get_secret_value())
        record = await self.repository.consume_oauth_state(digest, datetime.now(UTC))
        if record is None:
            raise ApplicationError("invalid_oauth_state", "OAuth state is invalid or expired", 400)
        verifier = self.cipher.decrypt_text(record.encrypted_pkce_verifier)
        await self.repository.commit()
        return record, verifier

    async def create_webhook_endpoint(
        self, context: AuthorizedContext, connection_id: UUID
    ) -> tuple[str, str, str]:
        connection = await self.repository.get_connection(_workspace_id(context), connection_id)
        if connection is None:
            raise NotFoundError(
                "integration_connection_not_found", "Integration connection not found"
            )
        public_id = new_opaque_token()
        signing_secret = new_opaque_token()
        endpoint = WebhookEndpoint(
            workspace_id=connection.workspace_id,
            connection_id=connection.id,
            public_id=public_id,
            encrypted_signing_secret=self.cipher.encrypt({"secret": signing_secret}),
            encryption_key_version=self.cipher.key_version,
        )
        try:
            await self.repository.create_webhook_endpoint(endpoint)
            await self.repository.commit()
        except IntegrityError as exc:
            await self.repository.rollback()
            raise ConflictError(
                "webhook_endpoint_exists", "Connection already has a webhook endpoint"
            ) from exc
        url = f"{self.settings.public_base_url.rstrip('/')}/api/webhooks/{public_id}"
        return public_id, signing_secret, url

    async def accept_webhook(
        self,
        endpoint_public_id: str,
        event_id: str,
        payload_bytes: bytes,
        signature: str,
    ) -> WebhookDelivery:
        if len(payload_bytes) > self.settings.webhook_max_payload_bytes:
            raise ApplicationError("webhook_too_large", "Webhook payload exceeds limit", 413)
        endpoint = await self.repository.get_webhook_endpoint(endpoint_public_id)
        if endpoint is None:
            raise NotFoundError("webhook_endpoint_not_found", "Webhook endpoint not found")
        secret = self.cipher.decrypt_json(endpoint.encrypted_signing_secret)["secret"]
        expected = hmac.new(str(secret).encode(), payload_bytes, sha256).hexdigest()
        if not hmac.compare_digest(expected, signature.removeprefix("sha256=")):
            raise ApplicationError("invalid_webhook_signature", "Invalid webhook signature", 401)
        existing = await self.repository.find_delivery(endpoint.id, event_id)
        if existing is not None:
            return existing
        try:
            payload = json.loads(payload_bytes)
        except json.JSONDecodeError as exc:
            raise ApplicationError(
                "invalid_webhook_json", "Webhook body must be JSON", 400
            ) from exc
        if not isinstance(payload, dict):
            raise ApplicationError("invalid_webhook_json", "Webhook body must be an object", 400)
        delivery = WebhookDelivery(
            workspace_id=endpoint.workspace_id,
            webhook_endpoint_id=endpoint.id,
            provider_event_id=event_id,
            signature_verified=True,
            payload=payload,
        )
        try:
            await self.repository.create_delivery(delivery)
            await self.repository.commit()
            return delivery
        except IntegrityError:
            await self.repository.rollback()
            duplicate = await self.repository.find_delivery(endpoint.id, event_id)
            if duplicate is None:
                raise
            return duplicate


def _workspace_id(context: AuthorizedContext) -> UUID:
    if context.scope.workspace_id is None:
        raise ApplicationError("workspace_scope_required", "Workspace scope is required", 400)
    return context.scope.workspace_id
