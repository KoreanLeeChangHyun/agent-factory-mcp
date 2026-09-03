"""Application smoke tests."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
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


def test_root_redirects_to_workspace(client: TestClient) -> None:
    response = client.get("/", follow_redirects=False)

    assert response.status_code == 307
    assert response.headers["location"] == "/workspace/"


def test_workspace_shell_is_served_without_cache(client: TestClient) -> None:
    response = client.get("/workspace/")

    assert response.status_code == 200
    assert "작업 표시줄" in response.text
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"
