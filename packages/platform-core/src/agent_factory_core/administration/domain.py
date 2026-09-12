from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True, slots=True)
class Dashboard:
    users: int
    organizations: int
    workspaces: int
    jobs: int
    integrations: int


@dataclass(frozen=True, slots=True)
class FeatureFlag:
    key: str
    is_enabled: bool
    description: str
    rules: Mapping[str, object]
    updated_at: datetime


@dataclass(frozen=True, slots=True)
class RuntimeInfo:
    application_version: str
    migration_version: str | None
    environment: str
    debug: bool
    embedding_provider: str
