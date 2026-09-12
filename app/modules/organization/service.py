"""Compatibility construction bridge for the target organization application domain."""

from uuid import UUID

from agent_factory_adapters.organizations import PostgresOrganizationRepository
from agent_factory_api.composition.organizations import organization_use_cases
from agent_factory_core.identity.authorization import AuthorizationScope, AuthorizationService
from agent_factory_core.identity.domain import Principal
from agent_factory_core.organizations import MembershipStatus
from agent_factory_core.organizations.system_roles import ORGANIZATION_OWNER_ROLE_ID
from agent_factory_core.organizations.use_cases import OrganizationActor, OrganizationUseCases
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.modules.auth.authorization import AuthorizationRepository


class _NoInvitationDelivery:
    async def send_organization_invitation(
        self, email: str, organization_id: UUID, token: str
    ) -> None:
        del email, organization_id, token
        raise RuntimeError("Invitation delivery requires the configured email adapter")


class OrganizationService:
    """Preserve legacy construction identity without retaining SQL or domain decisions."""

    def __init__(self, session: AsyncSession, principal: Principal, organization_id: UUID):
        self.session = session
        self.principal = principal
        self.organization_id = organization_id
        self.repository = AuthorizationRepository(session)

    def _target(self, email=None) -> OrganizationUseCases:
        return organization_use_cases(
            self.session,
            token_secret=settings.auth_token_secret.get_secret_value(),
            email=email or _NoInvitationDelivery(),
        )

    async def _actor(self, workspace_ids: tuple[UUID, ...] = ()) -> OrganizationActor:
        await self.repository.establish_scope(
            self.principal, AuthorizationScope(self.organization_id)
        )
        authorization = AuthorizationService(self.repository)
        organization = await authorization.resolve(
            self.principal, AuthorizationScope(self.organization_id)
        )
        workspace_permissions = {
            workspace_id: (
                await authorization.resolve(
                    self.principal,
                    AuthorizationScope(self.organization_id, workspace_id),
                )
            ).permissions
            for workspace_id in workspace_ids
        }
        is_owner = (
            self.principal.is_platform_admin
            or "organization.delete" in organization.permissions
        )
        return OrganizationActor(
            self.principal,
            organization.permissions,
            is_owner,
            workspace_permissions,
        )

    async def _all_workspace_ids(self) -> tuple[UUID, ...]:
        await self.repository.establish_scope(
            self.principal, AuthorizationScope(self.organization_id)
        )
        snapshot = await PostgresOrganizationRepository(self.session).lock_snapshot(
            self.organization_id
        )
        return tuple(snapshot.active_workspace_ids)

    async def require(self, key: str, workspace_id: UUID | None = None):
        return await AuthorizationService(self.repository).authorize(
            self.principal, AuthorizationScope(self.organization_id, workspace_id), key
        )

    async def owner(self) -> bool:
        if self.principal.is_platform_admin:
            return True
        await self.repository.establish_scope(
            self.principal, AuthorizationScope(self.organization_id)
        )
        snapshot = await PostgresOrganizationRepository(self.session).lock_snapshot(
            self.organization_id
        )
        member = snapshot.member(self.principal.user_id)
        return bool(
            member
            and member.status == MembershipStatus.ACTIVE
            and member.role_id == ORGANIZATION_OWNER_ROLE_ID
        )

    async def set_workspace_member(
        self, workspace_id: UUID, user_id: UUID, role_id: UUID | None
    ) -> None:
        await self._target().set_workspace_member(
            self.organization_id,
            await self._actor((workspace_id,)),
            workspace_id,
            user_id,
            role_id,
        )

    async def commit(self) -> None:
        # Target mutations commit at their application boundary. A historical
        # integration caller performs a harmless second commit through this bridge.
        await self.session.commit()
