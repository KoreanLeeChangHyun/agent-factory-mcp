from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from enum import StrEnum
from types import MappingProxyType
from uuid import UUID


class ThemeBase(StrEnum):
    DARK = "dark"
    LIGHT = "light"
    HIGH_CONTRAST = "high-contrast"


class ThemeDensity(StrEnum):
    COMPACT = "compact"
    COMFORTABLE = "comfortable"


@dataclass(frozen=True, slots=True)
class ThemeProfile:
    user_id: UUID
    revision: int
    base: ThemeBase
    density: ThemeDensity
    overrides: Mapping[str, str] = field(default_factory=dict)
    reduced_motion: bool = False

    @classmethod
    def default(cls, user_id: UUID) -> ThemeProfile:
        return cls(
            user_id=user_id,
            revision=0,
            base=ThemeBase.DARK,
            density=ThemeDensity.COMPACT,
            overrides=MappingProxyType({}),
            reduced_motion=False,
        )


@dataclass(frozen=True, slots=True)
class ThemeUpdate:
    base: ThemeBase
    density: ThemeDensity
    overrides: Mapping[str, str]
    reduced_motion: bool
    expected_revision: int
