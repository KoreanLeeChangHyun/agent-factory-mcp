"""Application smoke tests."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.db.session import get_session
from app.main import create_app


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

    client.app.dependency_overrides[get_session] = ready_session
    try:
        response = client.get("/ready")
    finally:
        client.app.dependency_overrides.pop(get_session, None)

    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


def test_root_redirects_to_workspace(client: TestClient) -> None:
    response = client.get("/", follow_redirects=False)

    assert response.status_code == 307
    assert response.headers["location"] == "/workspace/"


def test_workspace_shell_is_served_without_cache(client: TestClient) -> None:
    response = client.get("/workspace/")

    assert response.status_code == 200
    assert "Workspace activities" in response.text
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"
