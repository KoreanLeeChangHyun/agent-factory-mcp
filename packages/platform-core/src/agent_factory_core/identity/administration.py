from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol
from uuid import UUID

from agent_factory_core.shared.errors import ConflictError, NotFoundError

from .domain import Principal, UserStatus
from .ports import Clock


@dataclass(frozen=True, slots=True)
class AdminUser:
    id: UUID
    email: str
    display_name: str
    status: UserStatus
    is_platform_admin: bool
    created_at: datetime
    revision: int


class IdentityAdministrationRepository(Protocol):
    async def list_users(self, *, limit: int) -> list[AdminUser]: ...
    async def set_user_status(
        self, *, user_id: UUID, status: UserStatus, expected_revision: int | None
    ) -> AdminUser | None: ...
    async def revoke_sessions(self, *, user_id: UUID, revoked_at: datetime) -> int | None: ...
    async def commit(self) -> None: ...
    async def rollback(self) -> None: ...


class IdentityAdministration:
    def __init__(self, repository: IdentityAdministrationRepository, clock: Clock) -> None:
        self._repository = repository
        self._clock = clock

    async def users(self) -> list[AdminUser]:
        return await self._repository.list_users(limit=200)

    async def set_user_status(
        self,
        principal: Principal,
        user_id: UUID,
        status: UserStatus,
        expected_revision: int | None = None,
    ) -> AdminUser:
        if user_id == principal.user_id and status is not UserStatus.ACTIVE:
            raise ConflictError("admin_self_lockout", "Administrator cannot suspend itself")
        try:
            user = await self._repository.set_user_status(
                user_id=user_id, status=status, expected_revision=expected_revision
            )
            if user is None:
                raise NotFoundError("user_not_found", "User not found")
            await self._repository.commit()
            return user
        except Exception:
            await self._repository.rollback()
            raise

    async def revoke_sessions(self, user_id: UUID) -> int:
        try:
            now = self._clock.now()
            count = await self._repository.revoke_sessions(user_id=user_id, revoked_at=now)
            if count is None:
                raise NotFoundError("user_not_found", "User not found")
            await self._repository.commit()
            return count
        except Exception:
            await self._repository.rollback()
            raise
