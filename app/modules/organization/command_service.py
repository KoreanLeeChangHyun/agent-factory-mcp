"""Transactional organization commands used by request adapters."""

from uuid import UUID

from app.modules.organization.schemas import MemberUpdate, RoleWrite, TeamWrite
from app.modules.organization.service import OrganizationService


class OrganizationCommandService(OrganizationService):
    """Commit each externally invoked organization mutation as one use case."""

    async def update(self, name: str, slug: str | None, revision: int) -> None:
        await super().update(name, slug, revision)
        await self.commit()

    async def delete_organization(self) -> None:
        await super().delete_organization()
        await self.commit()

    async def update_member(self, user_id: UUID, payload: MemberUpdate) -> None:
        await super().update_member(user_id, payload)
        await self.commit()

    async def transfer(self, user_id: UUID) -> None:
        await super().transfer(user_id)
        await self.commit()

    async def write_role(self, payload: RoleWrite, role_id: UUID | None = None) -> UUID:
        result = await super().write_role(payload, role_id)
        await self.commit()
        return result

    async def delete_role(self, role_id: UUID) -> None:
        await super().delete_role(role_id)
        await self.commit()

    async def set_workspace_member(
        self, workspace_id: UUID, user_id: UUID, role_id: UUID | None
    ) -> None:
        await super().set_workspace_member(workspace_id, user_id, role_id)
        await self.commit()

    async def write_team(self, payload: TeamWrite, team_id: UUID | None = None) -> UUID:
        result = await super().write_team(payload, team_id)
        await self.commit()
        return result

    async def delete_team(self, team_id: UUID) -> None:
        await super().delete_team(team_id)
        await self.commit()

    async def set_team_member(self, team_id: UUID, user_id: UUID, *, remove: bool = False) -> None:
        await super().set_team_member(team_id, user_id, remove=remove)
        await self.commit()

    async def set_team_workspace(
        self, team_id: UUID, workspace_id: UUID, role_id: UUID | None
    ) -> None:
        await super().set_team_workspace(team_id, workspace_id, role_id)
        await self.commit()

    async def cancel_invitation(self, invitation_id: UUID) -> None:
        await super().cancel_invitation(invitation_id)
        await self.commit()

    async def accept_invitation(self, token: str) -> None:
        await super().accept_invitation(token)
        await self.commit()
