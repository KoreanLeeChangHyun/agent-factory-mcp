from datetime import date
from uuid import uuid4

import pytest
from agent_factory_core.executions.planning.domain import (
    PlanItem,
    PlanItemDraft,
    PlanKind,
    PlanStatus,
    projected_domain,
    update_item,
    validate_item,
)
from agent_factory_core.shared.errors import ApplicationError


def test_domain_projection_preserves_explicit_boundaries_and_derived_status() -> None:
    workspace, parent_id = uuid4(), uuid4()
    parent = PlanItem(
        parent_id, workspace, None, PlanKind.DOMAIN, "Platform", start_date=date(2026, 9, 10)
    )
    children = [
        PlanItem(
            uuid4(),
            workspace,
            parent_id,
            PlanKind.FEATURE,
            "API",
            status=PlanStatus.DONE,
            start_date=date(2026, 9, 7),
            target_date=date(2026, 9, 20),
        )
    ]
    result = projected_domain(parent, children)
    assert result["start_date"] == date(2026, 9, 10)
    assert result["target_date"] == date(2026, 9, 20)
    assert result["status"] == PlanStatus.DONE
    assert result["start_date_source"] == "explicit"
    assert result["target_date_source"] == "derived"


def test_hierarchy_and_level_fields_remain_immutable() -> None:
    workspace, parent = uuid4(), uuid4()
    item = PlanItem(uuid4(), workspace, parent, PlanKind.FEATURE, "API")
    with pytest.raises(ApplicationError, match="parent"):
        update_item(item, PlanItemDraft(PlanKind.FEATURE, "API", uuid4()))
    with pytest.raises(ApplicationError, match="Leaf"):
        validate_item(
            PlanItemDraft(PlanKind.ISSUE, "Endpoint", parent, start_date=date(2026, 9, 1))
        )
