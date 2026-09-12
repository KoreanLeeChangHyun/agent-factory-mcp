from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol
from uuid import UUID

from agent_factory_core.shared.errors import NotFoundError


@dataclass(frozen=True, slots=True)
class AdminConnection:
    id: UUID
    workspace_id: UUID
    provider_id: UUID
    name: str
    status: str
    last_error_code: str | None
    created_at: datetime


class ConnectionAdministrationRepository(Protocol):
    async def list_connections(self, *, limit: int) -> list[AdminConnection]: ...
    async def disconnect(self, connection_id: UUID) -> AdminConnection | None: ...
    async def commit(self) -> None: ...
    async def rollback(self) -> None: ...


class ConnectionAdministration:
    def __init__(self, repository: ConnectionAdministrationRepository) -> None:
        self._repository = repository

    async def connections(self) -> list[AdminConnection]:
        return await self._repository.list_connections(limit=200)

    async def disconnect(self, connection_id: UUID) -> AdminConnection:
        try:
            connection = await self._repository.disconnect(connection_id)
            if connection is None:
                raise NotFoundError(
                    "integration_connection_not_found", "Integration connection not found"
                )
            await self._repository.commit()
            return connection
        except Exception:
            await self._repository.rollback()
            raise
