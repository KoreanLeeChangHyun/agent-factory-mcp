"""SaaS Workspace shell contract tests."""

from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import create_app

ROOT = Path(__file__).parents[1]
TEMPLATE = ROOT / "template" / "workspace" / "index.html"
SCRIPT = ROOT / "static" / "js" / "workspace.js"


def test_workspace_exposes_exactly_six_activities() -> None:
    html = TEMPLATE.read_text()
    assert html.count("data-activity=") == 6
    for label in ("일정", "에이전트", "문서", "외부연동", "로그", "테스트"):
        assert f">{label}</button>" in html


def test_workspace_uses_authenticated_tenant_apis_not_project_files() -> None:
    script = SCRIPT.read_text()
    assert "${rootPath}/api/auth/me" in script
    assert "${rootPath}/api/account/organizations" in script
    assert "X-Organization-ID" in script
    assert "X-Workspace-ID" in script
    assert ".agent-factory" not in script
    assert "/api/explorer-tree" not in script


def test_workspace_assets_are_same_origin_and_accessible() -> None:
    html = TEMPLATE.read_text()
    assert 'lang="ko"' in html
    assert 'role="status"' in html
    assert 'role="alert"' in html
    assert "https://" not in html
    with TestClient(create_app()) as client:
        assert client.get("/workspace/").status_code == 200
        assert client.get("/static/js/workspace.js").status_code == 200
        assert client.get("/static/css/workspace.css").status_code == 200


def test_workspace_is_accessible_below_factory_root(monkeypatch) -> None:
    monkeypatch.setattr(settings, "root_path", "/factory")
    with TestClient(create_app()) as client:
        response = client.get("/factory/", follow_redirects=False)
        assert response.headers["location"] == "/factory/workspace/"
        assert client.get("/factory/workspace/").status_code == 200
        assert client.get("/factory/static/js/workspace.js").status_code == 200
