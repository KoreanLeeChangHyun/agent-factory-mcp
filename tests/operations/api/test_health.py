from api.main import create_app
from fastapi.testclient import TestClient


def test_liveness_and_unconfigured_readiness(monkeypatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    client = TestClient(create_app())
    assert client.get("/livez").json() == {"status": "live"}
    readiness = client.get("/readyz")
    assert readiness.status_code == 503
    assert readiness.json()["database"] == {"configured": False, "checked": False}


def test_reference_workbench_uses_validated_fixture() -> None:
    response = TestClient(create_app()).get("/workbench/reference")
    assert response.status_code == 200
    assert response.json()["descriptor"]["id"] == "documents"
