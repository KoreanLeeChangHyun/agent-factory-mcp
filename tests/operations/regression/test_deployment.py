"""Production deployment artifact tests."""

from pathlib import Path

ROOT = Path(__file__).parents[3]


def test_operations_runbook_covers_recovery_and_alerting() -> None:
    runbook = (ROOT / "../docs/skills/rule-platform/SKILL.md").read_text()
    for term in ("expand/contract", "RPO/RTO", "dead jobs", "queue age", "cost"):
        assert term in runbook
