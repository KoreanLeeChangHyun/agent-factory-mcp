from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol
from uuid import UUID

from agent_factory_core.shared.errors import NotFoundError


@dataclass(frozen=True, slots=True)
class AdminWorkspace:
    id: UUID
    organization_id: UUID
    name: str
    slug: str
    status: str
    created_at: datetime


class WorkspaceAdministrationRepository(Protocol):
    async def list_workspaces(self, *, limit: int) -> list[AdminWorkspace]: ...
    async def grant_owner(self, *, workspace_id: UUID, user_id: UUID) -> bool: ...
    async def commit(self) -> None: ...
    async def rollback(self) -> None: ...


class WorkspaceAdministration:
    def __init__(self, repository: WorkspaceAdministrationRepository) -> None:
        self._repository = repository

    async def workspaces(self) -> list[AdminWorkspace]:
        return await self._repository.list_workspaces(limit=200)

    async def grant_owner(self, workspace_id: UUID, user_id: UUID) -> None:
        try:
            if not await self._repository.grant_owner(workspace_id=workspace_id, user_id=user_id):
                raise NotFoundError("workspace_or_user_not_found", "Workspace or user not found")
            await self._repository.commit()
        except Exception:
            await self._repository.rollback()
            raise
