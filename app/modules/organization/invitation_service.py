"""Compatibility invitation delivery signatures backed by the core use case."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol
from uuid import UUID

from agent_factory_core.organizations import WorkspaceGrant
from agent_factory_core.shared.errors import ConflictError

from app.modules.organization.command_service import OrganizationCommandService
from app.modules.organization.schemas import InvitationCreate


class InvitationSender(Protocol):
    async def send_organization_invitation(
        self, email: str, organization_id: UUID, token: str
    ) -> None: ...


@dataclass(frozen=True, slots=True)
class InvitationDelivery:
    id: UUID
    email: str
    expires_at: datetime


class OrganizationInvitationService:
    def __init__(self, organizations: OrganizationCommandService, sender: InvitationSender) -> None:
        self.organizations = organizations
        self.sender = sender

    async def create(self, payload: InvitationCreate) -> InvitationDelivery:
        workspace_ids = tuple(grant.workspace_id for grant in payload.workspace_grants)
        invitation_id, expires_at = await self.organizations._target(self.sender).invite(
            self.organizations.organization_id,
            await self.organizations._actor(workspace_ids),
            email=str(payload.email),
            role_id=payload.role_id,
            grants=tuple(
                WorkspaceGrant(grant.workspace_id, grant.role_id)
                for grant in payload.workspace_grants
            ),
        )
        return InvitationDelivery(invitation_id, str(payload.email), expires_at)

    async def resend(self, invitation_id: UUID) -> InvitationDelivery:
        await self.organizations._all_workspace_ids()
        snapshot = await self.organizations._target(self.sender).repository.lock_snapshot(
            self.organizations.organization_id
        )
        invitation = next((item for item in snapshot.invitations if item.id == invitation_id), None)
        if invitation is None:
            raise ConflictError("invitation_closed", "재전송할 수 없는 초대입니다.")
        workspace_ids = tuple(grant.workspace_id for grant in invitation.workspace_grants)
        expires_at = await self.organizations._target(self.sender).resend_invitation(
            self.organizations.organization_id,
            await self.organizations._actor(workspace_ids),
            invitation_id,
        )
        return InvitationDelivery(invitation_id, invitation.email, expires_at)
