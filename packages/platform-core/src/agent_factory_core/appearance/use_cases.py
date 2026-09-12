from __future__ import annotations

from uuid import UUID

from .domain import ThemeProfile, ThemeUpdate
from .ports import ThemeProfileRepository, ThemeProfileValidator


class GetThemeProfile:
    def __init__(self, repository: ThemeProfileRepository) -> None:
        self.repository = repository

    async def execute(self, user_id: UUID) -> ThemeProfile:
        return await self.repository.get(user_id) or ThemeProfile.default(user_id)


class SaveThemeProfile:
    def __init__(
        self, repository: ThemeProfileRepository, validator: ThemeProfileValidator
    ) -> None:
        self.repository = repository
        self.validator = validator

    async def execute(self, user_id: UUID, update: ThemeUpdate) -> ThemeProfile:
        self.validator.validate(update)
        return await self.repository.save(user_id, update)
