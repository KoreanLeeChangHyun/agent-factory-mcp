from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import date
from enum import StrEnum
from uuid import UUID

from agent_factory_core.shared.errors import ApplicationError


class PlanKind(StrEnum):
    DOMAIN = "domain"
    FEATURE = "feature"
    ISSUE = "issue"


class PlanStatus(StrEnum):
    PENDING = "pending"
    ACTIVE = "active"
    DONE = "done"


@dataclass(frozen=True, slots=True)
class PlanItem:
    id: UUID
    workspace_id: UUID
    parent_id: UUID | None
    kind: PlanKind
    name: str
    description: str = ""
    acceptance: str = ""
    assignee: str = ""
    status: PlanStatus = PlanStatus.PENDING
    blocked_reason: str = ""
    start_date: date | None = None
    target_date: date | None = None
    revision: int = 1


@dataclass(frozen=True, slots=True)
class PlanItemDraft:
    kind: PlanKind
    name: str
    parent_id: UUID | None = None
    description: str = ""
    acceptance: str = ""
    assignee: str = ""
    status: PlanStatus = PlanStatus.PENDING
    blocked_reason: str = ""
    start_date: date | None = None
    target_date: date | None = None


@dataclass(frozen=True, slots=True)
class PlanSettings:
    workspace_id: UUID
    launch_date: date | None
    revision: int


def validate_item(draft: PlanItemDraft) -> None:
    if not draft.name.strip():
        raise ApplicationError("invalid_plan_name", "Plan item name is required", 422)
    if draft.start_date and draft.target_date and draft.start_date > draft.target_date:
        raise ApplicationError("invalid_plan_dates", "Start date cannot follow target date", 422)
    if draft.kind == PlanKind.DOMAIN:
        if draft.parent_id is not None:
            raise ApplicationError("invalid_parent", "A top-level item cannot have a parent", 422)
        if (
            draft.status != PlanStatus.PENDING
            or draft.assignee
            or draft.acceptance
            or draft.blocked_reason
        ):
            raise ApplicationError(
                "derived_domain", "Top-level status is derived from child items", 422
            )
    elif draft.parent_id is None:
        raise ApplicationError("invalid_parent", "A parent item is required", 422)
    if draft.kind == PlanKind.ISSUE and (draft.start_date or draft.acceptance):
        raise ApplicationError("issue_fields", "Leaf items use description and target date", 422)


def projected_domain(item: PlanItem, children: list[PlanItem]) -> dict[str, object]:
    starts = [child.start_date for child in children if child.start_date]
    targets = [child.target_date for child in children if child.target_date]
    status = PlanStatus.PENDING
    if children and all(child.status == PlanStatus.DONE for child in children):
        status = PlanStatus.DONE
    elif any(child.status != PlanStatus.PENDING for child in children):
        status = PlanStatus.ACTIVE
    derived_start = min(starts) if starts else None
    derived_target = max(targets) if targets else None
    start = item.start_date or derived_start
    target = item.target_date or derived_target
    return {
        "start_date": start,
        "target_date": target,
        "status": status,
        "configured_start_date": item.start_date,
        "configured_target_date": item.target_date,
        "start_date_source": "explicit"
        if item.start_date
        else "derived"
        if derived_start
        else "unspecified",
        "target_date_source": "explicit"
        if item.target_date
        else "derived"
        if derived_target
        else "unspecified",
        "period_conflict": bool(start and target and start > target),
    }


def update_item(item: PlanItem, draft: PlanItemDraft) -> PlanItem:
    validate_item(draft)
    if item.kind != draft.kind or item.parent_id != draft.parent_id:
        raise ApplicationError(
            "immutable_plan_hierarchy", "Item kind and parent cannot be changed", 422
        )
    return replace(
        item,
        name=draft.name.strip(),
        description=draft.description,
        acceptance=draft.acceptance,
        assignee=draft.assignee,
        status=draft.status,
        blocked_reason=draft.blocked_reason,
        start_date=draft.start_date,
        target_date=draft.target_date,
        revision=item.revision + 1,
    )
