"""Compatibility translation bridge to the core Workspace application boundary."""

from pathlib import Path
from uuid import UUID

from agent_factory_adapters.workspaces import (
    EnvironmentRepositoryLocationResolver,
    PostgresWorkspaceRepository,
)
from agent_factory_api.composition.workspaces import workspace_use_cases
from agent_factory_core.identity.authorization import AuthorizedContext, require_workspace_id

from app.common.errors import ApplicationError, NotFoundError
from app.core.config import Settings
from app.modules.workspace.repository import WorkspaceRepositoryStore


class WorkspaceService:
    """Keeps legacy signatures while Workspace decisions use target owners."""

    def __init__(self, repository: WorkspaceRepositoryStore, settings: Settings) -> None:
        self.repository = repository
        self.settings = settings
        locations = EnvironmentRepositoryLocationResolver(settings.environment, Path("/"))
        self.adapter = PostgresWorkspaceRepository(repository.session)
        self.core = workspace_use_cases(repository.session, locations)

    async def list(self, context: AuthorizedContext):
        return await self.core.list(context)

    async def recent(self, context: AuthorizedContext):
        return await self.core.recent(context)

    async def get(self, context: AuthorizedContext):
        return await self.core.get(context)

    async def record_visit(self, context: AuthorizedContext) -> None:
        await self.core.visit(context)

    async def create(self, context: AuthorizedContext, name: str, slug: str):
        return await self.core.create(context, name=name, slug=slug)

    async def list_groups(self, context: AuthorizedContext):
        return [
            (group, list(group.workspace_ids)) for group in await self.core.list_groups(context)
        ]

    async def create_group(self, context: AuthorizedContext, name: str):
        return await self.core.create_group(context, name)

    async def update_group(
        self,
        context: AuthorizedContext,
        group_id: UUID,
        revision: int,
        *,
        name: str | None = None,
        collapsed: bool | None = None,
    ):
        return await self.core.update_group(
            context, group_id, revision=revision, name=name, collapsed=collapsed
        )

    async def assign_workspace_group(
        self, context: AuthorizedContext, workspace_id: UUID, group_id: UUID | None
    ) -> None:
        await self.core.assign_group(context, workspace_id, group_id)

    async def update(self, context: AuthorizedContext, name: str, revision: int):
        return await self.core.update(context, name=name, revision=revision)

    async def deactivate(self, context: AuthorizedContext) -> None:
        await self.core.deactivate(context)

    async def add_repository(
        self,
        context: AuthorizedContext,
        location: str,
        remote_url: str | None,
        metadata: dict[str, object],
    ):
        return await self.core.register_repository(
            context, location=location, remote_url=remote_url, metadata=metadata
        )

    async def delete_repository(self, context: AuthorizedContext, repository_id: UUID) -> None:
        await self.core.delete_repository(context, repository_id)

    async def list_repositories(self, context: AuthorizedContext):
        return await self.core.list_repositories(context)

    async def usage(self, context: AuthorizedContext):
        return await self.core.usage(context)

    async def list_members(self, context: AuthorizedContext):
        return await self.adapter.list_members(require_workspace_id(context))

    async def add_member(self, context: AuthorizedContext, email: str, role_name: str) -> None:
        from app.modules.organization.command_service import OrganizationCommandService

        user = await self.adapter.resolve_organization_user(
            context.scope.organization_id, email.strip().casefold()
        )
        if user is None:
            raise NotFoundError(
                "organization_member_not_found", "활성 조직 구성원을 찾을 수 없습니다."
            )
        role = await self.adapter.resolve_workspace_role(role_name)
        if role is None:
            raise ApplicationError("workspace_role_invalid", "지원하지 않는 작업공간 역할입니다.")
        service = OrganizationCommandService(
            self.repository.session, context.principal, context.scope.organization_id
        )
        await service.set_workspace_member(require_workspace_id(context), user.id, role.id)

    async def remove_member(self, context: AuthorizedContext, user_id: UUID) -> None:
        from app.modules.organization.command_service import OrganizationCommandService

        service = OrganizationCommandService(
            self.repository.session, context.principal, context.scope.organization_id
        )
        await service.set_workspace_member(require_workspace_id(context), user_id, None)


def canonical_repository_location(location: str, environment: str) -> str:
    resolver = EnvironmentRepositoryLocationResolver(environment, Path("/"))
    return resolver.canonicalize(location)


def _workspace_id(context: AuthorizedContext) -> UUID:
    return require_workspace_id(context)
