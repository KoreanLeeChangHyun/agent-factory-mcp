"""SaaS Workspace shell contract tests."""

from pathlib import Path

from fastapi.testclient import TestClient

from app.main import create_app

ASSETS = Path(__file__).parents[1] / "static" / "workspace"


def test_workspace_exposes_exactly_six_activities() -> None:
    html = (ASSETS / "index.html").read_text()
    assert html.count("data-activity=") == 6
    for label in ("일정", "에이전트", "문서", "외부연동", "로그", "테스트"):
        assert f">{label}</button>" in html


def test_workspace_uses_authenticated_tenant_apis_not_project_files() -> None:
    script = (ASSETS / "app.js").read_text()
    assert "/api/auth/me" in script
    assert "/api/account/organizations" in script
    assert "X-Organization-ID" in script
    assert "X-Workspace-ID" in script
    assert ".agent-factory" not in script
    assert "/api/explorer-tree" not in script


def test_workspace_assets_are_same_origin_and_accessible() -> None:
    html = (ASSETS / "index.html").read_text()
    assert 'lang="ko"' in html
    assert 'role="status"' in html
    assert 'role="alert"' in html
    assert "https://" not in html
    with TestClient(create_app()) as client:
        assert client.get("/workspace/").status_code == 200
        assert client.get("/workspace/app.js").status_code == 200
