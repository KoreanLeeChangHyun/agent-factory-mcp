import hashlib
import hmac
from dataclasses import replace
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from agent_factory_core.connections.providers.webhooks import (
    ProviderWebhookUseCases,
    WebhookDeliveryError,
    WebhookDeliveryStatus,
)
from agent_factory_core.identity.authorization import AuthorizationScope, AuthorizedContext
from agent_factory_core.identity.domain import Principal
from agent_factory_core.shared.errors import ApplicationError


class Clock:
    def now(self):
        return datetime(2026, 9, 13, tzinfo=UTC)


class Secrets:
    key_version = 1

    def __init__(self):
        self.values = {}
        self.counter = 0

    def issue(self):
        self.counter += 1
        return f"opaque-{self.counter}"

    def encrypt(self, value):
        cipher = f"cipher-{self.counter}".encode()
        self.values[cipher] = value
        return cipher

    def decrypt(self, value, key_version):
        return self.values[value]


class Repository:
    def __init__(self):
        self.endpoint = None
        self.deliveries = {}
        self.insert_attempts = 0

    async def connection_exists(self, workspace_id, connection_id):
        return True

    async def insert_endpoint(self, value):
        self.endpoint = value
        return value

    async def endpoint_by_public_id(self, public_id):
        return self.endpoint if self.endpoint and self.endpoint.public_id == public_id else None

    async def delivery(self, endpoint_id, event_id):
        return self.deliveries.get((endpoint_id, event_id))

    async def insert_delivery(self, value):
        self.insert_attempts += 1
        self.deliveries[(value.endpoint_id, value.provider_event_id)] = value
        return value

    async def claim_delivery(self, workspace_id, delivery_id, now):
        value = next((row for row in self.deliveries.values() if row.id == delivery_id), None)
        if value is None:
            return None
        claimed = replace(
            value,
            status=WebhookDeliveryStatus.PROCESSING,
            attempt_count=value.attempt_count + 1,
        )
        self.deliveries[(claimed.endpoint_id, claimed.provider_event_id)] = claimed
        return claimed

    async def save_delivery(self, value):
        self.deliveries[(value.endpoint_id, value.provider_event_id)] = value
        return value

    async def commit(self):
        pass

    async def rollback(self):
        pass


@pytest.mark.asyncio
async def test_signature_is_verified_before_payload_is_persisted_and_duplicate_is_idempotent() -> (
    None
):
    workspace_id, connection_id = uuid4(), uuid4()
    context = AuthorizedContext(
        Principal(uuid4(), "owner@example.test", "Owner", False),
        AuthorizationScope(uuid4(), workspace_id),
        frozenset({"integration.update"}),
    )
    repository, secrets = Repository(), Secrets()
    service = ProviderWebhookUseCases(repository, secrets, Clock(), "https://factory.example", 1024)
    created = await service.create(context, connection_id)
    body = b'{"event":"created"}'

    with pytest.raises(ApplicationError, match="invalid_webhook_signature"):
        await service.accept(str(created["public_id"]), "event-1", body, "sha256=wrong")
    with pytest.raises(ApplicationError, match="invalid_webhook_signature"):
        await service.accept(str(created["public_id"]), "event-1", body, "sha256=\u00e9")
    assert repository.insert_attempts == 0

    signature = hmac.new(str(created["signing_secret"]).encode(), body, hashlib.sha256).hexdigest()
    first = await service.accept(str(created["public_id"]), "event-1", body, f"sha256={signature}")
    repeated = await service.accept(
        str(created["public_id"]), "event-1", body, f"sha256={signature}"
    )

    assert repeated == first
    assert repository.insert_attempts == 1


class FailingSender:
    async def send(self, delivery):
        raise WebhookDeliveryError("private upstream detail")


@pytest.mark.asyncio
async def test_delivery_attempts_retry_then_become_dead_with_sanitized_error() -> None:
    workspace_id, connection_id = uuid4(), uuid4()
    context = AuthorizedContext(
        Principal(uuid4(), "owner@example.test", "Owner", False),
        AuthorizationScope(uuid4(), workspace_id),
        frozenset({"integration.update", "integration.use"}),
    )
    repository, secrets = Repository(), Secrets()
    service = ProviderWebhookUseCases(repository, secrets, Clock(), "https://factory.example", 1024)
    created = await service.create(context, connection_id)
    body = b'{"event":"created"}'
    signature = hmac.new(str(created["signing_secret"]).encode(), body, hashlib.sha256).hexdigest()
    delivery = await service.accept(str(created["public_id"]), "event-2", body, signature)

    failed = await service.process(context, delivery.id, FailingSender(), max_attempts=2)
    dead = await service.process(context, delivery.id, FailingSender(), max_attempts=2)

    assert failed.status == WebhookDeliveryStatus.FAILED
    assert failed.last_error == "webhook_delivery_failed"
    assert dead.status == WebhookDeliveryStatus.DEAD
    assert "private upstream detail" not in str(dead)
