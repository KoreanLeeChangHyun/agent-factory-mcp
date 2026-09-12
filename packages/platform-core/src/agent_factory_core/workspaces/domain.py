"""Workspace, group and repository identity records."""

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from uuid import UUID


class WorkspaceStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"


@dataclass(frozen=True, slots=True)
class WorkspaceRecord:
    id: UUID
    organization_id: UUID
    name: str
    slug: str
    status: WorkspaceStatus
    revision: int
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


@dataclass(frozen=True, slots=True)
class WorkspaceGroupRecord:
    id: UUID
    organization_id: UUID
    user_id: UUID
    name: str
    collapsed: bool
    revision: int
    workspace_ids: tuple[UUID, ...] = ()


@dataclass(frozen=True, slots=True)
class RepositoryRecord:
    id: UUID
    workspace_id: UUID
    location: str
    remote_url: str | None
    metadata: dict[str, object]
    deleted_at: datetime | None = None

    @property
    def repository_metadata(self) -> dict[str, object]:
        """Compatibility projection for the deployed API response field."""
        return self.metadata

    @property
    def canonical_location(self) -> str:
        """Compatibility projection for the deployed API response field."""
        return self.location


@dataclass(frozen=True, slots=True)
class OrganizationSummary:
    id: UUID
    name: str
    slug: str
    is_personal: bool


@dataclass(frozen=True, slots=True)
class OrganizationUserRecord:
    id: UUID
    email: str
    display_name: str


@dataclass(frozen=True, slots=True)
class WorkspaceRoleRecord:
    id: UUID
    name: str
