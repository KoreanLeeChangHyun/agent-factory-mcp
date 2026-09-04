"""Platform administration authorization and safety tests."""

from pathlib import Path
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.common.errors import ConflictError, PermissionDeniedError
from app.core.config import Settings
from app.main import create_app
from app.modules.admin.service import AdminService
from app.modules.auth.authorization_dependencies import require_platform_admin
from app.modules.auth.service import Principal
from app.modules.identity.models import UserStatus

ADMIN_ID = UUID("11111111-1111-4111-8111-111111111111")


def principal(*, admin: bool) -> Principal:
    return Principal(ADMIN_ID, "admin@example.com", "Admin", admin)


def test_admin_dependency_fails_closed() -> None:
    with pytest.raises(PermissionDeniedError, match="platform_admin_required"):
        require_platform_admin(principal(admin=False))
    assert require_platform_admin(principal(admin=True)).user_id == ADMIN_ID


def test_admin_page_is_separate_from_workspace() -> None:
    with TestClient(create_app()) as client:
        response = client.get("/admin/")

    assert response.status_code == 200
    assert "Platform administration" in response.text
    assert 'class="admin-shell"' in response.text
    assert 'class="activity-bar"' in response.text
    assert 'class="primary-sidebar"' in response.text
    assert 'class="status-bar"' in response.text
    assert (Path(__file__).parents[1] / "template" / "admin" / "index.html").is_file()
    assert (Path(__file__).parents[1] / "static" / "js" / "admin.js").is_file()


class FakeAdminRepository:
    def __init__(self) -> None:
        self.established: UUID | None = None

    async def establish_platform_context(self, user_id: UUID) -> None:
        self.established = user_id


@pytest.mark.asyncio
async def test_admin_cannot_suspend_own_account() -> None:
    repository = FakeAdminRepository()
    service = AdminService(
        repository,  # type: ignore[arg-type]
        Settings(environment="test", auth_token_secret=SecretStr("test-secret")),
    )
    await service.establish(principal(admin=True))

    with pytest.raises(ConflictError, match="cannot suspend itself"):
        await service.set_user_status(ADMIN_ID, UserStatus.SUSPENDED)

    assert repository.established == ADMIN_ID
