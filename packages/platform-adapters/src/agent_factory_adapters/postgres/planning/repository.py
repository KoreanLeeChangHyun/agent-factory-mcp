from __future__ import annotations

from collections.abc import Mapping
from datetime import date
from uuid import UUID

from agent_factory_core.executions.planning.domain import (
    PlanItem,
    PlanKind,
    PlanSettings,
    PlanStatus,
)
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def _integer(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, (int, str)):
        raise TypeError("stored integer value is invalid")
    return int(value)


def _optional_date(value: object) -> date | None:
    if value is None or isinstance(value, date):
        return value
    raise TypeError("stored planning date is invalid")


class PostgresPlanningRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    @staticmethod
    def _item(row: Mapping[str, object]) -> PlanItem:
        return PlanItem(
            UUID(str(row["id"])),
            UUID(str(row["workspace_id"])),
            UUID(str(row["parent_id"])) if row["parent_id"] else None,
            PlanKind(str(row["kind"])),
            str(row["name"]),
            str(row["description"]),
            str(row["acceptance"]),
            str(row["assignee"]),
            PlanStatus(str(row["status"])),
            str(row["blocked_reason"]),
            _optional_date(row["start_date"]),
            _optional_date(row["target_date"]),
            _integer(row["revision"]),
        )

    async def lock_workspace(self, organization_id: UUID, workspace_id: UUID) -> bool:
        result = await self.session.execute(
            text(
                "SELECT id FROM workspaces WHERE id=:wid AND organization_id=:oid AND deleted_at IS NULL FOR UPDATE"
            ),
            {"wid": workspace_id, "oid": organization_id},
        )
        return result.scalar_one_or_none() is not None

    async def list_items(self, workspace_id: UUID) -> list[PlanItem]:
        rows = (
            await self.session.execute(
                text("SELECT * FROM plan_items WHERE workspace_id=:wid ORDER BY created_at,id"),
                {"wid": workspace_id},
            )
        ).mappings()
        return [self._item(row) for row in rows]

    async def get_item(self, workspace_id: UUID, item_id: UUID) -> PlanItem | None:
        row = (
            (
                await self.session.execute(
                    text("SELECT * FROM plan_items WHERE workspace_id=:wid AND id=:id"),
                    {"wid": workspace_id, "id": item_id},
                )
            )
            .mappings()
            .one_or_none()
        )
        return self._item(row) if row else None

    async def insert_item(self, item: PlanItem) -> PlanItem:
        row = (
            (
                await self.session.execute(
                    text("""INSERT INTO plan_items
            (id,workspace_id,parent_id,kind,name,description,acceptance,assignee,status,blocked_reason,start_date,target_date,revision)
            VALUES (:id,:workspace_id,:parent_id,:kind,:name,:description,:acceptance,:assignee,:status,:blocked_reason,:start_date,:target_date,:revision) RETURNING *"""),
                    self._values(item),
                )
            )
            .mappings()
            .one()
        )
        return self._item(row)

    async def replace_item(self, item: PlanItem, expected_revision: int) -> PlanItem | None:
        row = (
            (
                await self.session.execute(
                    text(
                        """UPDATE plan_items SET name=:name,description=:description,acceptance=:acceptance,assignee=:assignee,status=:status,blocked_reason=:blocked_reason,start_date=:start_date,target_date=:target_date,revision=:revision,updated_at=now() WHERE id=:id AND workspace_id=:workspace_id AND revision=:expected_revision RETURNING *"""
                    ),
                    self._values(item) | {"expected_revision": expected_revision},
                )
            )
            .mappings()
            .one_or_none()
        )
        return self._item(row) if row else None

    @staticmethod
    def _values(item: PlanItem) -> dict[str, object]:
        result = {field: getattr(item, field) for field in item.__dataclass_fields__}
        result["kind"], result["status"] = item.kind.value, item.status.value
        return result

    async def delete_item(self, workspace_id: UUID, item_id: UUID, expected_revision: int) -> bool:
        result = await self.session.execute(
            text(
                "DELETE FROM plan_items WHERE workspace_id=:wid AND id=:id AND revision=:revision"
            ),
            {"wid": workspace_id, "id": item_id, "revision": expected_revision},
        )
        return getattr(result, "rowcount", 0) == 1

    async def has_linked_report(self, workspace_id: UUID, item_id: UUID) -> bool:
        result = await self.session.execute(
            text("SELECT 1 FROM report_tasks WHERE workspace_id=:wid AND plan_item_id=:id LIMIT 1"),
            {"wid": workspace_id, "id": item_id},
        )
        return result.scalar_one_or_none() is not None

    async def get_settings(self, workspace_id: UUID) -> PlanSettings | None:
        row = (
            (
                await self.session.execute(
                    text(
                        "SELECT workspace_id,launch_date,revision FROM plan_settings WHERE workspace_id=:wid"
                    ),
                    {"wid": workspace_id},
                )
            )
            .mappings()
            .one_or_none()
        )
        return (
            PlanSettings(
                workspace_id,
                _optional_date(row["launch_date"]),
                _integer(row["revision"]),
            )
            if row
            else None
        )

    async def save_settings(
        self, settings: PlanSettings, expected_revision: int
    ) -> PlanSettings | None:
        if expected_revision == 0:
            sql = "INSERT INTO plan_settings (workspace_id,launch_date,revision) VALUES (:wid,:launch,1) ON CONFLICT DO NOTHING RETURNING workspace_id,launch_date,revision"
        else:
            sql = "UPDATE plan_settings SET launch_date=:launch,revision=revision+1,updated_at=now() WHERE workspace_id=:wid AND revision=:expected RETURNING workspace_id,launch_date,revision"
        row = (
            (
                await self.session.execute(
                    text(sql),
                    {
                        "wid": settings.workspace_id,
                        "launch": settings.launch_date,
                        "expected": expected_revision,
                    },
                )
            )
            .mappings()
            .one_or_none()
        )
        return (
            PlanSettings(
                UUID(str(row["workspace_id"])),
                _optional_date(row["launch_date"]),
                _integer(row["revision"]),
            )
            if row
            else None
        )

    async def commit(self) -> None:
        await self.session.commit()

    async def rollback(self) -> None:
        await self.session.rollback()
