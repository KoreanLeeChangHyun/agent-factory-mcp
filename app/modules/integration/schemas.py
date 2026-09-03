"""Integration catalog and connection API schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.modules.integration.models import ConnectionStatus, IntegrationAuthType


class ProviderResponse(BaseModel):
    id: UUID
    key: str
    display_name: str
    auth_type: IntegrationAuthType
    capabilities: list[str]
    configuration_schema: dict[str, object]


class ConnectionCreate(BaseModel):
    provider_id: UUID
    name: str = Field(min_length=1, max_length=160)
    credentials: dict[str, object] | None = None


class ConnectionResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    provider_id: UUID
    name: str
    status: ConnectionStatus
    external_account_id: str | None
    sync_cursor: dict[str, object]
    last_synced_at: datetime | None
    last_error_code: str | None
    revision: int
    created_at: datetime
    updated_at: datetime


class CursorUpdate(BaseModel):
    cursor: dict[str, object] = Field(default_factory=dict)


class OAuthBeginResponse(BaseModel):
    state: str
    code_challenge: str
    expires_at: datetime


class WebhookEndpointCreated(BaseModel):
    public_id: str
    signing_secret: str
    url: str
