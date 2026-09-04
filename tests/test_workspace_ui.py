"""SaaS Workspace shell contract tests."""

from pathlib import Path
from uuid import UUID

from fastapi.testclient import TestClient

from app.common.errors import AuthenticationError
from app.core.config import settings
from app.main import create_app
from app.modules.auth.dependencies import get_auth_service
from app.modules.auth.service import Principal

ROOT = Path(__file__).parents[1]
TEMPLATE = ROOT / "template" / "workspace" / "index.html"
SCRIPT = ROOT / "static" / "js" / "workspace.js"
LOGIN_TEMPLATE = ROOT / "template" / "login" / "index.html"


class PageAuthService:
    def __init__(self, authenticated: bool) -> None:
        self.authenticated = authenticated

    async def authenticate_session(self, token: str | None) -> Principal:
        del token
        if not self.authenticated:
            raise AuthenticationError("authentication_required")
        return Principal(
            user_id=UUID("11111111-1111-4111-8111-111111111111"),
            email="owner@example.com",
            display_name="Owner",
            is_platform_admin=True,
        )


def test_workspace_exposes_exactly_five_activities() -> None:
    html = TEMPLATE.read_text()
    assert html.count("data-activity=") == 5
    for label in ("일정", "에이전트", "문서", "로그", "테스트"):
        assert f'aria-label="{label}"' in html
    assert 'aria-label="외부연동"' not in html


def test_workspace_uses_authenticated_tenant_apis_not_project_files() -> None:
    script = SCRIPT.read_text()
    assert 'api("/api/auth/me")' in script
    assert 'api("/api/account/organizations")' in script
    assert ".agent-factory" not in script
    assert "/api/explorer-tree" not in script


def test_workspace_assets_are_same_origin_and_accessible() -> None:
    html = TEMPLATE.read_text()
    login_html = LOGIN_TEMPLATE.read_text()
    assert 'lang="ko"' in html
    assert 'role="status"' in html
    assert 'role="alert"' in login_html
    assert "https://" not in html
    application = create_app()
    application.dependency_overrides[get_auth_service] = lambda: PageAuthService(True)
    with TestClient(application) as client:
        assert client.get("/workspace/").status_code == 200
        assert client.get("/static/js/workspace.js").status_code == 200
        assert client.get("/static/css/workspace.css").status_code == 200
        assert client.get("/static/js/login.js").status_code == 200
        assert client.get("/static/css/login.css").status_code == 200


def test_workspace_is_accessible_below_factory_root(monkeypatch) -> None:
    monkeypatch.setattr(settings, "root_path", "/factory")
    application = create_app()
    application.dependency_overrides[get_auth_service] = lambda: PageAuthService(False)
    with TestClient(application) as client:
        response = client.get("/factory/", follow_redirects=False)
        assert response.headers["location"] == "/factory/login/"
        assert client.get("/factory/login/").status_code == 200
        assert client.get("/factory/workspace/", follow_redirects=False).headers["location"] == "/factory/login/"
        assert client.get("/factory/static/js/workspace.js").status_code == 200
