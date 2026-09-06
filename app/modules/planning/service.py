"""Planning hierarchy, concurrency and derived domain summaries."""

from app.modules.auth.authorization import require_context

from uuid import UUID

from sqlalchemy import select

from app.common.errors import ApplicationError, ConflictError
from app.modules.auth.authorization import AuthorizedContext
from app.modules.planning.models import PlanItem, PlanSettings
from app.modules.planning.repository import PlanningRepository
from app.modules.planning.schemas import ItemCreate, ItemResponse, ItemUpdate, SettingsWrite
from app.modules.workspace.service import _workspace_id


def validate_level(kind, payload):
    if kind == "domain" and (
        payload.status != "pending"
        or payload.assignee
        or payload.acceptance
        or payload.blocked_reason
    ):
        raise ApplicationError(
            "derived_domain",
            "최상위 작업의 상태는 하위 작업에서 집계하며 담당자·완료 조건·막힌 이유는 하위 작업에 입력합니다.",
            422,
        )
    if kind == "issue" and (payload.start_date or payload.acceptance):
        raise ApplicationError("issue_fields", "최하위 작업은 설명과 목표일로 관리합니다.", 422)


def domain_summary(features):
    starts = [item.start_date for item in features if item.start_date]
    ends = [item.target_date for item in features if item.target_date]
    status = "pending"
    if features and all(item.status == "done" for item in features):
        status = "done"
    elif any(item.status != "pending" for item in features):
        status = "active"
    return {
        "start_date": min(starts) if starts else None,
        "target_date": max(ends) if ends else None,
        "status": status,
    }


def domain_projection(row, features):
    summary = domain_summary(features)
    for field in ("start_date", "target_date"):
        configured = getattr(row, field)
        summary["configured_" + field] = configured
        summary[field + "_source"] = (
            "explicit" if configured else "derived" if summary[field] else "unspecified"
        )
        summary[field] = configured or summary[field]
    summary["period_conflict"] = bool(
        summary["start_date"]
        and summary["target_date"]
        and summary["start_date"] > summary["target_date"]
    )
    return summary


class PlanningService:
    def __init__(self, repository: PlanningRepository):
        self.repository = repository

    async def list(self, context: AuthorizedContext):
        require_context(context, "planning.read")
        workspace_id = _workspace_id(context)
        rows = await self.repository.list(workspace_id)
        items = []
        for row in rows:
            item = ItemResponse.model_validate(row).model_dump()
            if row.kind == "domain":
                item.update(domain_projection(row, [r for r in rows if r.parent_id == row.id]))
            items.append(item)
        settings = await self.repository.settings(workspace_id)
        return {
            "items": items,
            "can_edit": "planning.update" in context.permissions,
            "settings": {
                "launch_date": settings.launch_date if settings else None,
                "revision": settings.revision if settings else 0,
            },
        }

    async def lock(self, context):
        await self.repository.lock(context.scope.organization_id, _workspace_id(context))

    async def create(self, context: AuthorizedContext, payload: ItemCreate):
        require_context(context, "planning.create")
        await self.lock(context)
        validate_level(payload.kind, payload)
        workspace_id = _workspace_id(context)
        if payload.kind == "domain":
            if payload.parent_id is not None:
                raise ApplicationError(
                    "invalid_parent", "최상위 작업에는 상위 항목이 없습니다.", 422
                )
        else:
            if payload.parent_id is None:
                raise ApplicationError("invalid_parent", "상위 항목을 선택하세요.", 422)
            parent = await self.repository.get(workspace_id, payload.parent_id)
            if parent.kind != {"feature": "domain", "issue": "feature"}[payload.kind]:
                raise ApplicationError(
                    "invalid_parent", "선택한 상위 작업 바로 아래에 하위 작업을 추가하세요.", 422
                )
        record = PlanItem(workspace_id=workspace_id, **payload.model_dump())
        self.repository.session.add(record)
        await self.repository.session.commit()
        return record

    async def update(self, context: AuthorizedContext, item_id: UUID, payload: ItemUpdate):
        require_context(context, "planning.update")
        await self.lock(context)
        record = await self.repository.get(_workspace_id(context), item_id)
        self.check_revision(record, payload.revision)
        validate_level(record.kind, payload)
        for key, value in payload.model_dump(exclude={"revision"}).items():
            setattr(record, key, value)
        record.revision += 1
        await self.repository.session.commit()
        return record

    async def delete(self, context: AuthorizedContext, item_id: UUID, revision: int):
        require_context(context, "planning.delete")
        await self.lock(context)
        record = await self.repository.get(_workspace_id(context), item_id)
        self.check_revision(record, revision)
        rows = await self.repository.list(_workspace_id(context))
        if any(row.parent_id == item_id for row in rows):
            raise ConflictError("plan_has_children", "하위 항목을 먼저 삭제하세요.")
        from app.modules.reporting.models import ReportTask

        linked_report = await self.repository.session.scalar(
            select(ReportTask.id)
            .where(
                ReportTask.workspace_id == _workspace_id(context),
                ReportTask.plan_item_id == item_id,
            )
            .limit(1)
        )
        if linked_report:
            raise ConflictError(
                "plan_has_reports", "보고 작업이 연결된 일정 항목은 삭제할 수 없습니다."
            )
        await self.repository.session.delete(record)
        await self.repository.session.commit()

    async def update_settings(self, context: AuthorizedContext, payload: SettingsWrite):
        require_context(context, "planning.update")
        await self.lock(context)
        record = await self.repository.settings(_workspace_id(context))
        if payload.revision != (record.revision if record else 0):
            raise ConflictError(
                "plan_revision_conflict", "일정이 변경되었습니다. 새로고침 후 다시 수정하세요."
            )
        if record is None:
            record = PlanSettings(workspace_id=_workspace_id(context), revision=1)
            self.repository.session.add(record)
        else:
            record.revision += 1
        record.launch_date = payload.launch_date
        await self.repository.session.commit()
        return {"launch_date": record.launch_date, "revision": record.revision}

    @staticmethod
    def check_revision(record, revision):
        if record.revision != revision:
            raise ConflictError(
                "plan_revision_conflict", "항목이 변경되었습니다. 새로고침 후 다시 수정하세요."
            )
