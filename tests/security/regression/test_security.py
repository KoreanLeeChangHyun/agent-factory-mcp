"""HTTP and outbound security baseline tests."""

import pytest
from fastapi.testclient import TestClient

from api.settings import Settings
from api.http.middleware.security import validate_public_https_url
from api.main import create_app


def test_security_headers_are_present() -> None:
    with TestClient(create_app()) as client:
        response = client.get("/health")

    assert response.headers["x-frame-options"] == "DENY"
    assert "frame-ancestors 'none'" in response.headers["content-security-policy"]
    assert response.headers["x-content-type-options"] == "nosniff"


def test_outbound_url_policy_rejects_ssrf_targets_and_credentials() -> None:
    assert validate_public_https_url("https://api.example.com/v1")
    for value in (
        "http://api.example.com",
        "https://localhost/service",
        "https://127.0.0.1/service",
        "https://user:secret@example.com",
        "https://169.254.169.254/latest/meta-data",
    ):
        with pytest.raises(ValueError):
            validate_public_https_url(value)


@pytest.mark.parametrize("value", ["factory", "/factory/", "//factory"])
def test_root_path_rejects_non_normalized_values(value: str) -> None:
    with pytest.raises(ValueError, match="root path"):
        Settings(root_path=value)
