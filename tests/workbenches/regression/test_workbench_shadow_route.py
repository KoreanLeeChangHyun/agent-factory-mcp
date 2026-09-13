"""Characterization for the authenticated production React shadow entrypoint."""

from pathlib import Path
from types import SimpleNamespace
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.modules.auth.dependencies import get_auth_service
from app.modules.workspace.workbench_selection import react_workbench_enabled
from app.router import workspace as workspace_routes
from tests.support.auth import PageAuthService
from tests.support.fastapi import dependency_override


def test_workspace_switch_is_fail_closed_and_requires_exact_workspace() -> None:
    organization_id = UUID("11111111-1111-4111-8111-111111111111")
    workspace_id = UUID("22222222-2222-4222-8222-222222222222")
    assert not react_workbench_enabled(
        is_enabled=False,
        rules={"workspaceIds": [str(workspace_id)]},
        organization_id=organization_id,
        workspace_id=workspace_id,
    )
    assert not react_workbench_enabled(
        is_enabled=True,
        rules={},
        organization_id=organization_id,
        workspace_id=workspace_id,
    )
    assert react_workbench_enabled(
        is_enabled=True,
        rules={"workspaceIds": [str(workspace_id)]},
        organization_id=organization_id,
        workspace_id=workspace_id,
    )
    assert not react_workbench_enabled(
        is_enabled=True,
        rules={"workspaceIds": [str(UUID(int=4))]},
        organization_id=organization_id,
        workspace_id=workspace_id,
    )


@pytest.mark.asyncio
async def test_authenticated_workspace_entry_selects_react_and_preserves_deep_state(
    monkeypatch,
) -> None:
    organization_id = UUID("11111111-1111-4111-8111-111111111111")
    workspace_id = UUID("22222222-2222-4222-8222-222222222222")
    context = SimpleNamespace(scope=SimpleNamespace(organization_id=organization_id))
    session = object()
    rollout = {"enabled": True}
    calls = []

    async def rollout_selection(actual_session, *, organization_id, workspace_id):
        calls.append((actual_session, organization_id, workspace_id))
        return rollout["enabled"]

    monkeypatch.setattr(workspace_routes, "react_workbench_rollout", rollout_selection)
    response = await workspace_routes.workspace_entry(
        organization_id,
        workspace_id,
        context,
        session,
        "documents",
        "33333333-3333-4333-8333-333333333333",
    )
    assert response.status_code == 307
    assert response.headers["location"].endswith(
        "/workbench/?organization=11111111-1111-4111-8111-111111111111"
        "&workspace=22222222-2222-4222-8222-222222222222&task=documents"
        "&document=33333333-3333-4333-8333-333333333333"
    )
    rollout["enabled"] = False
    fallback = await workspace_routes.workspace_entry(
        organization_id,
        workspace_id,
        context,
        session,
    )
    assert fallback.headers["location"].endswith("/workspace/")
    assert calls == [
        (session, organization_id, workspace_id),
        (session, organization_id, workspace_id),
    ]


def test_shadow_route_serves_deep_links_and_immutable_assets(tmp_path: Path, monkeypatch) -> None:
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<div id='root'></div>")
    (tmp_path / "assets" / "app-deadbeef.js").write_text("export {}")
    monkeypatch.setattr(workspace_routes, "WORKBENCH_WEB_ROOT", tmp_path)
    application = create_app()
    with (
        dependency_override(application, get_auth_service, lambda: PageAuthService(True)),
        TestClient(application) as client,
    ):
        root = client.get("/workbench", follow_redirects=False)
        assert root.status_code == 307 and root.headers["location"].endswith("/workbench/")
        deep_link = client.get("/workbench/documents/example")
        assert deep_link.status_code == 200
        assert deep_link.headers["cache-control"] == "no-store"
        asset = client.get("/workbench/assets/app-deadbeef.js")
        assert asset.status_code == 200
        assert "immutable" in asset.headers["cache-control"]


def test_shadow_route_reports_missing_build(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(workspace_routes, "WORKBENCH_WEB_ROOT", tmp_path)
    application = create_app()
    with (
        dependency_override(application, get_auth_service, lambda: PageAuthService(True)),
        TestClient(application) as client,
    ):
        response = client.get("/workbench/")
        assert response.status_code == 503
        assert response.json()["detail"]["code"] == "workbench_build_missing"


def test_shadow_route_redirects_unauthenticated_browser() -> None:
    application = create_app()
    with (
        dependency_override(application, get_auth_service, lambda: PageAuthService(False)),
        TestClient(application) as client,
    ):
        response = client.get("/workbench/documents/example", follow_redirects=False)
        assert response.status_code == 307
        assert response.headers["location"].endswith("/login/")
