"""Organization persistence under explicit identity and tenant context."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.service import Principal
from app.modules.organization.models import (
    MembershipStatus,
    Organization,
    OrganizationInvitation,
    OrganizationMembership,
)


class OrganizationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def establish_identity_context(self, principal: Principal) -> None:
        await self.session.execute(
            text("SELECT set_config('app.current_user_id', :user_id, true)"),
            {"user_id": str(principal.user_id)},
        )
        await self.session.execute(
            text("SELECT set_config('app.is_platform_admin', :value, true)"),
            {"value": "true" if principal.is_platform_admin else "false"},
        )

    async def enable_identity_lookup(self) -> None:
        await self.session.execute(text("SELECT set_config('app.is_platform_admin', 'true', true)"))

    async def list_for_user(self, principal: Principal) -> list[Organization]:
        await self.establish_identity_context(principal)
        return list(
            await self.session.scalars(
                select(Organization)
                .join(
                    OrganizationMembership,
                    OrganizationMembership.organization_id == Organization.id,
                )
                .where(
                    OrganizationMembership.user_id == principal.user_id,
                    OrganizationMembership.status == MembershipStatus.ACTIVE,
                    Organization.deleted_at.is_(None),
                )
                .order_by(Organization.name)
            )
        )

    async def lock_personal_provisioning(self, user_id: UUID) -> None:
        await self.session.execute(
            text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"),
            {"key": f"personal-workspace:{user_id}"},
        )

    async def find_personal_for_user(self, user_id: UUID) -> Organization | None:
        await self.enable_identity_lookup()
        return await self.session.scalar(
            select(Organization)
            .join(
                OrganizationMembership,
                OrganizationMembership.organization_id == Organization.id,
            )
            .where(
                OrganizationMembership.user_id == user_id,
                OrganizationMembership.status == MembershipStatus.ACTIVE,
                Organization.is_personal.is_(True),
                Organization.deleted_at.is_(None),
            )
            .order_by(Organization.created_at, Organization.id)
            .limit(1)
        )

    async def create_with_owner(
        self,
        organization: Organization,
        owner_id: UUID,
        owner_role_id: UUID,
    ) -> None:
        self.session.add(organization)
        await self.session.flush()
        self.session.add(
            OrganizationMembership(
                organization_id=organization.id,
                user_id=owner_id,
                role_id=owner_role_id,
            )
        )
        await self.session.flush()

    async def get_invitation(
        self, organization_id: UUID, invitation_id: UUID
    ) -> OrganizationInvitation | None:
        return await self.session.scalar(
            select(OrganizationInvitation).where(
                OrganizationInvitation.id == invitation_id,
                OrganizationInvitation.organization_id == organization_id,
            )
        )

    async def commit(self) -> None:
        await self.session.commit()

    async def rollback(self) -> None:
        await self.session.rollback()
