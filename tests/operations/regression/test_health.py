"""Application smoke tests."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.db.session import get_session
from app.main import create_app
from app.modules.auth.dependencies import get_auth_service
from tests.support.auth import PageAuthService
from tests.support.fastapi import dependency_override


@pytest.fixture(scope="module")
def client() -> Iterator[TestClient]:
    application = create_app()
    with TestClient(application) as test_client:
        yield test_client


def test_health(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response.headers["x-request-id"]


def test_client_request_id_is_preserved(client: TestClient) -> None:
    request_id = "e2408c84-5fe7-47ce-a000-2f37e0f0f621"
    response = client.get("/health", headers={"X-Request-ID": request_id})

    assert response.headers["x-request-id"] == request_id


def test_invalid_client_request_id_is_replaced(client: TestClient) -> None:
    response = client.get("/health", headers={"X-Request-ID": "not-a-uuid"})

    assert response.headers["x-request-id"] != "not-a-uuid"
    assert str(response.headers["x-request-id"])


def test_readiness_checks_database(client: TestClient) -> None:
    class ReadySession:
        async def execute(self, _: object) -> None:
            return None

    async def ready_session() -> object:
        yield ReadySession()

    with dependency_override(client.app, get_session, ready_session):
        response = client.get("/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


def test_root_redirects_unauthenticated_user_to_login(client: TestClient) -> None:
    with dependency_override(client.app, get_auth_service, lambda: PageAuthService(False)):
        response = client.get("/", follow_redirects=False)

    assert response.status_code == 307
    assert response.headers["location"] == "/login/"


def test_login_page_is_served_without_cache(client: TestClient) -> None:
    with dependency_override(client.app, get_auth_service, lambda: PageAuthService(False)):
        response = client.get("/login/")

    assert response.status_code == 200
    assert "Workspace 로그인" in response.text
    assert "../static/css/login.css" in response.text
    assert "../static/js/login.js" in response.text
    assert response.headers["cache-control"] == "no-store"


def test_workspace_shell_is_served_without_cache(client: TestClient) -> None:
    with dependency_override(client.app, get_auth_service, lambda: PageAuthService(True)):
        response = client.get("/workspace/")

    assert response.status_code == 200
    assert 'class="activity-bar"' in response.text
    assert 'data-region="primary-sidebar"' in response.text
    assert 'data-workspace-view="documents"' in response.text
    assert response.text.index('aria-label="일정"') < response.text.index('aria-label="에이전트"')
    assert response.text.index('aria-label="에이전트"') < response.text.index('aria-label="문서"')
    assert "../static/css/workspace.css" in response.text
    assert "../static/js/workspace.js" in response.text
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"


def test_workspace_redirects_without_active_session(client: TestClient) -> None:
    with dependency_override(client.app, get_auth_service, lambda: PageAuthService(False)):
        response = client.get("/workspace/", follow_redirects=False)

    assert response.status_code == 307
    assert response.headers["location"] == "/login/"
