"""Integration secret, OAuth, and webhook security tests."""

import hmac
from hashlib import sha256
from uuid import UUID

import pytest
from cryptography.exceptions import InvalidTag
from pydantic import SecretStr

from app.common.errors import ApplicationError
from app.core.config import Settings
from app.infrastructure.secret_encryption import SecretCipher
from app.modules.integration.models import WebhookEndpoint
from app.modules.integration.service import IntegrationService

WORKSPACE_ID = UUID("33333333-3333-4333-8333-333333333333")
ENDPOINT_ID = UUID("44444444-4444-4444-8444-444444444444")


def settings() -> Settings:
    return Settings(
        environment="test",
        auth_token_secret=SecretStr("test-auth-secret"),
        integration_encryption_key=SecretStr("test-integration-secret"),
    )


def test_secret_cipher_round_trip_and_tamper_detection() -> None:
    cipher = SecretCipher("secret material", 3)
    encrypted = cipher.encrypt({"access_token": "hidden", "expires": 123})

    assert b"hidden" not in encrypted
    assert cipher.decrypt_json(encrypted) == {"access_token": "hidden", "expires": 123}

    damaged = encrypted[:-1] + bytes([encrypted[-1] ^ 1])
    with pytest.raises(InvalidTag):
        cipher.decrypt_json(damaged)


class FakeWebhookRepository:
    def __init__(self, endpoint: WebhookEndpoint) -> None:
        self.endpoint = endpoint
        self.delivery: object | None = None
        self.commits = 0

    async def get_webhook_endpoint(self, public_id: str) -> WebhookEndpoint | None:
        return self.endpoint if public_id == self.endpoint.public_id else None

    async def find_delivery(self, endpoint_id: UUID, event_id: str) -> object | None:
        del endpoint_id, event_id
        return self.delivery

    async def create_delivery(self, delivery: object) -> None:
        self.delivery = delivery

    async def commit(self) -> None:
        self.commits += 1


@pytest.mark.asyncio
async def test_webhook_signature_is_verified_before_delivery_creation() -> None:
    cipher = SecretCipher("secret material", 1)
    endpoint = WebhookEndpoint(
        id=ENDPOINT_ID,
        workspace_id=WORKSPACE_ID,
        connection_id=UUID("55555555-5555-4555-8555-555555555555"),
        public_id="public-endpoint",
        encrypted_signing_secret=cipher.encrypt({"secret": "webhook-secret"}),
        encryption_key_version=1,
        is_active=True,
    )
    repository = FakeWebhookRepository(endpoint)
    service = IntegrationService(repository, cipher, settings())  # type: ignore[arg-type]
    payload = b'{"action":"updated"}'
    signature = hmac.new(b"webhook-secret", payload, sha256).hexdigest()

    delivery = await service.accept_webhook(
        "public-endpoint", "event-1", payload, f"sha256={signature}"
    )

    assert delivery.signature_verified is True
    assert delivery.workspace_id == WORKSPACE_ID
    assert repository.commits == 1


@pytest.mark.asyncio
async def test_invalid_webhook_signature_does_not_persist_payload() -> None:
    cipher = SecretCipher("secret material", 1)
    endpoint = WebhookEndpoint(
        id=ENDPOINT_ID,
        workspace_id=WORKSPACE_ID,
        connection_id=UUID("55555555-5555-4555-8555-555555555555"),
        public_id="public-endpoint",
        encrypted_signing_secret=cipher.encrypt({"secret": "webhook-secret"}),
        encryption_key_version=1,
        is_active=True,
    )
    repository = FakeWebhookRepository(endpoint)
    service = IntegrationService(repository, cipher, settings())  # type: ignore[arg-type]

    with pytest.raises(ApplicationError, match="signature"):
        await service.accept_webhook("public-endpoint", "event-1", b"{}", "wrong")

    assert repository.delivery is None
