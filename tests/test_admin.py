"""Platform administration authorization and safety tests."""

from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.common.errors import AuthenticationError, ConflictError, PermissionDeniedError
from app.core.config import Settings
from app.core.ui_catalog import catalog_files
from app.main import create_app
from app.modules.admin.service import AdminService
from app.modules.auth.authorization_dependencies import require_platform_admin
from app.modules.auth.dependencies import get_current_principal
from app.modules.auth.service import Principal
from app.modules.identity.models import UserStatus

ADMIN_ID = UUID("11111111-1111-4111-8111-111111111111")


def principal(*, admin: bool) -> Principal:
    return Principal(ADMIN_ID, "admin@example.com", "Admin", admin)


def test_admin_dependency_fails_closed() -> None:
    with pytest.raises(PermissionDeniedError, match="platform_admin_required"):
        require_platform_admin(principal(admin=False))
    assert require_platform_admin(principal(admin=True)).user_id == ADMIN_ID


def test_admin_page_redirects_to_integrated_workspace() -> None:
    with TestClient(create_app()) as client:
        response = client.get("/admin/", follow_redirects=False)

    assert response.status_code == 307
    assert response.headers["location"] == "/workspace/#admin"


@pytest.mark.parametrize(
    "path",
    [
        "",
        "catalog/catalog.js",
        "src/components/primitives.js",
        "styles/theme.css",
        "generated/vendors.js",
    ],
)
@pytest.mark.parametrize("role, expected", [("anonymous", 401), ("member", 403), ("super", 200)])
def test_catalog_requires_platform_admin(path: str, role: str, expected: int) -> None:
    application = create_app()

    def current_principal() -> Principal:
        if role == "anonymous":
            raise AuthenticationError("authentication_required")
        return principal(admin=role == "super")

    application.dependency_overrides[get_current_principal] = current_principal
    with TestClient(application) as client:
        for method in (client.get, client.head):
            response = method(f"/admin/assets/{path}")
            assert response.status_code == expected
            if expected == 200:
                assert response.headers["cache-control"] == "no-store"
                assert response.headers["x-frame-options"] == "SAMEORIGIN"
                assert "frame-ancestors 'self'" in response.headers["content-security-policy"]
            else:
                assert response.headers["x-frame-options"] == "DENY"


@pytest.mark.parametrize(
    "path",
    [
        "README.md",
        "package.json",
        "node_modules/playwright/package.json",
        "build.mjs",
        "docs/API.md",
        "..%2F..%2FREADME.md",
    ],
)
def test_catalog_does_not_serve_build_or_unrelated_files(path: str) -> None:
    application = create_app()
    application.dependency_overrides[get_current_principal] = lambda: principal(admin=True)
    with TestClient(application) as client:
        assert client.get(f"/admin/assets/{path}").status_code == 404


def test_catalog_manifest_is_cached_and_returned_as_a_copy(tmp_path) -> None:
    (tmp_path / "index.html").write_text("catalog")
    first = catalog_files(tmp_path)
    (tmp_path / "late.js").write_text("late")
    second = catalog_files(tmp_path)
    first.clear()

    assert "late.js" not in second
    assert "index.html" in catalog_files(tmp_path)


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
