"""Immutable identity records used across HTTP, MCP, and workers."""

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from uuid import UUID


class UserStatus(StrEnum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    DEACTIVATED = "deactivated"


@dataclass(frozen=True, slots=True)
class Principal:
    user_id: UUID
    email: str
    display_name: str
    is_platform_admin: bool


@dataclass(frozen=True, slots=True)
class UserRecord:
    id: UUID
    email: str
    display_name: str
    is_platform_admin: bool
    status: UserStatus
    email_verified_at: datetime | None = None


@dataclass(frozen=True, slots=True)
class CredentialRecord:
    user_id: UUID
    password_hash: str
    failed_attempts: int
    locked_until: datetime | None


@dataclass(frozen=True, slots=True)
class PasswordLoginRecord:
    user: UserRecord
    credential: CredentialRecord


@dataclass(frozen=True, slots=True)
class SessionRecord:
    id: UUID
    user_id: UUID
    created_at: datetime
    expires_at: datetime
    revoked_at: datetime | None
    user_agent: str | None


@dataclass(frozen=True, slots=True)
class ApiTokenRecord:
    id: UUID
    user_id: UUID
    name: str
    scopes: tuple[str, ...]
    created_at: datetime
    expires_at: datetime | None
    last_used_at: datetime | None
    revoked_at: datetime | None


@dataclass(frozen=True, slots=True)
class ResolvedApiToken:
    user: UserRecord
    token: ApiTokenRecord


@dataclass(frozen=True, slots=True)
class LoginResult:
    principal: Principal
    session_token: str


@dataclass(frozen=True, slots=True)
class ExternalProfile:
    provider: str
    subject: str
    email: str
    display_name: str
