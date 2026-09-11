"""Authenticated tenant discovery and personal Workspace provisioning."""

from __future__ import annotations

from uuid import uuid4

from app.core.config import Settings
from app.modules.auth.authorization import (
    AuthorizationRepository,
    AuthorizationScope,
    AuthorizationService,
)
from app.modules.auth.service import Principal
from app.modules.organization.models import Organization
from app.modules.organization.repository import OrganizationRepository
from app.modules.organization.system_roles import ORGANIZATION_OWNER_ROLE_ID
from app.modules.workspace.models import Workspace
from app.modules.workspace.repository import WorkspaceRepositoryStore
from app.modules.workspace.service import WorkspaceService


class AccountService:
    def __init__(
        self,
        organizations: OrganizationRepository,
        workspaces: WorkspaceRepositoryStore,
        settings: Settings,
    ) -> None:
        self.organizations = organizations
        self.workspaces = workspaces
        self.settings = settings

    async def list_organizations(self, principal: Principal) -> list[Organization]:
        return await self.organizations.list_for_user(principal)

    async def create_personal_workspace(
        self, principal: Principal, name: str, slug: str
    ) -> Workspace:
        await self.organizations.lock_personal_provisioning(principal.user_id)
        organization = await self.organizations.find_personal_for_user(principal.user_id)
        if organization is None:
            organization = Organization(
                id=uuid4(),
                name=f"{principal.display_name[:180]} Personal",
                slug=f"personal-{uuid4().hex}",
                is_personal=True,
            )
            await self.organizations.create_with_owner(
                organization,
                principal.user_id,
                ORGANIZATION_OWNER_ROLE_ID,
            )

        context = await AuthorizationService(
            AuthorizationRepository(self.organizations.session)
        ).authorize(principal, AuthorizationScope(organization.id), "workspace.create")
        return await WorkspaceService(self.workspaces, self.settings).create(context, name, slug)
