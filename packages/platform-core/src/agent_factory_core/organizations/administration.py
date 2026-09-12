from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol
from uuid import UUID

from agent_factory_core.shared.errors import NotFoundError


@dataclass(frozen=True, slots=True)
class AdminOrganization:
    id: UUID
    name: str
    slug: str
    is_personal: bool
    created_at: datetime


class OrganizationAdministrationRepository(Protocol):
    async def list_organizations(self, *, limit: int) -> list[AdminOrganization]: ...
    async def grant_owner(self, *, organization_id: UUID, user_id: UUID) -> bool: ...
    async def commit(self) -> None: ...
    async def rollback(self) -> None: ...


class OrganizationAdministration:
    def __init__(self, repository: OrganizationAdministrationRepository) -> None:
        self._repository = repository

    async def organizations(self) -> list[AdminOrganization]:
        return await self._repository.list_organizations(limit=200)

    async def grant_owner(self, organization_id: UUID, user_id: UUID) -> None:
        try:
            if not await self._repository.grant_owner(
                organization_id=organization_id, user_id=user_id
            ):
                raise NotFoundError(
                    "organization_or_user_not_found", "Organization or user not found"
                )
            await self._repository.commit()
        except Exception:
            await self._repository.rollback()
            raise
