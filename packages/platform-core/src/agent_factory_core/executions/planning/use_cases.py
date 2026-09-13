from __future__ import annotations

from datetime import date
from uuid import UUID, uuid4

from agent_factory_core.identity.authorization import (
    AuthorizedContext,
    require_context,
    require_workspace_id,
)
from agent_factory_core.shared.errors import ConflictError, NotFoundError

from .domain import (
    PlanItem,
    PlanItemDraft,
    PlanKind,
    PlanSettings,
    projected_domain,
    update_item,
    validate_item,
)
from .ports import HolidayCalendar, PlanningRepository


class PlanningUseCases:
    def __init__(self, repository: PlanningRepository, calendar: HolidayCalendar) -> None:
        self.repository = repository
        self.calendar = calendar

    async def dashboard(self, context: AuthorizedContext) -> dict[str, object]:
        require_context(context, "planning.read")
        workspace_id = require_workspace_id(context)
        rows = await self.repository.list_items(workspace_id)
        items: list[dict[str, object]] = []
        for row in rows:
            value = {field: getattr(row, field) for field in row.__dataclass_fields__}
            if row.kind == PlanKind.DOMAIN:
                value.update(
                    projected_domain(row, [child for child in rows if child.parent_id == row.id])
                )
            items.append(value)
        settings = await self.repository.get_settings(workspace_id)
        dates = [value for row in rows for value in (row.start_date, row.target_date)]
        if settings:
            dates.append(settings.launch_date)
        return {
            "items": items,
            "can_edit": "planning.update" in context.permissions,
            "calendar": {"country": "KR", "holidays": self.calendar.holidays(dates)},
            "settings": {
                "launch_date": settings.launch_date if settings else None,
                "revision": settings.revision if settings else 0,
            },
        }

    async def create(self, context: AuthorizedContext, draft: PlanItemDraft) -> PlanItem:
        require_context(context, "planning.create")
        validate_item(draft)
        workspace_id = await self._lock(context)
        await self._validate_parent(workspace_id, draft)
        item = PlanItem(
            uuid4(),
            workspace_id,
            draft.parent_id,
            draft.kind,
            draft.name.strip(),
            draft.description,
            draft.acceptance,
            draft.assignee,
            draft.status,
            draft.blocked_reason,
            draft.start_date,
            draft.target_date,
        )
        result = await self.repository.insert_item(item)
        await self.repository.commit()
        return result

    async def update(
        self,
        context: AuthorizedContext,
        item_id: UUID,
        draft: PlanItemDraft,
        expected_revision: int,
    ) -> PlanItem:
        require_context(context, "planning.update")
        workspace_id = await self._lock(context)
        current = await self._item(workspace_id, item_id)
        result = await self.repository.replace_item(update_item(current, draft), expected_revision)
        if result is None:
            await self.repository.rollback()
            raise ConflictError("plan_revision_conflict", "Plan item changed; reload and retry")
        await self.repository.commit()
        return result

    async def delete(
        self, context: AuthorizedContext, item_id: UUID, expected_revision: int
    ) -> None:
        require_context(context, "planning.delete")
        workspace_id = await self._lock(context)
        rows = await self.repository.list_items(workspace_id)
        if any(row.parent_id == item_id for row in rows):
            raise ConflictError("plan_has_children", "Delete child items first")
        if await self.repository.has_linked_report(workspace_id, item_id):
            raise ConflictError("plan_has_reports", "A report-linked plan item cannot be deleted")
        if not await self.repository.delete_item(workspace_id, item_id, expected_revision):
            raise ConflictError("plan_revision_conflict", "Plan item changed; reload and retry")
        await self.repository.commit()

    async def save_settings(
        self, context: AuthorizedContext, launch_date: date | None, expected_revision: int
    ) -> PlanSettings:
        require_context(context, "planning.update")
        workspace_id = await self._lock(context)
        current = await self.repository.get_settings(workspace_id)
        actual = current.revision if current else 0
        if actual != expected_revision:
            raise ConflictError("plan_revision_conflict", "Plan settings changed; reload and retry")
        candidate = PlanSettings(workspace_id, launch_date, actual + 1)
        result = await self.repository.save_settings(candidate, expected_revision)
        if result is None:
            raise ConflictError("plan_revision_conflict", "Plan settings changed; reload and retry")
        await self.repository.commit()
        return result

    async def _lock(self, context: AuthorizedContext) -> UUID:
        workspace_id = require_workspace_id(context)
        if not await self.repository.lock_workspace(context.scope.organization_id, workspace_id):
            raise NotFoundError("workspace_not_found", "Workspace not found")
        return workspace_id

    async def _item(self, workspace_id: UUID, item_id: UUID) -> PlanItem:
        item = await self.repository.get_item(workspace_id, item_id)
        if item is None:
            raise NotFoundError("plan_item_not_found", "Plan item not found")
        return item

    async def _validate_parent(self, workspace_id: UUID, draft: PlanItemDraft) -> None:
        if draft.kind == PlanKind.DOMAIN:
            return
        if draft.parent_id is None:
            raise ConflictError("invalid_parent", "Select the immediate parent level")
        parent = await self._item(workspace_id, draft.parent_id)
        expected = PlanKind.DOMAIN if draft.kind == PlanKind.FEATURE else PlanKind.FEATURE
        if parent.kind != expected:
            raise ConflictError("invalid_parent", "Select the immediate parent level")
