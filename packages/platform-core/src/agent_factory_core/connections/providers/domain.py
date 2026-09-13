from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from uuid import UUID


class ProviderAuthType(StrEnum):
    OAUTH2 = "oauth2"
    API_KEY = "api_key"
    SERVICE_ACCOUNT = "service_account"


class ConnectionStatus(StrEnum):
    PENDING = "pending"
    ACTIVE = "active"
    DEGRADED = "degraded"
    DISCONNECTED = "disconnected"


@dataclass(frozen=True, slots=True)
class Provider:
    id: UUID
    key: str
    display_name: str
    auth_type: ProviderAuthType
    capabilities: tuple[str, ...]
    configuration_schema: dict[str, object]
    is_enabled: bool


@dataclass(frozen=True, slots=True)
class ProviderConnection:
    id: UUID
    workspace_id: UUID
    provider_id: UUID
    name: str
    status: ConnectionStatus
    revision: int = 1
    external_account_id: str | None = None
    last_synced_at: datetime | None = None
    last_error_code: str | None = None
    credentials_present: bool = False
