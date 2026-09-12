"""Explicit persistence, transaction, time, token and delivery boundaries."""

from datetime import datetime
from typing import Protocol
from uuid import UUID

from .domain import (
    InvitationProjection,
    InviterAuthority,
    MemberDetailProjection,
    MemberProjection,
    OrganizationRecord,
    OrganizationSnapshot,
    RoleProjection,
    RoleRecord,
    TeamProjection,
    TeamRecord,
    WorkspaceGrant,
    WorkspaceOptionProjection,
)


class Clock(Protocol):
    def now(self) -> datetime: ...


class InvitationTokens(Protocol):
    def new_token(self) -> str: ...
    def digest(self, token: str) -> bytes: ...


class InvitationEmail(Protocol):
    async def send_organization_invitation(
        self, email: str, organization_id: UUID, token: str
    ) -> None: ...


class OrganizationRepository(Protocol):
    async def get_organization(self, organization_id: UUID) -> OrganizationRecord | None: ...
    async def list_members(
        self, organization_id: UUID, *, search: str, status: str | None
    ) -> list[MemberProjection]: ...
    async def member_detail(
        self, organization_id: UUID, user_id: UUID
    ) -> MemberDetailProjection | None: ...
    async def list_roles(self, organization_id: UUID) -> list[RoleProjection]: ...
    async def list_teams(self, organization_id: UUID) -> list[TeamProjection]: ...
    async def list_invitations(
        self, organization_id: UUID, now: datetime
    ) -> list[InvitationProjection]: ...
    async def lock_snapshot(self, organization_id: UUID) -> OrganizationSnapshot: ...
    async def find_invitation_id_by_digest(
        self, organization_id: UUID, digest: bytes
    ) -> UUID | None: ...
    async def inviter_authority(
        self,
        organization_id: UUID,
        user_id: UUID,
        workspace_ids: tuple[UUID, ...],
    ) -> InviterAuthority: ...
    async def list_workspace_options(
        self, organization_id: UUID
    ) -> list[WorkspaceOptionProjection]: ...
    async def list_audit(self, organization_id: UUID) -> list[dict[str, object]]: ...
    async def create_with_owner(
        self, *, organization_id: UUID, name: str, slug: str, owner_id: UUID
    ) -> None: ...
    async def update_organization(
        self, organization_id: UUID, *, name: str, slug: str | None, expected_revision: int
    ) -> None: ...
    async def soft_delete_organization(
        self, organization_id: UUID, deleted_at: datetime
    ) -> None: ...
    async def update_member(
        self, organization_id: UUID, user_id: UUID, *, role_id: UUID, status: str
    ) -> None: ...
    async def remove_member_grants(self, organization_id: UUID, user_id: UUID) -> None: ...
    async def transfer_ownership(
        self, organization_id: UUID, *, previous_owner_id: UUID, next_owner_id: UUID
    ) -> None: ...
    async def save_role(self, organization_id: UUID, role: RoleRecord) -> None: ...
    async def delete_role(self, organization_id: UUID, role_id: UUID) -> None: ...
    async def set_workspace_member(
        self, organization_id: UUID, workspace_id: UUID, user_id: UUID, role_id: UUID | None
    ) -> None: ...
    async def save_team(self, organization_id: UUID, team: TeamRecord) -> None: ...
    async def delete_team(self, organization_id: UUID, team_id: UUID) -> None: ...
    async def set_team_member(
        self, organization_id: UUID, team_id: UUID, user_id: UUID, present: bool
    ) -> None: ...
    async def set_team_workspace_grant(
        self,
        organization_id: UUID,
        team_id: UUID,
        grant: WorkspaceGrant | None,
        workspace_id: UUID,
    ) -> None: ...
    async def create_invitation(
        self,
        *,
        invitation_id: UUID,
        organization_id: UUID,
        email: str,
        role_id: UUID,
        invited_by: UUID,
        grants: tuple[WorkspaceGrant, ...],
        digest: bytes,
        expires_at: datetime,
    ) -> None: ...
    async def replace_invitation_token(
        self, invitation_id: UUID, *, digest: bytes, expires_at: datetime
    ) -> None: ...
    async def cancel_invitation(self, invitation_id: UUID, cancelled_at: datetime) -> None: ...
    async def accept_invitation(
        self, invitation_id: UUID, *, user_id: UUID, accepted_at: datetime
    ) -> None: ...
    async def append_audit(
        self,
        *,
        organization_id: UUID,
        actor_user_id: UUID,
        action: str,
        target_type: str,
        target_id: str,
        occurred_at: datetime,
        metadata: dict[str, object],
    ) -> None: ...
    async def commit(self) -> None: ...
    async def rollback(self) -> None: ...
