"""SaaS Workspace shell contract tests."""

from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import create_app
from app.modules.auth.dependencies import get_auth_service
from tests.support.auth import PageAuthService
from tests.support.fastapi import dependency_override

ROOT = Path(__file__).parents[1]
TEMPLATE = ROOT / "template" / "workspace" / "index.html"
SCRIPT = ROOT / "static" / "js" / "workspace.js"
LOGIN_TEMPLATE = ROOT / "template" / "login" / "index.html"


def test_product_ui_bridge_precedes_consumers_and_theme_matches_source() -> None:
    html = TEMPLATE.read_text()
    assert html.index("static/ui/core.js") < html.index("static/js/organizations.js")
    assert html.index("static/css/ui.css") < html.index("static/ui/theme.css")
    assert (ROOT / "static/ui/theme.css").read_bytes() == (
        ROOT / "assets/ui-kit/styles/theme.css"
    ).read_bytes()
    assert "agentFactoryUI" in (ROOT / "static/ui/core.js").read_text()
    assert "static/ui/core.js" not in LOGIN_TEMPLATE.read_text()


def test_workspace_exposes_nine_decided_activities_in_default_order() -> None:
    html = TEMPLATE.read_text()
    assert html.count("data-activity=") == 9
    labels = ("일정", "에이전트", "문서", "로그", "테스트", "연동", "DB", "계정", "슈퍼 관리자")
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
    assert html.count("de-document-header") == 3
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
    with (
        dependency_override(application, get_auth_service, lambda: PageAuthService(True)),
        TestClient(application) as client,
    ):
        assert client.get("/workspace/").status_code == 200
        assert client.get("/static/js/workspace.js").status_code == 200
        assert client.get("/static/js/integrations.js").status_code == 200
        assert client.get("/static/css/workspace.css").status_code == 200
        assert client.get("/static/js/login.js").status_code == 200
        assert client.get("/static/css/login.css").status_code == 200


def test_primary_sidebar_grammar_is_shared_across_workspace_domains() -> None:
    html = TEMPLATE.read_text()
    styles = (ROOT / "static" / "css" / "ui.css").read_text()
    shared_theme = (ROOT / "static" / "ui" / "theme.css").read_text()
    feature_styles = (ROOT / "static" / "css" / "workspace.css").read_text()
    workspace = (ROOT / "static" / "js" / "workspace.js").read_text()
    planning = (ROOT / "static" / "js" / "planning.js").read_text()
    reporting = (ROOT / "static" / "js" / "agent-reporting.js").read_text()

    assert 'class="app-sidebar primary-sidebar af-workbench-panel af-kit af-sidebar-host"' in html
    assert html.count("af-sidebar-host") >= 3
    assert html.count("af-sidebar-view") == 11
    assert 'class="workspace af-workbench-panel"' in html
    assert "af-workbench-panel__header" in html
    assert "af-workbench-panel__body" in html
    assert ".af-workbench-panel" in shared_theme
    for selector in (
        ".af-sidebar-host",
        ".af-sidebar-host__header",
        ".af-sidebar-host__body",
        ".af-sidebar-view",
        ".af-sidebar-section",
        ".af-sidebar-navigation",
        ".af-sidebar-navigation__item",
        ".af-sidebar-state",
    ):
        assert selector in shared_theme
    assert "--ui-workbench-panel-gap: 5px" in styles
    assert "--ui-workbench-panel-radius: 7px" in styles
    assert "data-sidebar-toggle" not in html
    assert 'aria-valuemin="0"' in html
    assert html.count('class="app-sidebar__header') == 1
    assert html.count("app-sidebar__body app-sidebar__content") == 1
    for view in (
        "organization",
        "workspaces",
        "schedule",
        "agents",
        "documents",
        "logs",
        "tests",
        "integrations",
        "database",
        "account",
        "admin",
    ):
        assert f'data-sidebar-view="{view}"' in html
    assert html.count('class="app-sidebar__view sidebar-view') == 11
    assert html.count('class="app-sidebar__section') >= 14
    assert 'class="app-sidebar__section-header de-document-header"' in html
    assert 'class="app-sidebar__section-content document-group__content"' in html
    assert 'data-workspace-view="organization"' in html
    assert 'data-workspace-view="workspaces"' in html
    assert 'class="app-sidebar__nav" aria-label="조직 관리"' in html
    assert "data-workspace-list data-workspace-explorer" in html
    assert "window.agentFactoryUI.explorerTree" in workspace
    assert "window.agentFactoryUI.bindSidebarHost" in workspace
    assert 'document.querySelectorAll("[data-sidebar-view]")' in workspace
    assert "sidebarHost.select(activity)" in workspace
    assert "label: '작업공간 탐색기'" in workspace
    assert "label: '기본 그룹'" in workspace
    assert "multiSelect: false" in workspace
    assert "renderIcon: () => null" in workspace
    assert "grid-template-columns: 14px minmax(0, 1fr)" in feature_styles
    assert (
        '.workspace-explorer .af-explorer-item[aria-level="2"] > .af-explorer-line'
        in feature_styles
    )
    assert "calc(var(--ui-space-1) + var(--ui-space-2))" in feature_styles
    assert html.count("data-sidebar-section-toggle") == 2
    assert "ui.explorerTree" in planning
    assert "label: '일정 탐색기'" in planning
    assert "multiSelect: false" in planning
    assert "toggleOnClick: false" in planning
    assert "renderIcon: planningExplorerIcon" in planning
    assert "기본 그룹" not in planning
    for name in ("task.svg", "task-open.svg", "subtask.svg"):
        icon = ROOT / "static" / "images" / "planning-explorer" / name
        assert icon.is_file()
        source = icon.read_text()
        assert "<svg " in source
        assert 'xmlns="http://www.w3.org/2000/svg"' in source
        assert 'viewBox="0 0 16 16"' in source
        assert 'width="16" height="16"' in source
    assert 'data-plan-action="dashboard" aria-label="일정 대시보드"' in html
    assert 'class="plan-dashboard-views"' in planning
    assert 'aria-label="일정 대시보드 보기"' in planning
    assert "data-plan-view-actions" not in html
    assert "taskList('기한 초과',overdue)" in planning
    assert "plan-day-band" in planning
    assert 'class="plan-timeline-scroll"' in planning
    assert 'class="plan-time-header"' in planning
    assert 'data-plan-column="${value}"' in planning
    assert "data-plan-status" in planning
    assert "scope?.preferences?.write" in planning
    for label in ("전체 일정", "오늘 할 일", "칸반"):
        assert f"'{label}'" in planning
    assert "'주별 일정'" not in planning
    assert 'class="app-sidebar__nav" aria-label="에이전트 탐색"' in reporting
    assert 'class="app-sidebar__section-header"' in reporting
    assert "--ui-workbench-header-height: 35px" in styles
    assert "--ui-sidebar-header-height: var(--ui-workbench-header-height)" in styles
    assert "--ui-sidebar-row-height: 28px" in styles
    for token in (
        "--ui-space-1:",
        "--ui-font-body:",
        "--ui-color-primary:",
        "--ui-color-error:",
        "--ui-control-height:",
        "--ui-control-radius:",
    ):
        assert token in styles
        assert token not in feature_styles
    assert ".app-sidebar__section-header" in styles
    assert ".app-sidebar__icon-button" in styles
    assert "select::picker-icon" in styles
    assert "margin-inline-start: auto" in styles
    assert "if (width < minimumSidebarWidth)" in SCRIPT.read_text()
    assert "setSidebarExpanded(false, persist)" in SCRIPT.read_text()


def test_workspace_connection_headers_share_sidebar_height() -> None:
    html = TEMPLATE.read_text()
    styles = (ROOT / "static" / "css" / "workspace.css").read_text()

    assert 'aria-label="작업공간 패널" data-mcp-tabs' in html
    assert 'data-mcp-tab="overview">작업공간 정보</button>' in html
    assert 'data-mcp-tab="connection">MCP 연결</button>' in html
    assert "연결된 MCP" not in html
    assert (
        ".mcp-panel-header { height: var(--ui-sidebar-header-height); min-height: var(--ui-sidebar-header-height);"
        in styles
    )
    assert html.count('class="mcp-ai-step"') == 4
    assert "data-mcp-client" not in html
    assert "data-mcp-variant" not in html
    assert "data-mcp-command" not in html
    assert "data-mcp-config" not in html
    for label in ("인증 토큰 발급", "MCP 클라이언트 설정 다운로드", "AI 지침 복사", "MCP 연결 확인"):
        assert label in html
    assert "data-mcp-supported-clients" in html
    assert 'maxlength="120"' in html
    assert "data-mcp-token-label" in html
    assert "토큰 이름" in html
    assert "data-mcp-copy-token" not in html
    assert "data-mcp-token-dialog" in html
    assert "bindNativeDialog(el('token-dialog'))" in (ROOT / "static/js/mcp-connection.js").read_text()
    assert "repeat(4, minmax(min-content, 1fr))" in styles
    assert ".mcp-token-issue" not in styles
    assert "JSON.stringify({ name: label })" in (ROOT / "static/js/mcp-connection.js").read_text()
    assert "data-mcp-steps" not in html
    assert "mcp-manual-steps" not in html
    assert ".mcp-section-header, .mcp-step-header" in styles
    assert 'type="hidden" data-mcp-token' in html


def test_admin_catalog_waits_for_iframe_load_without_common_screen_scaffold() -> None:
    admin = (ROOT / "static" / "js" / "admin.js").read_text()
    catalog = (ROOT / "assets" / "ui-kit" / "index.html").read_text()

    assert "frame.hidden = true" in admin
    assert "frame.addEventListener('load'" in admin
    assert "frame.hidden = false" in admin
    assert "공통 화면 골격" not in catalog
    assert 'id="layout-example"' not in catalog
    assert "외부 Page 가공 예제" not in catalog
    assert 'id="webpage-example"' not in catalog
    assert "외부 트리 어댑터" not in catalog
    assert 'id="tree-example"' not in catalog
    assert (
        "export function appShell"
        not in (ROOT / "assets" / "ui-kit" / "src" / "components" / "layouts.js").read_text()
    )
    assert (
        "export function webPage"
        not in (ROOT / "assets" / "ui-kit" / "src" / "components" / "web-components.js").read_text()
    )
    assert (
        "export function treeView"
        not in (ROOT / "assets" / "ui-kit" / "src" / "components" / "web-components.js").read_text()
    )


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


def test_activity_views_use_scoped_local_state_snapshots() -> None:
    workspace = SCRIPT.read_text()
    planning = (ROOT / "static/js/planning.js").read_text()
    reporting = (ROOT / "static/js/agent-reporting.js").read_text()
    documents = (ROOT / "static/js/document-editor.js").read_text()
    integrations = (ROOT / "static/js/integrations.js").read_text()
    organizations = (ROOT / "static/js/organizations.js").read_text()
    admin = (ROOT / "static/js/admin.js").read_text()

    assert "agentFactoryActivityState:v${activityStateVersion}" in workspace
    assert 'preferences: activityState("schedule")' in workspace
    assert 'preferences: activityState("agents")' in workspace
    assert 'preferences: activityState("integrations")' in workspace
    assert 'activityState("organization", false)' in workspace
    assert 'documentEditor?.setPreferences(documentPreferences)' in workspace
    assert "collapsedIds: [...collapsed]" in planning
    assert "selectedTaskId:taskId" in reporting
    assert "collapsedIds:[...tree.collapsed]" in documents
    assert "preferredConnectionId" in integrations
    assert "config?.preferences?.write({view})" in organizations
    assert "preferences?.write({view})" in admin
    assert "sidebarCollapsed: workspaceShell.dataset.sidebarCollapsed" in workspace
    assert "restoreSidebarState(activity || \"workspaces\", forceOpen)" in workspace
    assert 'activity !== "schedule"' in workspace
    assert "setSidebarExpanded(expanded, forceOpen)" in workspace
    assert "${actions}${addButton('domain')}" in planning


def test_empty_document_explorers_stay_visually_quiet() -> None:
    script = (ROOT / "static/js/document-editor.js").read_text()
    assert 'tree.status.textContent = tree.status.hidden ? ""' in script
    assert "연결된 가공 문서가 없습니다." not in script
    assert "연결된 명세 문서가 없습니다." not in script


def test_drive_integration_ui_keeps_reference_and_auth_lifecycles_separate() -> None:
    script = (ROOT / "static/js/integrations.js").read_text()
    assert 'mode: "reference"' in script
    assert "attachments: false" in script
    assert "data-unlink-collection" in TEMPLATE.read_text()
    assert "data-disconnect-account" in TEMPLATE.read_text()
    assert "/authorize" in script
    assert "/drive/folders" in script


def test_workspace_is_accessible_below_factory_root(monkeypatch) -> None:
    monkeypatch.setattr(settings, "root_path", "/factory")
    application = create_app()
    with (
        dependency_override(application, get_auth_service, lambda: PageAuthService(False)),
        TestClient(application) as client,
    ):
        response = client.get("/factory/", follow_redirects=False)
        assert response.headers["location"] == "/factory/login/"
        assert client.get("/factory/login/").status_code == 200
        assert (
            client.get("/factory/workspace/", follow_redirects=False).headers["location"]
            == "/factory/login/"
        )
        assert client.get("/factory/static/js/workspace.js").status_code == 200
