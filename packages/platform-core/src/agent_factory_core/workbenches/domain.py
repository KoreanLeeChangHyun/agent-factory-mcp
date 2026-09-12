from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from types import MappingProxyType
from uuid import UUID


class WorkbenchDefinitionState(StrEnum):
    DRAFT = "draft"
    ARCHIVED = "archived"


@dataclass(frozen=True, slots=True)
class WorkbenchActor:
    user_id: UUID
    organization_id: UUID
    workspace_id: UUID
    permissions: frozenset[str]


@dataclass(frozen=True, slots=True)
class WorkbenchDefinitionAggregate:
    id: UUID
    organization_id: UUID
    workspace_id: UUID
    key: str
    title: str
    state: WorkbenchDefinitionState
    revision: int
    draft: Mapping[str, object]
    latest_release_id: UUID | None
    created_by: UUID
    updated_by: UUID
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None = None

    def __post_init__(self) -> None:
        object.__setattr__(self, "draft", MappingProxyType(dict(self.draft)))


@dataclass(frozen=True, slots=True)
class WorkbenchRelease:
    id: UUID
    organization_id: UUID
    workspace_id: UUID
    definition_id: UUID
    definition_revision: int
    release_number: int
    schema_version: str
    schema_digest: str
    asset_version: str
    definition_digest: str
    snapshot: Mapping[str, object]
    published_by: UUID
    published_at: datetime

    def __post_init__(self) -> None:
        object.__setattr__(self, "snapshot", MappingProxyType(dict(self.snapshot)))


@dataclass(frozen=True, slots=True)
class ValidatedWorkbench:
    definition: Mapping[str, object]
    schema_version: str
    schema_digest: str
    asset_version: str
    definition_digest: str

    def __post_init__(self) -> None:
        object.__setattr__(self, "definition", MappingProxyType(dict(self.definition)))
