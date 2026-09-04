"""Production deployment artifact tests."""

from pathlib import Path

import yaml

ROOT = Path(__file__).parents[1]


def test_production_overlay_has_tls_release_and_scaling_boundaries() -> None:
    deployment = yaml.safe_load((ROOT / "deploy/compose.production.yaml").read_text())
    services = deployment["services"]

    assert services["api"]["deploy"]["replicas"] == 2
    assert services["worker"]["deploy"]["replicas"] == 3
    assert services["scheduler"]["deploy"]["replicas"] == 1
    assert services["migrate"]["profiles"] == ["release"]
    assert "443:443" in services["proxy"]["ports"]
    assert services["api"]["environment"]["AGENT_FACTORY_ROOT_PATH"] == "/factory"

    caddyfile = (ROOT / "deploy/Caddyfile").read_text()
    assert "handle_path /factory/*" in caddyfile
    assert "redir /factory /factory/ 308" in caddyfile


def test_operations_runbook_covers_recovery_and_alerting() -> None:
    runbook = (ROOT / "config/operations.md").read_text()
    for term in ("expand/contract", "RPO/RTO", "dead jobs", "queue age", "cost"):
        assert term in runbook
