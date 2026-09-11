"""Organization invitation persistence and delivery orchestration."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol
from uuid import UUID

from app.common.errors import ApplicationError
from app.modules.organization.schemas import InvitationCreate
from app.modules.organization.service import OrganizationService


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
    def __init__(self, organizations: OrganizationService, sender: InvitationSender) -> None:
        self.organizations = organizations
        self.sender = sender

    async def create(self, payload: InvitationCreate) -> InvitationDelivery:
        invitation, token = await self.organizations.invite(payload)
        return await self._deliver(invitation, token)

    async def resend(self, invitation_id: UUID) -> InvitationDelivery:
        invitation, token = await self.organizations.resend_invitation(invitation_id)
        return await self._deliver(invitation, token)

    async def _deliver(self, invitation, token: str) -> InvitationDelivery:
        await self.organizations.commit()
        try:
            await self.sender.send_organization_invitation(
                invitation.email,
                self.organizations.organization_id,
                token,
            )
        except Exception as exc:
            raise ApplicationError(
                "invitation_delivery_failed",
                "초대가 저장되었지만 메일 전송에 실패했습니다. 재전송하세요.",
                502,
            ) from exc
        return InvitationDelivery(
            invitation.id,
            invitation.email,
            invitation.expires_at,
        )
