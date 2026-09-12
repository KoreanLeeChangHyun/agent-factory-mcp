from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol
from uuid import UUID


@dataclass(frozen=True, slots=True)
class AdminAuditEvent:
    id: UUID
    occurred_at: datetime
    actor_user_id: UUID | None
    organization_id: UUID | None
    workspace_id: UUID | None
    action: str
    target_type: str | None
    target_id: str | None
    outcome: str
    request_id: str | None
    source: str
    event_metadata: Mapping[str, object]


class AuditAdministrationRepository(Protocol):
    async def list_events(self, *, limit: int) -> list[AdminAuditEvent]: ...


class AuditAdministration:
    def __init__(self, repository: AuditAdministrationRepository) -> None:
        self._repository = repository

    async def events(self) -> list[AdminAuditEvent]:
        return await self._repository.list_events(limit=200)
