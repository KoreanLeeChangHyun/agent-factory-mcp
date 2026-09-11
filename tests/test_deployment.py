"""Production deployment artifact tests."""

from pathlib import Path

import yaml

ROOT = Path(__file__).parents[1]


def test_production_overlay_has_tls_release_and_scaling_boundaries() -> None:
    base = yaml.safe_load((ROOT / "deploy/compose.yaml").read_text())
    deployment = yaml.safe_load((ROOT / "deploy/compose.production.yaml").read_text())
    services = deployment["services"]

    assert "postgres-data:/var/lib/postgresql" in base["services"]["postgres"]["volumes"]
    assert services["api"]["deploy"]["replicas"] == 2
    assert services["worker"]["deploy"]["replicas"] == 3
    assert services["scheduler"]["deploy"]["replicas"] == 1
    assert services["migrate"]["profiles"] == ["release"]
    assert "443:443" in services["proxy"]["ports"]
    assert services["api"]["environment"]["AGENT_FACTORY_ROOT_PATH"] == "/factory"

    caddyfile = (ROOT / "deploy/Caddyfile").read_text()
    assert "handle /factory/*" in caddyfile
    assert "redir /factory /factory/ 308" in caddyfile

    smoke = (ROOT / "deploy/smoke.sh").read_text()
    assert 'curl --fail --silent --show-error --location "$root_url"' in smoke


def test_workspace_login_is_visible_before_javascript_boots() -> None:
    login_html = (ROOT / "template/login/index.html").read_text()
    assert "<noscript>" in login_html
    assert "data-google-login" in login_html
    assert "../api/auth/oauth/google/login" in login_html
    assert (ROOT / "static/css/login.css").is_file()
    assert (ROOT / "static/js/login.js").is_file()
    assert (ROOT / "static/images/agent-factory.svg").is_file()
    assert "../static/images/agent-factory.svg" in login_html

    workspace_html = (ROOT / "template/workspace/index.html").read_text()
    assert "data-login-form" not in workspace_html
    assert 'class="activity-bar"' in workspace_html
    assert (
        'class="app-sidebar primary-sidebar af-workbench-panel af-kit af-sidebar-host"'
        in workspace_html
    )
    assert 'data-region="primary-sidebar"' in workspace_html
    assert 'class="workspace af-workbench-panel"' in workspace_html
    assert (ROOT / "static/vendor/tabulator/6.5.2/tabulator.min.css").is_file()
    assert (ROOT / "static/vendor/tabulator/6.5.2/tabulator.min.js").is_file()
    assert (ROOT / "static/vendor/THIRD_PARTY_NOTICES.txt").is_file()

    compose = yaml.safe_load((ROOT / "deploy/compose.yaml").read_text())
    assert (
        "../assets/ui-kit:/srv/agent-factory/assets/ui-kit:ro"
        in compose["services"]["api"]["volumes"]
    )


def test_operations_runbook_covers_recovery_and_alerting() -> None:
    runbook = (ROOT / ".codex/skills/spec-platform/references/operations.md").read_text()
    for term in ("expand/contract", "RPO/RTO", "dead jobs", "queue age", "cost"):
        assert term in runbook
