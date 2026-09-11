"""Scoped persistence; workspace locks serialize hierarchy edits and deletion."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.errors import NotFoundError
from app.modules.planning.models import PlanItem, PlanSettings
from app.modules.workspace.models import Workspace


class PlanningRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def lock(self, organization_id: UUID, workspace_id: UUID):
        record = await self.session.scalar(
            select(Workspace)
            .where(
                Workspace.id == workspace_id,
                Workspace.organization_id == organization_id,
                Workspace.deleted_at.is_(None),
            )
            .with_for_update()
        )
        if record is None:
            raise NotFoundError("workspace_not_found", "워크스페이스를 찾을 수 없습니다.")

    async def list(self, workspace_id: UUID):
        return list(
            await self.session.scalars(
                select(PlanItem)
                .where(
                    PlanItem.workspace_id == workspace_id,
                )
                .order_by(PlanItem.created_at, PlanItem.id)
            )
        )

    async def get(self, workspace_id: UUID, item_id: UUID):
        record = await self.session.scalar(
            select(PlanItem).where(
                PlanItem.workspace_id == workspace_id,
                PlanItem.id == item_id,
            )
        )
        if record is None:
            raise NotFoundError("plan_item_not_found", "일정 항목을 찾을 수 없습니다.")
        return record

    async def settings(self, workspace_id: UUID):
        return await self.session.get(PlanSettings, workspace_id)

    async def add_item(self, record: PlanItem) -> None:
        self.session.add(record)

    async def delete_item(self, record: PlanItem) -> None:
        await self.session.delete(record)

    async def has_linked_report(self, workspace_id: UUID, item_id: UUID) -> bool:
        from app.modules.reporting.models import ReportTask

        return bool(
            await self.session.scalar(
                select(ReportTask.id)
                .where(
                    ReportTask.workspace_id == workspace_id,
                    ReportTask.plan_item_id == item_id,
                )
                .limit(1)
            )
        )

    async def add_settings(self, record: PlanSettings) -> None:
        self.session.add(record)

    async def commit(self) -> None:
        await self.session.commit()
