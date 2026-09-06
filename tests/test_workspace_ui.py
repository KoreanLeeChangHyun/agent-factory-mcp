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


def test_workspace_exposes_nine_decided_activities_in_default_order() -> None:
    html = TEMPLATE.read_text()
    assert html.count("data-activity=") == 9
    labels = ("일정", "에이전트", "문서", "로그", "테스트", "연동", "DB", "계정", "관리자")
    for label in labels:
        assert f'aria-label="{label}"' in html
    assert [html.index(f'aria-label="{label}"') for label in labels] == sorted(
        html.index(f'aria-label="{label}"') for label in labels
    )
    assert 'data-sidebar-view="integrations"' in html
    assert 'data-workspace-view="integrations"' in html
    assert 'data-sidebar-view="database"' in html
    assert 'data-workspace-view="database"' in html


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
    assert 'class="workspace-title-bar"' in html
    assert "data-workspace-context" not in html
    assert "data-open-organizations" in html
    assert 'data-activity="account"' in html
    assert 'data-activity="admin"' in html
    assert 'data-workspace-view="account"' in html
    assert 'data-workspace-view="admin"' in html
    assert "data-activity-context-menu" in html
    assert "data-document-explorer-toggle" not in html
    assert "<span>탐색기</span>" not in html
    assert "<span>개요</span>" not in html
    assert html.count('class="de-document-header"') == 3
    assert html.count('role="tree"') == 2
    assert html.count("data-document-target=") == 4
    assert html.count('data-document-target="original-overview"><svg') == 1
    assert html.count('data-document-target="original-search"><svg') == 1
    assert 'aria-label="원본 문서 테이블"' in html
    assert html.count('data-document-target="processed-overview"><svg') == 1
    assert html.count('data-document-target="specification-overview"><svg') == 1
    assert "data-processed-list" in html
    assert "data-specification-list" in html
    assert "data-integration-add" in html
    assert 'data-integration-tab="status"' in html
    assert 'data-integration-tab="scope"' in html
    assert 'data-integration-tab="settings"' in html
    assert "../static/js/integrations.js" in html
    assert 'data-document-view="document-editor"' in html
    assert "../static/js/document-editor.js" in html
    assert 'role="status"' in html
    assert 'role="alert"' in login_html
    assert "https://" not in html
    application = create_app()
    application.dependency_overrides[get_auth_service] = lambda: PageAuthService(True)
    with TestClient(application) as client:
        assert client.get("/workspace/").status_code == 200
        assert client.get("/static/js/workspace.js").status_code == 200
        assert client.get("/static/js/integrations.js").status_code == 200
        assert client.get("/static/css/workspace.css").status_code == 200
        assert client.get("/static/js/login.js").status_code == 200
        assert client.get("/static/css/login.css").status_code == 200


def test_primary_sidebar_grammar_is_shared_across_workspace_domains() -> None:
    html = TEMPLATE.read_text()
    styles = (ROOT / "static" / "css" / "ui.css").read_text()
    planning = (ROOT / "static" / "js" / "planning.js").read_text()
    reporting = (ROOT / "static" / "js" / "agent-reporting.js").read_text()

    assert 'class="app-sidebar primary-sidebar"' in html
    assert html.count('class="app-sidebar primary-sidebar"') == 1
    assert html.count('class="app-sidebar__header') == 1
    assert html.count('class="app-sidebar__content') == 1
    for view in ("organization", "workspaces", "schedule", "agents", "documents"):
        assert f'data-sidebar-view="{view}"' in html
    assert 'data-workspace-view="organization"' in html
    assert 'data-workspace-view="workspaces"' in html
    assert 'class="app-sidebar__nav" aria-label="조직 관리"' in html
    assert 'class="app-sidebar__nav app-sidebar__nav--flush" aria-label="내 작업공간"' in html
    assert 'class="app-sidebar__nav" aria-label="일정 탐색"' in planning
    assert 'class="app-sidebar__nav" aria-label="에이전트 탐색"' in reporting
    assert "--ui-sidebar-header-height: 35px" in styles
    assert "--ui-sidebar-row-height: 28px" in styles


def test_activity_bar_supports_persisted_order_and_visibility_controls() -> None:
    script = SCRIPT.read_text()
    assert "agentFactoryActivityOrder" in script
    assert "agentFactoryActivityVisibility" in script
    assert "button.draggable = true" in script
    assert 'addEventListener("contextmenu"' in script
    assert 'event.altKey || !["ArrowUp", "ArrowDown"]' in script
    assert 'addEventListener("drop"' in script
    assert 'showActivityDropIndicator(target, before ? "before" : "after")' in script
    assert 'classList.remove("is-drop-before", "is-drop-after")' in script


def test_empty_document_explorers_stay_visually_quiet() -> None:
    script = (ROOT / "static/js/document-editor.js").read_text()
    assert 'tree.status.textContent = tree.status.hidden ? ""' in script
    assert "연결된 가공 문서가 없습니다." not in script
    assert "연결된 명세 문서가 없습니다." not in script


def test_drive_integration_ui_keeps_reference_and_auth_lifecycles_separate() -> None:
    script = (ROOT / "static/js/integrations.js").read_text()
    assert 'mode: "reference"' in script
    assert 'attachments: false' in script
    assert 'data-unlink-collection' in TEMPLATE.read_text()
    assert 'data-disconnect-account' in TEMPLATE.read_text()
    assert '/authorize' in script
    assert '/drive/folders' in script


def test_workspace_is_accessible_below_factory_root(monkeypatch) -> None:
    monkeypatch.setattr(settings, "root_path", "/factory")
    application = create_app()
    application.dependency_overrides[get_auth_service] = lambda: PageAuthService(False)
    with TestClient(application) as client:
        response = client.get("/factory/", follow_redirects=False)
        assert response.headers["location"] == "/factory/login/"
        assert client.get("/factory/login/").status_code == 200
        assert (
            client.get("/factory/workspace/", follow_redirects=False).headers["location"]
            == "/factory/login/"
        )
        assert client.get("/factory/static/js/workspace.js").status_code == 200
