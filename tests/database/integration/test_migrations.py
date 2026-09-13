"""Live PostgreSQL migration round-trip smoke test."""

import os
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).parents[3]


@pytest.mark.integration
def test_upgrade_to_head_on_postgresql() -> None:
    database_url = os.getenv("AGENT_FACTORY_TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("AGENT_FACTORY_TEST_DATABASE_URL is not configured")
    environment = os.environ | {"AGENT_FACTORY_DATABASE_URL": database_url}
    subprocess.run(
        ["alembic", "-c", "config/alembic.ini", "upgrade", "head"],
        cwd=ROOT,
        env=environment,
        check=True,
    )
    result = subprocess.run(
        ["alembic", "-c", "config/alembic.ini", "current"],
        cwd=ROOT,
        env=environment,
        check=True,
        capture_output=True,
        text=True,
    )
    assert "0012" in result.stdout
