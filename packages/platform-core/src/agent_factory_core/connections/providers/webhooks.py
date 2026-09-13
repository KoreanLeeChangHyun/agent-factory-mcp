from __future__ import annotations

import hmac
import json
from dataclasses import dataclass, replace
from datetime import datetime, timedelta
from enum import StrEnum
from hashlib import sha256
from typing import Protocol
from uuid import UUID, uuid4

from agent_factory_core.identity.authorization import (
    AuthorizedContext,
    require_context,
    require_workspace_id,
)
from agent_factory_core.shared.errors import ApplicationError, ConflictError, NotFoundError

from .credentials import CredentialSecrets


@dataclass(frozen=True, slots=True)
class WebhookEndpoint:
    id: UUID
    workspace_id: UUID
    connection_id: UUID
    public_id: str
    encrypted_signing_secret: bytes
    key_version: int
    active: bool = True
    requested_by_user_id: UUID | None = None


class WebhookDeliveryStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    DEAD = "dead"


@dataclass(frozen=True, slots=True)
class WebhookDelivery:
    id: UUID
    workspace_id: UUID
    endpoint_id: UUID
    provider_event_id: str
    payload: dict[str, object]
    signature_verified: bool = True
    received_at: datetime | None = None
    status: WebhookDeliveryStatus = WebhookDeliveryStatus.PENDING
    attempt_count: int = 0
    next_attempt_at: datetime | None = None
    last_error: str | None = None
    finished_at: datetime | None = None


class WebhookRepository(Protocol):
    async def connection_exists(self, workspace_id: UUID, connection_id: UUID) -> bool: ...
    async def insert_endpoint(self, value: WebhookEndpoint) -> WebhookEndpoint: ...
    async def endpoint_by_public_id(self, public_id: str) -> WebhookEndpoint | None: ...
    async def delivery(self, endpoint_id: UUID, event_id: str) -> WebhookDelivery | None: ...
    async def insert_delivery(self, value: WebhookDelivery) -> WebhookDelivery: ...
    async def claim_delivery(
        self, workspace_id: UUID, delivery_id: UUID, now: datetime
    ) -> WebhookDelivery | None: ...
    async def save_delivery(self, value: WebhookDelivery) -> WebhookDelivery: ...
    async def commit(self) -> None: ...
    async def rollback(self) -> None: ...


class Clock(Protocol):
    def now(self) -> datetime: ...


class WebhookDeliverySender(Protocol):
    async def send(self, delivery: WebhookDelivery) -> None: ...


class WebhookDeliveryPublisher(Protocol):
    def publish(self, delivery_id: UUID) -> str: ...


class WebhookDeliveryError(Exception):
    """Sanitized failure raised by a delivery sender implementation."""


class ProviderWebhookUseCases:
    def __init__(
        self,
        repository: WebhookRepository,
        secrets: CredentialSecrets,
        clock: Clock,
        public_base_url: str,
        max_payload_bytes: int,
        publisher: WebhookDeliveryPublisher | None = None,
    ) -> None:
        self.repository = repository
        self.secrets = secrets
        self.clock = clock
        self.public_base_url = public_base_url.rstrip("/")
        self.max_payload_bytes = max_payload_bytes
        self.publisher = publisher

    async def create(self, context: AuthorizedContext, connection_id: UUID) -> dict[str, object]:
        require_context(context, "integration.update")
        workspace_id = require_workspace_id(context)
        if not await self.repository.connection_exists(workspace_id, connection_id):
            raise NotFoundError("integration_connection_not_found", "Connection not found")
        public_id, secret = self.secrets.issue(), self.secrets.issue()
        endpoint = WebhookEndpoint(
            uuid4(),
            workspace_id,
            connection_id,
            public_id,
            self.secrets.encrypt({"purpose": "webhook", "endpoint": public_id, "secret": secret}),
            self.secrets.key_version,
            True,
            context.principal.user_id,
        )
        try:
            await self.repository.insert_endpoint(endpoint)
            await self.repository.commit()
        except Exception as error:
            await self.repository.rollback()
            if error.__class__.__name__ == "IntegrityError":
                raise ConflictError(
                    "webhook_endpoint_exists", "Webhook endpoint already exists"
                ) from error
            raise
        return {
            "public_id": public_id,
            "signing_secret": secret,
            "url": f"{self.public_base_url}/api/webhooks/{public_id}",
        }

    async def process(
        self,
        context: AuthorizedContext,
        delivery_id: UUID,
        sender: WebhookDeliverySender,
        *,
        max_attempts: int = 5,
        retry_after_seconds: int = 60,
    ) -> WebhookDelivery:
        require_context(context, "integration.use")
        workspace_id = require_workspace_id(context)
        if not 1 <= max_attempts <= 20 or not 1 <= retry_after_seconds <= 86_400:
            raise ApplicationError("invalid_webhook_retry_policy", "Retry policy is invalid", 422)
        claimed = await self.repository.claim_delivery(workspace_id, delivery_id, self.clock.now())
        if claimed is None:
            raise NotFoundError("webhook_delivery_not_found", "Webhook delivery not found")
        if claimed.status in {WebhookDeliveryStatus.SUCCEEDED, WebhookDeliveryStatus.DEAD}:
            return claimed
        if claimed.status != WebhookDeliveryStatus.PROCESSING or not claimed.signature_verified:
            raise ConflictError("webhook_delivery_not_claimed", "Webhook delivery is unavailable")
        try:
            await sender.send(claimed)
            saved = await self.repository.save_delivery(
                replace(
                    claimed,
                    status=WebhookDeliveryStatus.SUCCEEDED,
                    next_attempt_at=None,
                    last_error=None,
                    finished_at=self.clock.now(),
                )
            )
        except WebhookDeliveryError:
            terminal = claimed.attempt_count >= max_attempts
            saved = await self.repository.save_delivery(
                replace(
                    claimed,
                    status=WebhookDeliveryStatus.DEAD if terminal else WebhookDeliveryStatus.FAILED,
                    next_attempt_at=None
                    if terminal
                    else self.clock.now() + timedelta(seconds=retry_after_seconds),
                    last_error="webhook_delivery_failed",
                    finished_at=self.clock.now() if terminal else None,
                )
            )
        await self.repository.commit()
        return saved

    async def accept(
        self, public_id: str, event_id: str, body: bytes, signature: str
    ) -> WebhookDelivery:
        if not 1 <= len(event_id) <= 500:
            raise ApplicationError("invalid_webhook_event", "Webhook event ID is invalid", 422)
        if len(body) > self.max_payload_bytes:
            raise ApplicationError("webhook_too_large", "Webhook payload exceeds limit", 413)
        endpoint = await self.repository.endpoint_by_public_id(public_id)
        if endpoint is None or not endpoint.active:
            raise NotFoundError("webhook_endpoint_not_found", "Webhook endpoint not found")
        if endpoint.key_version != self.secrets.key_version:
            raise ConflictError("webhook_key_unavailable", "Webhook secret is unavailable")
        try:
            secret = self.secrets.decrypt(endpoint.encrypted_signing_secret, endpoint.key_version)
            valid = (
                secret.get("purpose") == "webhook"
                and secret.get("endpoint") == public_id
                and isinstance(secret.get("secret"), str)
            )
        except Exception as error:
            raise ConflictError(
                "webhook_secret_unavailable", "Webhook secret is unavailable"
            ) from error
        if not valid:
            raise ConflictError("webhook_secret_unavailable", "Webhook secret is unavailable")
        expected = hmac.new(str(secret["secret"]).encode(), body, sha256).hexdigest()
        if not hmac.compare_digest(expected, signature.removeprefix("sha256=")):
            raise ApplicationError("invalid_webhook_signature", "Invalid webhook signature", 401)
        duplicate = await self.repository.delivery(endpoint.id, event_id)
        if duplicate is not None:
            return duplicate
        try:
            payload = json.loads(body)
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise ApplicationError(
                "invalid_webhook_json", "Webhook body must be JSON", 400
            ) from error
        if not isinstance(payload, dict):
            raise ApplicationError("invalid_webhook_json", "Webhook body must be an object", 400)
        value = WebhookDelivery(
            uuid4(), endpoint.workspace_id, endpoint.id, event_id, payload, True, self.clock.now()
        )
        try:
            result = await self.repository.insert_delivery(value)
            await self.repository.commit()
            if self.publisher is not None:
                try:
                    self.publisher.publish(result.id)
                except Exception:  # noqa: BLE001 -- committed pending delivery is the durable outbox.
                    # The committed pending row is the durable outbox for the periodic scanner.
                    return result
            return result
        except Exception as error:
            await self.repository.rollback()
            if error.__class__.__name__ == "IntegrityError":
                duplicate = await self.repository.delivery(endpoint.id, event_id)
                if duplicate is not None:
                    return duplicate
            raise
