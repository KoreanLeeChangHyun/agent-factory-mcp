"""Workspace lifecycle and repository registration tests."""

from pathlib import Path
from uuid import UUID

import pytest
from pydantic import SecretStr

from agent_factory_adapters.workspaces import LocalRepositoryLocationResolver
from agent_factory_core.workspaces import (
    WorkspaceGroupRecord,
    WorkspaceRecord,
    WorkspaceStatus as CoreWorkspaceStatus,
)
from agent_factory_core.workspaces.use_cases import WorkspaceUseCases
from app.common.errors import ConflictError
from app.core.config import Settings
from app.modules.auth.authorization import AuthorizationScope, AuthorizedContext
from app.modules.auth.service import Principal
from app.modules.identity.models import User
from app.modules.organization.command_service import OrganizationCommandService
from app.modules.workspace.models import Workspace, WorkspaceStatus
from app.modules.workspace.schemas import WorkspaceGroupCreate
from app.modules.workspace.service import WorkspaceService, canonical_repository_location

USER_ID = UUID("11111111-1111-4111-8111-111111111111")
ORGANIZATION_ID = UUID("22222222-2222-4222-8222-222222222222")
WORKSPACE_ID = UUID("33333333-3333-4333-8333-333333333333")


def context(workspace_id: UUID | None = WORKSPACE_ID) -> AuthorizedContext:
    return AuthorizedContext(
        Principal(USER_ID, "owner@example.com", "Owner", False),
        AuthorizationScope(ORGANIZATION_ID, workspace_id),
        frozenset(
            {
                "workspace.read",
                "workspace.manage",
                "workspace.create",
                "repository.create",
            }
        ),
    )


class FakeWorkspaceRepository:
    def __init__(self) -> None:
        self.workspace = Workspace(
            id=WORKSPACE_ID,
            organization_id=ORGANIZATION_ID,
            name="Agent Factory",
            slug="agent-factory",
            status=WorkspaceStatus.ACTIVE,
            revision=1,
        )
        self.members: list[tuple[User, str]] = []
        self.selected_workspace: UUID | None = None
        self.commits = 0
        self.rollbacks = 0
        self.session = object()
        self.created_owner = None
        self.groups = []

    async def create_workspace(self, *, workspace_id, organization_id, owner_user_id, name, slug):
        del workspace_id
        self.created_owner = owner_user_id
        now = self.workspace.created_at
        return WorkspaceRecord(
            WORKSPACE_ID,
            organization_id,
            name,
            slug,
            CoreWorkspaceStatus.ACTIVE,
            1,
            now,
            now,
        )

    async def list_groups(self, organization_id, user_id):
        del organization_id, user_id
        return self.groups

    async def create_group(self, *, group_id, organization_id, user_id, name):
        group = WorkspaceGroupRecord(group_id, organization_id, user_id, name, False, 1)
        self.groups.append(group)
        return group

    async def register_repository(
        self, *, repository_id, workspace_id, location, remote_url, metadata
    ):
        del repository_id, workspace_id, location, remote_url, metadata
        raise ConflictError("repository_already_registered", "Repository is already registered")

    async def select_workspace_context(self, workspace_id: UUID) -> None:
        self.selected_workspace = workspace_id

    async def add_member(self, workspace_id: UUID, user_id: UUID, role_id: UUID) -> None:
        del workspace_id, user_id, role_id

    async def list_members(self, workspace_id: UUID) -> list[tuple[User, str]]:
        del workspace_id
        return self.members

    async def remove_member(self, workspace_id: UUID, user_id: UUID) -> bool:
        del workspace_id
        before = len(self.members)
        self.members = [item for item in self.members if item[0].id != user_id]
        return len(self.members) != before

    async def commit(self) -> None:
        self.commits += 1

    async def rollback(self) -> None:
        self.rollbacks += 1


def local_settings() -> Settings:
    return Settings(auth_token_secret=SecretStr("test-secret"), environment="test")


def organization_context() -> AuthorizedContext:
    return AuthorizedContext(
        Principal(USER_ID, "owner@example.com", "Owner", False),
        AuthorizationScope(ORGANIZATION_ID, None),
        frozenset({"organization.read"}),
    )


@pytest.mark.asyncio
async def test_workspace_group_creation_is_committed_for_the_current_user() -> None:
    repository = FakeWorkspaceRepository()
    service = WorkspaceUseCases(repository, LocalRepositoryLocationResolver(Path("/")))  # type: ignore[arg-type]

    group = await service.create_group(organization_context(), "  개발  ")

    assert group.name == "개발"
    assert group.organization_id == ORGANIZATION_ID
    assert group.user_id == USER_ID
    assert repository.commits == 1


def test_workspace_group_name_is_trimmed_by_the_api_schema() -> None:
    assert WorkspaceGroupCreate(name="  제품 개발  ").name == "제품 개발"


@pytest.mark.asyncio
async def test_creator_becomes_owner_in_new_workspace_scope() -> None:
    repository = FakeWorkspaceRepository()
    service = WorkspaceUseCases(repository, LocalRepositoryLocationResolver(Path("/")))  # type: ignore[arg-type]

    created = await service.create(context(None), name="New Workspace", slug="new-workspace")

    assert created.name == "New Workspace"
    assert repository.created_owner == USER_ID
    assert repository.commits == 1


@pytest.mark.asyncio
async def test_last_workspace_owner_cannot_be_removed(monkeypatch: pytest.MonkeyPatch) -> None:
    owner = User(
        id=USER_ID,
        email="owner@example.com",
        display_name="Owner",
        is_platform_admin=False,
    )
    repository = FakeWorkspaceRepository()
    repository.members = [(owner, "workspace_owner")]
    service = WorkspaceService(repository, local_settings())  # type: ignore[arg-type]

    async def reject_last_owner(
        organization_service: OrganizationCommandService,
        workspace_id: UUID,
        user_id: UUID,
        role_id: UUID | None,
    ) -> None:
        del organization_service, workspace_id, user_id, role_id
        raise ConflictError("last_workspace_owner", "마지막 작업공간 소유자는 제거할 수 없습니다.")

    monkeypatch.setattr(OrganizationCommandService, "set_workspace_member", reject_last_owner)

    with pytest.raises(ConflictError) as error:
        await service.remove_member(context(), USER_ID)

    assert error.value.code == "last_workspace_owner"
    assert repository.commits == 0


def test_repository_identity_normalizes_git_forms() -> None:
    assert (
        canonical_repository_location("git@GitHub.com:OpenAI/example.git", "production")
        == "ssh://git@github.com/OpenAI/example"
    )
    assert (
        canonical_repository_location("https://GitHub.com/OpenAI/example.git/", "production")
        == "https://github.com/OpenAI/example"
    )


@pytest.mark.asyncio
async def test_repository_conflict_is_recoverable() -> None:
    repository = FakeWorkspaceRepository()
    service = WorkspaceUseCases(repository, LocalRepositoryLocationResolver(Path("/")))  # type: ignore[arg-type]

    with pytest.raises(ConflictError, match="already registered"):
        await service.register_repository(
            context(), location="https://github.com/openai/example", remote_url=None, metadata={}
        )

    assert repository.rollbacks == 1
