"""Focused planning validation and aggregation rules."""

from datetime import date
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.common.errors import ApplicationError
from app.modules.planning.schemas import ItemCreate
from app.modules.planning.service import domain_projection, domain_summary, validate_level


def test_domain_summary_retains_unknown_dates_and_partial_completion():
    assert domain_summary([]) == {"start_date": None, "target_date": None, "status": "pending"}
    rows = [
        SimpleNamespace(start_date=date(2026, 9, 8), target_date=date(2026, 9, 20), status="done"),
        SimpleNamespace(start_date=None, target_date=None, status="pending"),
    ]
    assert domain_summary(rows) == {
        "start_date": date(2026, 9, 8),
        "target_date": date(2026, 9, 20),
        "status": "active",
    }
    rows[1].status = "done"
    assert domain_summary(rows)["status"] == "done"


def test_optional_issue_date_and_required_name():
    issue = ItemCreate(kind="issue", name="Implement API")
    assert issue.target_date is None
    with pytest.raises(ValidationError):
        ItemCreate(kind="domain", name="  ")
    with pytest.raises(ValidationError):
        ItemCreate(kind="feature", name="API", start_date="2026-09-20", target_date="2026-09-01")


def test_domain_dates_are_optional_but_status_is_derived():
    validate_level("domain", ItemCreate(kind="domain", name="API", target_date="2026-09-20"))
    with pytest.raises(ApplicationError):
        validate_level("domain", ItemCreate(kind="domain", name="API", status="done"))
    with pytest.raises(ApplicationError):
        validate_level(
            "issue", ItemCreate(kind="issue", name="API", acceptance="Feature criterion")
        )


def test_explicit_dates_override_each_boundary_and_mixed_conflict_is_visible():
    child = ItemCreate(
        kind="feature", name="Child", start_date="2026-09-07", target_date="2026-09-20"
    )
    parent = ItemCreate(kind="domain", name="Parent", start_date="2026-09-10")
    result = domain_projection(parent, [child])
    assert result["start_date"] == date(2026, 9, 10)
    assert result["target_date"] == date(2026, 9, 20)
    assert result["configured_target_date"] is None
    assert result["start_date_source"] == "explicit"
    assert result["target_date_source"] == "derived"
    assert not result["period_conflict"]
    parent.start_date = date(2026, 10, 1)
    assert domain_projection(parent, [child])["period_conflict"]
    assert domain_projection(parent, [])["target_date_source"] == "unspecified"
