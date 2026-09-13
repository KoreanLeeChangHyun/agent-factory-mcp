"""Audit and observability boundary tests."""

from fastapi.testclient import TestClient

from app.main import create_app


def test_metrics_endpoint_exposes_request_counters() -> None:
    with TestClient(create_app()) as client:
        client.get("/health")
        response = client.get("/metrics")

    assert response.status_code == 200
    assert "agent_factory_http_requests_total" in response.text


def test_audit_migration_installs_immutability_trigger() -> None:
    migration = (
        __import__("pathlib").Path(__file__).parents[3] / "app/db/migrations/versions/0012_audit.py"
    ).read_text()
    assert "audit_events_immutable" in migration
    assert "BEFORE UPDATE OR DELETE" in migration
