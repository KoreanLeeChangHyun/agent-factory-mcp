from __future__ import annotations

import json
from collections.abc import Mapping
from dataclasses import asdict
from datetime import datetime
from enum import Enum
from typing import cast
from uuid import UUID, uuid4

from agent_factory_core.executions.reporting.domain import (
    ReportAgent,
    ReportStatus,
    ReportTask,
    ReportWrite,
    RuntimeBinding,
    RuntimeObservation,
    SearchRequest,
)
from agent_factory_core.shared.errors import ConflictError
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class PostgresReportingRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def lock_workspace(self, organization_id: UUID, workspace_id: UUID) -> bool:
        row = await self.session.scalar(
            text(
                "SELECT id FROM workspaces WHERE id=:wid AND organization_id=:oid "
                "AND status='active' AND deleted_at IS NULL FOR UPDATE"
            ),
            {"wid": workspace_id, "oid": organization_id},
        )
        return row is not None

    async def snapshot(self, workspace_id: UUID, limit: int) -> dict[str, object]:
        agents = (
            (
                await self.session.execute(
                    text("""SELECT id,parent_id,owner_user_id,name,role,responsibilities,
            revision,last_report_at,created_at,updated_at FROM report_agents WHERE workspace_id=:wid
            ORDER BY created_at,id LIMIT :limit"""),
                    {"wid": workspace_id, "limit": limit},
                )
            )
            .mappings()
            .all()
        )
        tasks = (
            (
                await self.session.execute(
                    text("""SELECT id,agent_id,parent_id,plan_item_id,
            runtime_binding,runtime_observation,name,description,status,progress,revision,started_at,
            finished_at,last_report_at,created_at,updated_at FROM report_tasks WHERE workspace_id=:wid
            ORDER BY updated_at DESC,id LIMIT :limit"""),
                    {"wid": workspace_id, "limit": limit},
                )
            )
            .mappings()
            .all()
        )
        return {
            "agents": [self._json(row) for row in agents[:1000]],
            "tasks": [self._json(row) for row in tasks[:1000]],
            "truncated": len(agents) > 1000 or len(tasks) > 1000,
        }

    async def detail(
        self, workspace_id: UUID, task_id: UUID, before_revision: int | None, limit: int
    ) -> dict[str, object] | None:
        task = (
            (
                await self.session.execute(
                    text("SELECT * FROM report_tasks WHERE workspace_id=:wid AND id=:id"),
                    {"wid": workspace_id, "id": task_id},
                )
            )
            .mappings()
            .one_or_none()
        )
        if task is None:
            return None
        before = "AND revision < :before" if before_revision is not None else ""
        reports = (
            (
                await self.session.execute(
                    text(
                        """SELECT * FROM task_reports
            WHERE workspace_id=:wid AND task_id=:id """
                        + before
                        + " ORDER BY revision DESC LIMIT :limit"
                    ),
                    {"wid": workspace_id, "id": task_id, "before": before_revision, "limit": limit},
                )
            )
            .mappings()
            .all()
        )
        page = reports[:50]
        results: list[Mapping[str, object]] = []
        if page:
            results = list(
                (
                    await self.session.execute(
                        text("""SELECT rr.id,rr.workspace_id,rr.report_id,rr.label,rr.summary,
                CASE WHEN d.id IS NOT NULL AND d.deleted_at IS NULL THEN rr.document_id END AS document_id,
                rr.url,rr.created_at,rr.updated_at FROM report_results rr
                JOIN task_reports tr ON tr.id=rr.report_id AND tr.workspace_id=rr.workspace_id
                LEFT JOIN documents d ON d.id=rr.document_id AND d.workspace_id=rr.workspace_id
                WHERE rr.workspace_id=:wid AND tr.task_id=:tid AND tr.revision=ANY(:revisions)
                ORDER BY rr.id"""),
                        {
                            "wid": workspace_id,
                            "tid": task_id,
                            "revisions": [row["revision"] for row in page],
                        },
                    )
                )
                .mappings()
                .all()
            )
        return {
            "task": self._json(task),
            "reports": [self._json(row) for row in page],
            "results": [self._json(row) for row in results],
            "next_before_revision": page[-1]["revision"] if len(reports) > 50 else None,
        }

    async def search(self, workspace_id: UUID, request: SearchRequest) -> dict[str, object]:
        table, title, body, extras = {
            "agent": ("report_agents", "name", "responsibilities", ("role", "parent_id")),
            "task": (
                "report_tasks",
                "name",
                "description",
                ("agent_id", "parent_id", "runtime_binding"),
            ),
            "report": ("task_reports", "status", "message", ("task_id",)),
            "result": ("report_results", "label", "summary", ("report_id", "document_id", "url")),
        }[request.kind]
        fields = ("id", title, body, *extras)
        predicates = " OR ".join(
            f"position(:query in CAST({field} AS text)) > 0" for field in fields
        )
        cursor = "AND id > :after" if request.after_id else ""
        rows = (
            (
                await self.session.execute(
                    text(
                        f"SELECT id,left({title},200) AS title,left({body},1000) AS excerpt,"  # nosec B608 -- identifiers are fixed above
                        f"{','.join(extras)} FROM {table} WHERE workspace_id=:wid AND ({predicates}) {cursor} "
                        "ORDER BY id LIMIT :limit"
                    ),
                    {
                        "wid": workspace_id,
                        "query": request.query,
                        "after": request.after_id,
                        "limit": request.limit + 1,
                    },
                )
            )
            .mappings()
            .all()
        )
        page = rows[: request.limit]
        return {
            "kind": request.kind,
            "query": request.query,
            "items": [self._json(row) for row in page],
            "next_after_id": str(page[-1]["id"]) if len(rows) > request.limit else None,
        }

    async def get_task(
        self, workspace_id: UUID, task_id: UUID, *, lock: bool = False
    ) -> ReportTask | None:
        row = (
            (
                await self.session.execute(
                    text(
                        """SELECT t.*,a.owner_user_id FROM report_tasks t
            JOIN report_agents a ON a.id=t.agent_id AND a.workspace_id=t.workspace_id
            WHERE t.workspace_id=:wid AND t.id=:id"""
                        + (" FOR UPDATE OF t" if lock else "")
                    ),
                    {"wid": workspace_id, "id": task_id},
                )
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            return None
        binding = RuntimeBinding(**row["runtime_binding"]) if row["runtime_binding"] else None
        observation = row["runtime_observation"]
        runtime = (
            RuntimeObservation(
                observation["sequence"],
                self._datetime(observation["observed_at"]),
                self._datetime(observation["received_at"]),
                observation["fact"],
            )
            if observation
            else None
        )
        return ReportTask(
            UUID(str(row["id"])),
            workspace_id,
            UUID(str(row["agent_id"])),
            UUID(str(row["owner_user_id"])),
            str(row["name"]),
            str(row["description"]),
            ReportStatus(str(row["status"])),
            int(str(row["revision"])),
            UUID(str(row["parent_id"])) if row["parent_id"] else None,
            UUID(str(row["plan_item_id"])) if row["plan_item_id"] else None,
            binding,
            int(str(row["progress"])) if row["progress"] is not None else None,
            cast(datetime | None, row["last_report_at"]),
            runtime,
        )

    async def get_agent(self, workspace_id: UUID, agent_id: UUID) -> ReportAgent | None:
        row = (
            (
                await self.session.execute(
                    text("SELECT * FROM report_agents WHERE workspace_id=:wid AND id=:id"),
                    {"wid": workspace_id, "id": agent_id},
                )
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            return None
        return ReportAgent(
            UUID(str(row["id"])),
            workspace_id,
            UUID(str(row["owner_user_id"])),
            str(row["name"]),
            str(row["role"]),
            str(row["responsibilities"]),
            int(str(row["revision"])),
            UUID(str(row["parent_id"])) if row["parent_id"] else None,
            cast(datetime | None, row["last_report_at"]),
        )

    async def save_agent(self, value: ReportAgent, expected_revision: int) -> ReportAgent | None:
        if expected_revision == 0:
            await self.session.execute(
                text("""INSERT INTO report_agents
                    (id,workspace_id,owner_user_id,parent_id,name,role,responsibilities,revision)
                    VALUES (:id,:wid,:uid,:parent,:name,:role,:responsibilities,1)"""),
                {
                    "id": value.id,
                    "wid": value.workspace_id,
                    "uid": value.owner_user_id,
                    "parent": value.parent_id,
                    "name": value.name,
                    "role": value.role,
                    "responsibilities": value.responsibilities,
                },
            )
            return value
        row = (
            (
                await self.session.execute(
                    text("""UPDATE report_agents SET parent_id=:parent,name=:name,role=:role,
                    responsibilities=:responsibilities,revision=revision+1,updated_at=now()
                    WHERE id=:id AND workspace_id=:wid AND owner_user_id=:uid
                    AND revision=:revision RETURNING *"""),
                    {
                        "id": value.id,
                        "wid": value.workspace_id,
                        "uid": value.owner_user_id,
                        "parent": value.parent_id,
                        "name": value.name,
                        "role": value.role,
                        "responsibilities": value.responsibilities,
                        "revision": expected_revision,
                    },
                )
            )
            .mappings()
            .one_or_none()
        )
        return value if row else None

    async def insert_task(self, value: ReportTask) -> ReportTask:
        await self.session.execute(
            text("""INSERT INTO report_tasks
                (id,workspace_id,agent_id,parent_id,plan_item_id,runtime_binding,name,
                description,status,progress,revision)
                VALUES (:id,:wid,:agent,:parent,:plan,CAST(:binding AS jsonb),:name,
                :description,:status,:progress,:revision)"""),
            {
                "id": value.id,
                "wid": value.workspace_id,
                "agent": value.agent_id,
                "parent": value.parent_id,
                "plan": value.plan_item_id,
                "binding": json.dumps(asdict(value.runtime_binding))
                if value.runtime_binding
                else None,
                "name": value.name,
                "description": value.description,
                "status": value.status.value,
                "progress": value.progress,
                "revision": value.revision,
            },
        )
        return value

    async def plan_item_exists(self, workspace_id: UUID, plan_item_id: UUID) -> bool:
        return bool(
            await self.session.scalar(
                text("SELECT EXISTS(SELECT 1 FROM plan_items WHERE workspace_id=:wid AND id=:id)"),
                {"wid": workspace_id, "id": plan_item_id},
            )
        )

    async def document_exists(self, workspace_id: UUID, document_id: UUID) -> bool:
        return bool(
            await self.session.scalar(
                text("""SELECT EXISTS(SELECT 1 FROM documents WHERE workspace_id=:wid
                    AND id=:id AND deleted_at IS NULL)"""),
                {"wid": workspace_id, "id": document_id},
            )
        )

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
    ) -> dict[str, object]:
        return await self._audit_and_receipt(
            value,
            operation=operation,
            received_at=received_at,
            reporter_user_id=reporter_user_id,
            connection_id=connection_id,
            key=key,
            payload_hash=payload_hash,
            report_id=None,
        )

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
    ) -> dict[str, object]:
        report_id, audit_id = uuid4(), uuid4()
        await self.session.execute(
            text("""UPDATE report_tasks SET status=:status,revision=:revision,progress=:progress,
                started_at=CASE WHEN :status='in_progress' THEN COALESCE(started_at,:now)
                    ELSE started_at END,
                finished_at=CASE WHEN :status IN ('completed','failed','cancelled') THEN :now
                    ELSE finished_at END,last_report_at=:now,updated_at=:now
                WHERE id=:id AND workspace_id=:wid"""),
            {
                "status": task.status.value,
                "revision": task.revision,
                "progress": task.progress,
                "now": received_at,
                "id": task.id,
                "wid": task.workspace_id,
            },
        )
        await self.session.execute(
            text("""UPDATE report_agents SET last_report_at=:now,updated_at=:now
                WHERE id=:id AND workspace_id=:wid"""),
            {"now": received_at, "id": task.agent_id, "wid": task.workspace_id},
        )
        await self._insert_audit(
            audit_id,
            value=task,
            operation="report",
            received_at=received_at,
            reporter_user_id=reporter_user_id,
            connection_id=connection_id,
            key=key,
        )
        await self.session.execute(
            text("""INSERT INTO task_reports
                (id,workspace_id,task_id,revision,reporter_user_id,connection_id,audit_event_id,
                received_at,status,progress,message) VALUES
                (:id,:wid,:task,:revision,:uid,:connection,:audit,:now,:status,:progress,:message)"""),
            {
                "id": report_id,
                "wid": task.workspace_id,
                "task": task.id,
                "revision": task.revision,
                "uid": reporter_user_id,
                "connection": connection_id,
                "audit": audit_id,
                "now": received_at,
                "status": task.status.value,
                "progress": task.progress,
                "message": report.message,
            },
        )
        for result in report.results:
            await self.session.execute(
                text("""INSERT INTO report_results
                    (id,workspace_id,report_id,label,summary,document_id,url)
                    VALUES (:id,:wid,:report,:label,:summary,:document,:url)"""),
                {
                    "id": uuid4(),
                    "wid": task.workspace_id,
                    "report": report_id,
                    "label": result.label,
                    "summary": result.summary,
                    "document": result.document_id,
                    "url": result.url,
                },
            )
        return await self._store_receipt(
            task,
            report_id=report_id,
            audit_id=audit_id,
            received_at=received_at,
            reporter_user_id=reporter_user_id,
            key=key,
            payload_hash=payload_hash,
        )

    async def replay_receipt(
        self, workspace_id: UUID, reporter_user_id: UUID, key: str, payload_hash: str
    ) -> dict[str, object] | None:
        row = (
            (
                await self.session.execute(
                    text("""SELECT payload_hash,response FROM report_receipts
            WHERE workspace_id=:wid AND reporter_user_id=:uid AND key=:key"""),
                    {"wid": workspace_id, "uid": reporter_user_id, "key": key},
                )
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            return None
        if row["payload_hash"] != payload_hash:
            raise ConflictError(
                "report_idempotency_conflict", "Idempotency key has different content"
            )
        return dict(row["response"])

    async def record_observation(
        self,
        task: ReportTask,
        observation: RuntimeObservation,
        *,
        reporter_user_id: UUID,
        connection_id: UUID | None,
        key: str,
        payload_hash: str,
    ) -> dict[str, object]:
        audit_id, receipt_id = uuid4(), uuid4()
        value = {
            "sequence": observation.sequence,
            "observed_at": observation.observed_at.isoformat(),
            "received_at": observation.received_at.isoformat(),
            "fact": observation.fact,
        }
        await self.session.execute(
            text("""UPDATE report_tasks SET runtime_observation=CAST(:value AS jsonb),
            updated_at=now() WHERE workspace_id=:wid AND id=:id"""),
            {"value": json.dumps(value), "wid": task.workspace_id, "id": task.id},
        )
        await self.session.execute(
            text("""INSERT INTO audit_events
            (id,occurred_at,actor_user_id,organization_id,workspace_id,action,target_type,target_id,
            outcome,source,event_metadata) SELECT :aid,:now,:uid,w.organization_id,:wid,
            'external_report.heartbeat','report_task',:target,'success','mcp',CAST(:metadata AS jsonb)
            FROM workspaces w WHERE w.id=:wid"""),
            {
                "aid": audit_id,
                "now": observation.received_at,
                "uid": reporter_user_id,
                "wid": task.workspace_id,
                "target": str(task.id),
                "metadata": json.dumps(
                    {
                        "connection_id": str(connection_id) if connection_id else None,
                        "revision": task.revision,
                        "idempotency_key": key,
                    }
                ),
            },
        )
        response = {
            "record": {"id": str(task.id), "revision": task.revision, "runtime_observation": value},
            "report_id": None,
            "audit_event_id": str(audit_id),
            "received_at": observation.received_at.isoformat(),
        }
        await self.session.execute(
            text("""INSERT INTO report_receipts
            (id,workspace_id,reporter_user_id,key,payload_hash,response)
            VALUES (:id,:wid,:uid,:key,:hash,CAST(:response AS jsonb))"""),
            {
                "id": receipt_id,
                "wid": task.workspace_id,
                "uid": reporter_user_id,
                "key": key,
                "hash": payload_hash,
                "response": json.dumps(response),
            },
        )
        return response

    async def _audit_and_receipt(
        self,
        value: ReportAgent | ReportTask,
        *,
        operation: str,
        received_at: datetime,
        reporter_user_id: UUID,
        connection_id: UUID | None,
        key: str,
        payload_hash: str,
        report_id: UUID | None,
    ) -> dict[str, object]:
        audit_id = uuid4()
        await self._insert_audit(
            audit_id,
            value=value,
            operation=operation,
            received_at=received_at,
            reporter_user_id=reporter_user_id,
            connection_id=connection_id,
            key=key,
        )
        return await self._store_receipt(
            value,
            report_id=report_id,
            audit_id=audit_id,
            received_at=received_at,
            reporter_user_id=reporter_user_id,
            key=key,
            payload_hash=payload_hash,
        )

    async def _insert_audit(
        self,
        audit_id: UUID,
        *,
        value: ReportAgent | ReportTask,
        operation: str,
        received_at: datetime,
        reporter_user_id: UUID,
        connection_id: UUID | None,
        key: str,
    ) -> None:
        await self.session.execute(
            text("""INSERT INTO audit_events
                (id,occurred_at,actor_user_id,organization_id,workspace_id,action,target_type,
                target_id,outcome,source,event_metadata)
                SELECT :id,:now,:uid,w.organization_id,:wid,:action,:target_type,:target,
                'success','mcp',CAST(:metadata AS jsonb) FROM workspaces w WHERE w.id=:wid"""),
            {
                "id": audit_id,
                "now": received_at,
                "uid": reporter_user_id,
                "wid": value.workspace_id,
                "action": f"external_report.{operation}",
                "target_type": "report_agent" if isinstance(value, ReportAgent) else "report_task",
                "target": str(value.id),
                "metadata": json.dumps(
                    {
                        "connection_id": str(connection_id) if connection_id else None,
                        "revision": value.revision,
                        "idempotency_key": key,
                    }
                ),
            },
        )

    async def _store_receipt(
        self,
        value: ReportAgent | ReportTask,
        *,
        report_id: UUID | None,
        audit_id: UUID,
        received_at: datetime,
        reporter_user_id: UUID,
        key: str,
        payload_hash: str,
    ) -> dict[str, object]:
        response = {
            "record": self._record(value),
            "report_id": str(report_id) if report_id else None,
            "audit_event_id": str(audit_id),
            "received_at": received_at.isoformat(),
        }
        await self.session.execute(
            text("""INSERT INTO report_receipts
                (id,workspace_id,reporter_user_id,key,payload_hash,response)
                VALUES (:id,:wid,:uid,:key,:hash,CAST(:response AS jsonb))"""),
            {
                "id": uuid4(),
                "wid": value.workspace_id,
                "uid": reporter_user_id,
                "key": key,
                "hash": payload_hash,
                "response": json.dumps(response),
            },
        )
        return response

    @staticmethod
    def _record(value: ReportAgent | ReportTask) -> dict[str, object]:
        return {
            key: PostgresReportingRepository._json_value(item)
            for key, item in asdict(value).items()
        }

    @staticmethod
    def _json_value(value: object) -> object:
        if isinstance(value, UUID):
            return str(value)
        if isinstance(value, datetime):
            return value.isoformat()
        if isinstance(value, Enum):
            return value.value
        if isinstance(value, dict):
            return {
                str(key): PostgresReportingRepository._json_value(item)
                for key, item in value.items()
            }
        if isinstance(value, (list, tuple)):
            return [PostgresReportingRepository._json_value(item) for item in value]
        return value

    @staticmethod
    def _json(row: Mapping[str, object]) -> dict[str, object]:
        return {
            key: value.isoformat()
            if hasattr(value, "isoformat")
            else str(value)
            if isinstance(value, UUID)
            else value
            for key, value in row.items()
        }

    @staticmethod
    def _datetime(value: object):
        from datetime import datetime

        return value if isinstance(value, datetime) else datetime.fromisoformat(str(value))

    async def commit(self) -> None:
        await self.session.commit()

    async def rollback(self) -> None:
        await self.session.rollback()
