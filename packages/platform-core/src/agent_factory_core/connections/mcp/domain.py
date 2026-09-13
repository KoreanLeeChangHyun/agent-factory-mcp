from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from uuid import UUID


class MCPConnectionState(StrEnum):
    PENDING = "pending"
    VERIFIED = "verified"
    REAUTH_REQUIRED = "reauth_required"


@dataclass(frozen=True, slots=True)
class MCPConnection:
    id: UUID
    user_id: UUID
    organization_id: UUID
    workspace_id: UUID
    token_id: UUID
    name: str
    state: MCPConnectionState
    retrievable: bool
    expires_at: datetime | None
    client_name: str | None = None
    first_confirmed_at: datetime | None = None
    last_seen_at: datetime | None = None
    reason: str | None = None


@dataclass(frozen=True, slots=True)
class IssuedMCPConnection:
    connection: MCPConnection
    plaintext_token: str
