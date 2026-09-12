"""Workspace/account discovery application use cases."""

from __future__ import annotations

from uuid import UUID, uuid4

from agent_factory_core.identity.authorization import (
    AuthorizedContext,
    require_context,
    require_workspace_id,
)
from agent_factory_core.identity.domain import Principal
from agent_factory_core.shared.errors import ConflictError, NotFoundError

from .domain import OrganizationSummary, RepositoryRecord, WorkspaceGroupRecord, WorkspaceRecord
from .policies import require_unique_group_name
from .ports import RepositoryLocationResolver, WorkspaceRepository


class WorkspaceUseCases:
    def __init__(
        self, repository: WorkspaceRepository, locations: RepositoryLocationResolver
    ) -> None:
        self.repository = repository
        self.locations = locations

    async def _finish(self) -> None:
        try:
            await self.repository.commit()
        except Exception:
            await self.repository.rollback()
            raise

    async def list_organizations(self, principal: Principal) -> list[OrganizationSummary]:
        return await self.repository.list_organizations(principal)

    async def create_personal_workspace(
        self, principal: Principal, *, name: str, slug: str
    ) -> WorkspaceRecord:
        await self.repository.lock_personal_provisioning(principal.user_id)
        organization = await self.repository.find_personal_organization(principal.user_id)
        if organization is None:
            organization_id = uuid4()
            organization = await self.repository.create_personal_organization(
                organization_id=organization_id,
                user_id=principal.user_id,
                name=f"{principal.display_name[:180]} Personal",
                slug=f"personal-{uuid4().hex}",
            )
        await self.repository.establish_organization_context(principal, organization.id)
        result = await self.repository.create_workspace(
            workspace_id=uuid4(),
            organization_id=organization.id,
            owner_user_id=principal.user_id,
            name=name,
            slug=slug,
        )
        await self._finish()
        return result

    async def list(self, context: AuthorizedContext) -> list[WorkspaceRecord]:
        require_context(context, "organization.read")
        return await self.repository.list_visible(
            context.scope.organization_id, context.principal.user_id
        )

    async def recent(self, context: AuthorizedContext) -> list[WorkspaceRecord]:
        require_context(context, "organization.read")
        return await self.repository.list_recent(
            context.scope.organization_id, context.principal.user_id
        )

    async def get(self, context: AuthorizedContext) -> WorkspaceRecord:
        require_context(context, "workspace.read")
        record = await self.repository.get_visible(
            context.scope.organization_id,
            context.principal.user_id,
            require_workspace_id(context),
        )
        if record is None:
            raise NotFoundError("workspace_not_found", "작업공간을 찾을 수 없습니다.")
        return record

    async def create(self, context: AuthorizedContext, *, name: str, slug: str) -> WorkspaceRecord:
        require_context(context, "workspace.create")
        result = await self.repository.create_workspace(
            workspace_id=uuid4(),
            organization_id=context.scope.organization_id,
            owner_user_id=context.principal.user_id,
            name=name,
            slug=slug,
        )
        await self._finish()
        return result

    async def update(
        self, context: AuthorizedContext, *, name: str, revision: int
    ) -> WorkspaceRecord:
        require_context(context, "workspace.update")
        result = await self.repository.update_workspace(
            require_workspace_id(context), name=name, expected_revision=revision
        )
        if result is None:
            raise ConflictError("workspace_revision_conflict", "작업공간이 변경되었습니다.")
        await self._finish()
        return result

    async def deactivate(self, context: AuthorizedContext) -> None:
        require_context(context, "workspace.delete")
        if not await self.repository.deactivate_workspace(require_workspace_id(context)):
            raise NotFoundError("workspace_not_found", "작업공간을 찾을 수 없습니다.")
        await self._finish()

    async def visit(self, context: AuthorizedContext) -> None:
        require_context(context, "workspace.read")
        await self.repository.record_visit(context.principal.user_id, require_workspace_id(context))
        await self._finish()

    async def create_group(self, context: AuthorizedContext, name: str) -> WorkspaceGroupRecord:
        require_context(context, "organization.read")
        groups = await self.repository.list_groups(
            context.scope.organization_id, context.principal.user_id
        )
        normalized = require_unique_group_name(name, [group.name for group in groups])
        result = await self.repository.create_group(
            group_id=uuid4(),
            organization_id=context.scope.organization_id,
            user_id=context.principal.user_id,
            name=normalized,
        )
        await self._finish()
        return result

    async def list_groups(self, context: AuthorizedContext) -> list[WorkspaceGroupRecord]:
        require_context(context, "organization.read")
        return await self.repository.list_groups(
            context.scope.organization_id, context.principal.user_id
        )

    async def update_group(
        self,
        context: AuthorizedContext,
        group_id: UUID,
        *,
        revision: int,
        name: str | None = None,
        collapsed: bool | None = None,
    ) -> WorkspaceGroupRecord:
        require_context(context, "organization.read")
        if name is not None:
            groups = await self.repository.list_groups(
                context.scope.organization_id, context.principal.user_id
            )
            peers = [group.name for group in groups if group.id != group_id]
            name = require_unique_group_name(name, peers)
        result = await self.repository.update_group(
            group_id,
            context.principal.user_id,
            name=name,
            collapsed=collapsed,
            expected_revision=revision,
        )
        if result is None:
            raise ConflictError("workspace_group_revision_conflict", "그룹이 변경되었습니다.")
        await self._finish()
        return result

    async def assign_group(
        self, context: AuthorizedContext, workspace_id: UUID, group_id: UUID | None = None
    ) -> None:
        require_context(context, "organization.read")
        if (
            await self.repository.get_visible(
                context.scope.organization_id, context.principal.user_id, workspace_id
            )
            is None
        ):
            raise NotFoundError("workspace_not_found", "작업공간을 찾을 수 없습니다.")
        if group_id is not None:
            groups = await self.repository.list_groups(
                context.scope.organization_id, context.principal.user_id
            )
            if not any(group.id == group_id for group in groups):
                raise NotFoundError("workspace_group_not_found", "그룹을 찾을 수 없습니다.")
        await self.repository.assign_group(
            organization_id=context.scope.organization_id,
            user_id=context.principal.user_id,
            workspace_id=workspace_id,
            group_id=group_id,
        )
        await self._finish()

    async def register_repository(
        self,
        context: AuthorizedContext,
        *,
        location: str,
        remote_url: str | None,
        metadata: dict[str, object],
    ) -> RepositoryRecord:
        require_context(context, "repository.create")
        canonical = self.locations.canonicalize(location)
        try:
            record = await self.repository.register_repository(
                repository_id=uuid4(),
                workspace_id=require_workspace_id(context),
                location=canonical,
                remote_url=remote_url,
                metadata=metadata,
            )
            await self._finish()
            return record
        except ConflictError:
            await self.repository.rollback()
            raise

    async def list_repositories(self, context: AuthorizedContext) -> list[RepositoryRecord]:
        require_context(context, "repository.read")
        return await self.repository.list_repositories(require_workspace_id(context))

    async def delete_repository(self, context: AuthorizedContext, repository_id: UUID) -> None:
        require_context(context, "repository.delete")
        if not await self.repository.soft_delete_repository(
            require_workspace_id(context), repository_id
        ):
            raise NotFoundError("repository_not_found", "저장소를 찾을 수 없습니다.")
        await self._finish()

    async def usage(self, context: AuthorizedContext) -> tuple[int, int]:
        require_context(context, "workspace.read")
        return await self.repository.workspace_usage(require_workspace_id(context))
