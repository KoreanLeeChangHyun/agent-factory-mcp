from __future__ import annotations

from datetime import datetime
from typing import Protocol
from uuid import UUID

from .domain import (
    ReportAgent,
    ReportTask,
    ReportWrite,
    RuntimeObservation,
    SearchRequest,
)


class ReportingRepository(Protocol):
    async def lock_workspace(self, organization_id: UUID, workspace_id: UUID) -> bool: ...
    async def snapshot(self, workspace_id: UUID, limit: int) -> dict[str, object]: ...
    async def detail(
        self, workspace_id: UUID, task_id: UUID, before_revision: int | None, limit: int
    ) -> dict[str, object] | None: ...
    async def search(self, workspace_id: UUID, request: SearchRequest) -> dict[str, object]: ...
    async def get_task(
        self, workspace_id: UUID, task_id: UUID, *, lock: bool = False
    ) -> ReportTask | None: ...
    async def get_agent(self, workspace_id: UUID, agent_id: UUID) -> ReportAgent | None: ...
    async def save_agent(
        self, value: ReportAgent, expected_revision: int
    ) -> ReportAgent | None: ...
    async def insert_task(self, value: ReportTask) -> ReportTask: ...
    async def plan_item_exists(self, workspace_id: UUID, plan_item_id: UUID) -> bool: ...
    async def document_exists(self, workspace_id: UUID, document_id: UUID) -> bool: ...
    async def record_registration(
        self,
        value: ReportAgent | ReportTask,
        *,
        operation: str,
        received_at: datetime,
        reporter_user_id: UUID,
        connection_id: UUID | None,
        key: str,
        payload_hash: str,
    ) -> dict[str, object]: ...
    async def record_report(
        self,
        task: ReportTask,
        report: ReportWrite,
        *,
        received_at: datetime,
        reporter_user_id: UUID,
        connection_id: UUID | None,
        key: str,
        payload_hash: str,
    ) -> dict[str, object]: ...
    async def record_observation(
        self,
        task: ReportTask,
        observation: RuntimeObservation,
        *,
        reporter_user_id: UUID,
        connection_id: UUID | None,
        key: str,
        payload_hash: str,
    ) -> dict[str, object]: ...
    async def replay_receipt(
        self, workspace_id: UUID, reporter_user_id: UUID, key: str, payload_hash: str
    ) -> dict[str, object] | None: ...
    async def commit(self) -> None: ...
    async def rollback(self) -> None: ...


class Clock(Protocol):
    def now(self) -> datetime: ...
