from __future__ import annotations

from typing import Protocol
from uuid import UUID

from .domain import ThemeProfile, ThemeUpdate


class ThemeProfileRepository(Protocol):
    async def get(self, user_id: UUID) -> ThemeProfile | None: ...

    async def save(self, user_id: UUID, update: ThemeUpdate) -> ThemeProfile: ...


class ThemeProfileValidator(Protocol):
    def validate(self, update: ThemeUpdate) -> None: ...
