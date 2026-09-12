"""Compatibility command signatures backed by target organization use cases."""

from uuid import UUID

from agent_factory_api.composition.organizations import organization_use_cases
from agent_factory_core.organizations import MembershipStatus, RoleScope
from agent_factory_core.organizations.use_cases import OrganizationActor, OrganizationUseCases

from app.core.config import settings
from app.modules.organization.schemas import MemberUpdate, RoleWrite, TeamWrite
from app.modules.organization.service import OrganizationService


class _UnusedEmail:
    async def send_organization_invitation(self, email, organization_id, token) -> None:
        raise RuntimeError("Invitation delivery must use OrganizationInvitationService")


class OrganizationCommandService(OrganizationService):
    """Keeps dependency override identity while moving transaction decisions to core."""

    def _target(self, email=None) -> OrganizationUseCases:
        return organization_use_cases(
            self.session,
            token_secret=settings.auth_token_secret.get_secret_value(),
            email=email or _UnusedEmail(),
        )

    @classmethod
    async def create(cls, session, principal, name: str, slug: str | None):
        service = cls(session, principal, UUID(int=0))
        return await service._target().create(
            OrganizationActor(principal, frozenset(), True), name, slug
        )

    async def _actor(self, workspace_ids: tuple[UUID, ...] = ()) -> OrganizationActor:
        return await super()._actor(workspace_ids)

    async def _all_workspace_ids(self) -> tuple[UUID, ...]:
        return await super()._all_workspace_ids()

    async def overview(self):
        return await self._target().overview(self.organization_id, await self._actor())

    async def members(self, search: str = "", status=None):
        normalized = MembershipStatus(status.value) if status is not None else None
        return await self._target().members(
            self.organization_id, await self._actor(), search=search, status=normalized
        )

    async def detail(self, user_id: UUID):
        return await self._target().member_detail(
            self.organization_id, await self._actor(), user_id
        )

    async def roles(self):
        return await self._target().roles(self.organization_id, await self._actor())

    async def teams(self):
        return await self._target().teams(self.organization_id, await self._actor())

    async def invitations(self):
        return await self._target().invitations(self.organization_id, await self._actor())

    async def workspace_options(self):
        workspace_ids = await self._all_workspace_ids()
        return await self._target().workspace_options(
            self.organization_id, await self._actor(workspace_ids)
        )

    async def events(self):
        return await self._target().audit_events(self.organization_id, await self._actor())

    async def update(self, name: str, slug: str | None, revision: int) -> None:
        await self._target().update(
            self.organization_id,
            await self._actor(),
            name=name,
            slug=slug,
            revision=revision,
        )

    async def delete_organization(self) -> None:
        await self._target().delete(self.organization_id, await self._actor())

    async def update_member(self, user_id: UUID, payload: MemberUpdate) -> None:
        status = MembershipStatus(payload.status.value) if payload.status is not None else None
        await self._target().update_member(
            self.organization_id,
            await self._actor(await self._all_workspace_ids()),
            user_id,
            role_id=payload.role_id,
            status=status,
        )

    async def transfer(self, user_id: UUID) -> None:
        await self._target().transfer(self.organization_id, await self._actor(), user_id)

    async def write_role(self, payload: RoleWrite, role_id: UUID | None = None) -> UUID:
        return await self._target().write_role(
            self.organization_id,
            await self._actor(await self._all_workspace_ids()),
            name=payload.name,
            scope=RoleScope(payload.scope),
            permissions=payload.permissions,
            role_id=role_id,
        )

    async def delete_role(self, role_id: UUID) -> None:
        await self._target().delete_role(self.organization_id, await self._actor(), role_id)

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

    async def write_team(self, payload: TeamWrite, team_id: UUID | None = None) -> UUID:
        return await self._target().write_team(
            self.organization_id,
            await self._actor(),
            name=payload.name,
            description=payload.description,
            team_id=team_id,
        )

    async def delete_team(self, team_id: UUID) -> None:
        await self._target().delete_team(
            self.organization_id,
            await self._actor(await self._all_workspace_ids()),
            team_id,
        )

    async def set_team_member(self, team_id: UUID, user_id: UUID, *, remove: bool = False) -> None:
        await self._target().mutate_team_member(
            self.organization_id,
            await self._actor(await self._all_workspace_ids()),
            team_id,
            user_id,
            not remove,
        )

    async def set_team_workspace(
        self, team_id: UUID, workspace_id: UUID, role_id: UUID | None
    ) -> None:
        await self._target().set_team_workspace(
            self.organization_id,
            await self._actor((workspace_id,)),
            team_id,
            workspace_id,
            role_id,
        )

    async def cancel_invitation(self, invitation_id: UUID) -> None:
        await self._target().cancel_invitation(
            self.organization_id, await self._actor(), invitation_id
        )

    async def accept_invitation(self, token: str) -> None:
        await self._target().accept(
            self.organization_id,
            await self._actor(),
            token=token,
        )
