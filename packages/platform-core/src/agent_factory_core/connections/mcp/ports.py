from __future__ import annotations

from datetime import datetime
from typing import Protocol
from uuid import UUID

from .domain import MCPConnection


class MCPConnectionRepository(Protocol):
    async def workspace_available(self, organization_id: UUID, workspace_id: UUID) -> bool: ...
    async def create(
        self,
        *,
        connection_id: UUID,
        user_id: UUID,
        organization_id: UUID,
        workspace_id: UUID,
        name: str,
        token_digest: bytes,
        scopes: tuple[str, ...],
        expires_at: datetime,
        encrypted_token: bytes,
        key_version: int,
    ) -> MCPConnection: ...
    async def list_owned(
        self, user_id: UUID, organization_id: UUID, workspace_id: UUID, now: datetime
    ) -> list[MCPConnection]: ...
    async def encrypted_secret(
        self,
        connection_id: UUID,
        user_id: UUID,
        organization_id: UUID,
        workspace_id: UUID,
        now: datetime,
    ) -> tuple[MCPConnection, bytes, int, bytes] | None: ...
    async def revoke(
        self,
        connection_id: UUID,
        user_id: UUID,
        organization_id: UUID,
        workspace_id: UUID,
        now: datetime,
    ) -> bool: ...
    async def purge(
        self, connection_id: UUID, user_id: UUID, organization_id: UUID, workspace_id: UUID
    ) -> str: ...
    async def commit(self) -> None: ...
    async def rollback(self) -> None: ...


class TokenSecrets(Protocol):
    @property
    def key_version(self) -> int: ...
    def issue(self) -> str: ...
    def digest(self, plaintext: str) -> bytes: ...
    def encrypt(self, value: dict[str, object]) -> bytes: ...
    def decrypt(self, ciphertext: bytes, key_version: int) -> dict[str, object]: ...


class Clock(Protocol):
    def now(self) -> datetime: ...
