"""Compatibility bridge to target account-discovery and personal-Workspace use cases."""

from agent_factory_api.composition.workspaces import workspace_use_cases
from agent_factory_core.identity.domain import Principal

from app.core.config import Settings
from app.modules.organization.repository import OrganizationRepository
from app.modules.workspace.repository import WorkspaceRepositoryStore


class AccountService:
    def __init__(
        self,
        organizations: OrganizationRepository,
        workspaces: WorkspaceRepositoryStore,
        settings: Settings,
    ) -> None:
        del settings
        if organizations.session is not workspaces.session:
            raise ValueError("Account repositories must share one transaction")
        self.core = workspace_use_cases(organizations.session)

    async def list_organizations(self, principal: Principal):
        return await self.core.list_organizations(principal)

    async def create_personal_workspace(self, principal: Principal, name: str, slug: str):
        return await self.core.create_personal_workspace(principal, name=name, slug=slug)
