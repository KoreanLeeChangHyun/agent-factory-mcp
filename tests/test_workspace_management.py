"""Workspace lifecycle and repository registration tests."""

from uuid import UUID

import pytest
from pydantic import SecretStr
from sqlalchemy.exc import IntegrityError

from app.common.errors import ConflictError
from app.core.config import Settings
from app.modules.auth.authorization import AuthorizationScope, AuthorizedContext
from app.modules.auth.service import Principal
from app.modules.identity.models import User
from app.modules.organization.service import OrganizationService
from app.modules.workspace.models import Workspace, WorkspaceGroup, WorkspaceStatus
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

    async def create(self, organization_id: UUID, name: str, slug: str) -> Workspace:
        self.workspace.organization_id = organization_id
        self.workspace.name = name
        self.workspace.slug = slug
        return self.workspace

    async def create_group(self, organization_id: UUID, user_id: UUID, name: str) -> WorkspaceGroup:
        return WorkspaceGroup(
            id=UUID("44444444-4444-4444-8444-444444444444"),
            organization_id=organization_id,
            user_id=user_id,
            name=name,
            position=0,
            collapsed=False,
            revision=1,
        )

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
    service = WorkspaceService(repository, local_settings())  # type: ignore[arg-type]

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
    service = WorkspaceService(repository, local_settings())  # type: ignore[arg-type]

    created = await service.create(context(None), " New Workspace ", "new-workspace")

    assert created.name == "New Workspace"
    assert repository.selected_workspace == WORKSPACE_ID
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
        organization_service: OrganizationService,
        workspace_id: UUID,
        user_id: UUID,
        role_id: UUID | None,
    ) -> None:
        del organization_service, workspace_id, user_id, role_id
        raise ConflictError("last_workspace_owner", "마지막 작업공간 소유자는 제거할 수 없습니다.")

    monkeypatch.setattr(OrganizationService, "set_workspace_member", reject_last_owner)

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
    class ConflictRepository(FakeWorkspaceRepository):
        async def add_repository(self, *args: object) -> object:
            del args
            raise IntegrityError("insert", {}, Exception("duplicate"))

    repository = ConflictRepository()
    service = WorkspaceService(repository, local_settings())  # type: ignore[arg-type]

    with pytest.raises(ConflictError, match="already registered"):
        await service.add_repository(context(), "https://github.com/openai/example", None, {})

    assert repository.rollbacks == 1
