"""Workspace persistence and filesystem-normalization ports."""

from typing import Protocol
from uuid import UUID

from agent_factory_core.identity.domain import Principal

from .domain import OrganizationSummary, RepositoryRecord, WorkspaceGroupRecord, WorkspaceRecord


class RepositoryLocationResolver(Protocol):
    def canonicalize(self, location: str) -> str: ...


class WorkspaceRepository(Protocol):
    async def list_organizations(self, principal: Principal) -> list[OrganizationSummary]: ...
    async def lock_personal_provisioning(self, user_id: UUID) -> None: ...
    async def find_personal_organization(self, user_id: UUID) -> OrganizationSummary | None: ...
    async def create_personal_organization(
        self, *, organization_id: UUID, user_id: UUID, name: str, slug: str
    ) -> OrganizationSummary: ...
    async def establish_organization_context(
        self, principal: Principal, organization_id: UUID
    ) -> None: ...
    async def list_visible(self, organization_id: UUID, user_id: UUID) -> list[WorkspaceRecord]: ...
    async def list_recent(self, organization_id: UUID, user_id: UUID) -> list[WorkspaceRecord]: ...
    async def get_visible(
        self, organization_id: UUID, user_id: UUID, workspace_id: UUID
    ) -> WorkspaceRecord | None: ...
    async def create_workspace(
        self,
        *,
        workspace_id: UUID,
        organization_id: UUID,
        owner_user_id: UUID,
        name: str,
        slug: str,
    ) -> WorkspaceRecord: ...
    async def update_workspace(
        self, workspace_id: UUID, *, name: str, expected_revision: int
    ) -> WorkspaceRecord | None: ...
    async def deactivate_workspace(self, workspace_id: UUID) -> bool: ...
    async def record_visit(self, user_id: UUID, workspace_id: UUID) -> None: ...
    async def list_groups(
        self, organization_id: UUID, user_id: UUID
    ) -> list[WorkspaceGroupRecord]: ...
    async def create_group(
        self, *, group_id: UUID, organization_id: UUID, user_id: UUID, name: str
    ) -> WorkspaceGroupRecord: ...
    async def update_group(
        self,
        group_id: UUID,
        user_id: UUID,
        *,
        name: str | None,
        collapsed: bool | None,
        expected_revision: int,
    ) -> WorkspaceGroupRecord | None: ...
    async def assign_group(
        self,
        *,
        organization_id: UUID,
        user_id: UUID,
        workspace_id: UUID,
        group_id: UUID | None,
    ) -> None: ...
    async def register_repository(
        self,
        *,
        repository_id: UUID,
        workspace_id: UUID,
        location: str,
        remote_url: str | None,
        metadata: dict[str, object],
    ) -> RepositoryRecord: ...
    async def list_repositories(self, workspace_id: UUID) -> list[RepositoryRecord]: ...
    async def soft_delete_repository(self, workspace_id: UUID, repository_id: UUID) -> bool: ...
    async def workspace_usage(self, workspace_id: UUID) -> tuple[int, int]: ...
    async def commit(self) -> None: ...
    async def rollback(self) -> None: ...
