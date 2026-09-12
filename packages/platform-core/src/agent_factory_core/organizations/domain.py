"""Organization application records independent of persistence and transport."""

from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import NotRequired, TypedDict
from uuid import UUID


class MembershipStatus(StrEnum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    REMOVED = "removed"


class RoleScope(StrEnum):
    ORGANIZATION = "organization"
    WORKSPACE = "workspace"


@dataclass(frozen=True, slots=True)
class OrganizationRecord:
    id: UUID
    name: str
    slug: str
    is_personal: bool
    revision: int
    deleted_at: datetime | None = None


@dataclass(frozen=True, slots=True)
class MemberRecord:
    user_id: UUID
    email: str
    display_name: str
    role_id: UUID
    status: MembershipStatus
    joined_at: datetime


@dataclass(frozen=True, slots=True)
class RoleRecord:
    id: UUID
    organization_id: UUID | None
    name: str
    scope: RoleScope
    permissions: frozenset[str]
    is_system: bool = False


@dataclass(frozen=True, slots=True)
class WorkspaceGrant:
    workspace_id: UUID
    role_id: UUID


@dataclass(frozen=True, slots=True)
class TeamRecord:
    id: UUID
    name: str
    description: str
    members: frozenset[UUID] = frozenset()
    grants: tuple[WorkspaceGrant, ...] = ()


@dataclass(frozen=True, slots=True)
class InvitationRecord:
    id: UUID
    organization_id: UUID
    email: str
    role_id: UUID | None
    invited_by: UUID
    workspace_grants: tuple[WorkspaceGrant, ...]
    expires_at: datetime
    accepted_at: datetime | None = None
    cancelled_at: datetime | None = None

    @property
    def pending(self) -> bool:
        return self.accepted_at is None and self.cancelled_at is None


@dataclass(frozen=True, slots=True)
class InviterAuthority:
    principal_active: bool
    is_owner: bool
    organization_permissions: frozenset[str]
    workspace_permissions: dict[UUID, frozenset[str]]
    active_workspaces: frozenset[UUID]


@dataclass(frozen=True, slots=True)
class OrganizationSnapshot:
    organization: OrganizationRecord
    members: tuple[MemberRecord, ...] = ()
    roles: tuple[RoleRecord, ...] = ()
    teams: tuple[TeamRecord, ...] = ()
    invitations: tuple[InvitationRecord, ...] = ()
    active_workspace_owner_counts: dict[UUID, dict[UUID, int]] = field(default_factory=dict)
    active_workspace_ids: frozenset[UUID] = frozenset()
    direct_workspace_roles: dict[UUID, dict[UUID, UUID]] = field(default_factory=dict)

    def member(self, user_id: UUID) -> MemberRecord | None:
        return next((item for item in self.members if item.user_id == user_id), None)

    def role(self, role_id: UUID) -> RoleRecord | None:
        return next((item for item in self.roles if item.id == role_id), None)


class MemberProjection(TypedDict):
    user_id: UUID
    email: str
    name: str
    role_id: UUID
    role_name: str
    status: MembershipStatus
    joined_at: datetime


class PermissionSourceProjection(TypedDict):
    source: str
    role_id: UUID
    role_name: str
    permissions: list[str]
    team_id: NotRequired[UUID]
    team_name: NotRequired[str]


class WorkspaceAccessProjection(TypedDict):
    workspace_id: UUID
    name: str
    sources: list[PermissionSourceProjection]
    permissions: list[str]


class MemberDetailProjection(TypedDict):
    user_id: UUID
    name: str
    email: str
    role_id: UUID
    status: MembershipStatus
    teams: list[dict[str, object]]
    workspaces: list[WorkspaceAccessProjection]
    organization_sources: list[PermissionSourceProjection]


class RoleProjection(TypedDict):
    id: UUID
    name: str
    scope: RoleScope
    is_system: bool
    permissions: list[str]


class TeamProjection(TypedDict):
    id: UUID
    name: str
    description: str
    members: list[UUID]
    workspaces: list[dict[str, UUID]]


class InvitationProjection(TypedDict):
    id: UUID
    email: str
    role_id: UUID | None
    workspace_grants: list[dict[str, str]]
    expires_at: datetime
    status: str


class WorkspaceOptionProjection(TypedDict):
    id: UUID
    name: str
    permissions: NotRequired[list[str]]
