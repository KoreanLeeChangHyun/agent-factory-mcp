"""Serialized, owner-bound external reports; never executes an agent."""

import hashlib
import json
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import inspect, select
from sqlalchemy.exc import IntegrityError

from app.common.errors import ApplicationError, ConflictError, NotFoundError, PermissionDeniedError
from app.modules.audit.models import AuditEvent
from app.modules.document.models import Document
from app.modules.planning.models import PlanItem
from app.modules.planning.repository import PlanningRepository
from app.modules.reporting.models import (
    ReportAgent,
    ReportReceipt,
    ReportResult,
    ReportTask,
    TaskReport,
)
from app.modules.workspace.models import Workspace, WorkspaceStatus

TERMINAL = {"completed", "failed", "cancelled"}
TRANSITIONS = {
    "pending": {"in_progress", "input_required", "cancelled"},
    "in_progress": {"in_progress", "input_required", "completed", "failed", "cancelled"},
    "input_required": {"input_required", "in_progress", "cancelled", "failed"},
    "completed": set(),
    "failed": set(),
    "cancelled": set(),
}


def transition(old, new):
    if new not in TRANSITIONS[old]:
        raise ConflictError("invalid_transition", f"Cannot report {old} -> {new}")


def serialize(row):
    result = {}
    for column in inspect(row).mapper.columns:
        value = getattr(row, column.key)
        result[column.key] = (
            value.isoformat()
            if isinstance(value, datetime)
            else str(value)
            if hasattr(value, "hex")
            else value
        )
    return result


def command_digest(command):
    # Preserve hashes of commands accepted before these optional fields existed.
    payload = command.model_dump(mode="json")
    if payload.get("heartbeat") is None:
        payload.pop("heartbeat", None)
    for name in ("task", "report"):
        if payload.get(name) and payload[name].get("runtime_binding") is None:
            payload[name].pop("runtime_binding", None)
    return hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def require_binding(task, binding):
    supplied = binding.model_dump(mode="json") if binding else None
    if task.runtime_binding != supplied:
        raise ConflictError(
            "report_runtime_binding_conflict",
            "Runtime binding must exactly match task registration; use a new task for a new run",
        )


class ReportingService:
    def __init__(self, session, context):
        self.session = session
        self.context = context
        self.workspace_id = context.scope.workspace_id
        self.user_id = context.principal.user_id

    async def get(self, model, identity):
        row = await self.session.scalar(
            select(model).where(model.workspace_id == self.workspace_id, model.id == identity)
        )
        if row is None:
            raise NotFoundError("report_record_not_found", "Record not found in this Workspace")
        return row

    def owner(self, agent):
        if agent.owner_user_id != self.user_id:
            raise PermissionDeniedError(
                "report_owner_required", "Only the registering user may report for this agent"
            )

    @staticmethod
    def revision(row, expected):
        if (row.revision if row else 0) != expected:
            raise ConflictError(
                "report_revision_conflict", "Read current state before sending a new command"
            )

    async def hierarchy(self, model, identity, parent_id):
        visited = {identity}
        while parent_id:
            if parent_id in visited:
                raise ConflictError("report_hierarchy_cycle", "Hierarchy must be cycle-free")
            visited.add(parent_id)
            if len(visited) > 64:
                raise ApplicationError(
                    "report_hierarchy_depth", "Hierarchy limit is 64 levels", 422
                )
            parent_id = (await self.get(model, parent_id)).parent_id
        # Reparenting a populated branch must also keep its deepest descendant in bounds.
        depth = len(visited)
        frontier = [identity]
        while frontier:
            children = list(
                await self.session.scalars(
                    select(model.id).where(
                        model.workspace_id == self.workspace_id, model.parent_id.in_(frontier)
                    )
                )
            )
            if children and depth >= 64:
                raise ApplicationError(
                    "report_hierarchy_depth", "Hierarchy limit is 64 levels", 422
                )
            frontier = children
            depth += 1

    async def command(self, command, connection_id=None):
        try:
            return await self._command(command, connection_id)
        except IntegrityError as exc:
            await self.session.rollback()
            raise ConflictError(
                "report_identity_conflict",
                "Identity or linked record conflicts with persisted data",
            ) from exc

    async def _command(self, command, connection_id=None):
        if "agent.report" not in self.context.permissions:
            raise PermissionDeniedError(
                "permission_required", "Permission required: agent.report"
            )
        # Same workspace lock as planning: validates links and prevents concurrent cycles.
        await PlanningRepository(self.session).lock(
            self.context.scope.organization_id, self.workspace_id
        )
        workspace = await self.session.get(Workspace, self.workspace_id)
        if workspace.status != WorkspaceStatus.ACTIVE:
            raise PermissionDeniedError("workspace_unavailable")
        digest = command_digest(command)
        receipt = await self.session.scalar(
            select(ReportReceipt).where(
                ReportReceipt.workspace_id == self.workspace_id,
                ReportReceipt.reporter_user_id == self.user_id,
                ReportReceipt.key == command.key,
            )
        )
        if receipt:
            if receipt.payload_hash != digest:
                raise ConflictError(
                    "report_idempotency_conflict",
                    "Idempotency key was used with a different payload",
                )
            return receipt.response
        now = datetime.now(UTC)
        report = None
        if command.operation == "agent":
            payload = command.agent
            row = await self.session.scalar(
                select(ReportAgent).where(
                    ReportAgent.workspace_id == self.workspace_id, ReportAgent.id == payload.id
                )
            )
            if row:
                self.owner(row)
            self.revision(row, payload.revision)
            await self.hierarchy(ReportAgent, payload.id, payload.parent_id)
            if row is None:
                row = ReportAgent(
                    id=payload.id,
                    workspace_id=self.workspace_id,
                    owner_user_id=self.user_id,
                    revision=0,
                )
                self.session.add(row)
            for key, value in payload.model_dump(exclude={"revision"}).items():
                setattr(row, key, value)
            row.revision += 1
            # Configuration is not a heartbeat or a report of performed work.
        elif command.operation == "task":
            payload = command.task
            agent = await self.get(ReportAgent, payload.agent_id)
            self.owner(agent)
            existing = await self.session.scalar(
                select(ReportTask.id).where(
                    ReportTask.id == payload.id, ReportTask.workspace_id == self.workspace_id
                )
            )
            if existing:
                raise ConflictError(
                    "report_task_exists", "Task already exists; resume its current revision"
                )
            await self.hierarchy(ReportTask, payload.id, payload.parent_id)
            if payload.plan_item_id:
                await self.get(PlanItem, payload.plan_item_id)
            row = ReportTask(
                workspace_id=self.workspace_id, **{**payload.model_dump(), "runtime_binding": (
                    payload.runtime_binding.model_dump(mode="json")
                    if payload.runtime_binding else None
                )}, revision=1, status="pending"
            )
            self.session.add(row)
        elif command.operation == "heartbeat":
            payload = command.heartbeat
            row = await self.get(ReportTask, payload.id)
            self.owner(await self.get(ReportAgent, row.agent_id))
            require_binding(row, payload.runtime_binding)
            previous = row.runtime_observation
            if previous and payload.sequence <= previous["sequence"]:
                raise ConflictError("report_heartbeat_sequence_conflict", "Sequence must increase")
            if payload.observed_at > now:
                raise ApplicationError("report_heartbeat_future", "Observation is in the future", 422)
            if previous and payload.observed_at < datetime.fromisoformat(previous["observed_at"]):
                raise ConflictError("report_heartbeat_time_conflict", "Observation time regressed")
            row.runtime_observation = {
                "sequence": payload.sequence,
                "observed_at": payload.observed_at.isoformat(),
                "received_at": now.isoformat(),
                "fact": payload.fact,
            }
            # Heartbeats never revise semantic state or refresh semantic report freshness.
        else:
            payload = command.report
            row = await self.get(ReportTask, payload.id)
            agent = await self.get(ReportAgent, row.agent_id)
            self.owner(agent)
            require_binding(row, payload.runtime_binding)
            self.revision(row, payload.revision)
            transition(row.status, payload.status)
            for result in payload.results:
                if result.document_id:
                    document = await self.get(Document, result.document_id)
                    if document.deleted_at:
                        raise NotFoundError("document_not_found", "Document unavailable")
            row.status = payload.status
            row.revision += 1
            if payload.progress is not None:
                row.progress = payload.progress
            if row.status == "in_progress" and row.started_at is None:
                row.started_at = now
            if row.status in TERMINAL:
                row.finished_at = now
            row.last_report_at = now
            agent.last_report_at = now
            report = TaskReport(
                id=uuid4(),
                workspace_id=self.workspace_id,
                task_id=row.id,
                revision=row.revision,
                reporter_user_id=self.user_id,
                connection_id=connection_id,
                audit_event_id=uuid4(),
                received_at=now,
                status=row.status,
                progress=row.progress,
                message=payload.message,
            )
        audit = AuditEvent(
            id=report.audit_event_id if report else uuid4(),
            occurred_at=now,
            actor_user_id=self.user_id,
            organization_id=self.context.scope.organization_id,
            workspace_id=self.workspace_id,
            action=f"external_report.{command.operation}",
            target_type="report_agent" if command.operation == "agent" else "report_task",
            target_id=str(row.id),
            outcome="success",
            source="mcp",
            event_metadata={
                "connection_id": str(connection_id) if connection_id else None,
                "revision": row.revision,
                "idempotency_key": command.key,
            },
        )
        self.session.add(audit)
        await self.session.flush()
        if report:
            self.session.add(report)
            await self.session.flush()
            for result in command.report.results:
                self.session.add(
                    ReportResult(
                        workspace_id=self.workspace_id, report_id=report.id, **result.model_dump()
                    )
                )
        await self.session.flush()
        # UPDATE expires server-generated updated_at; load it within this transaction.
        await self.session.refresh(row)
        response = {
            "record": serialize(row),
            "report_id": str(report.id) if report else None,
            "audit_event_id": str(audit.id),
            "received_at": now.isoformat(),
        }
        self.session.add(
            ReportReceipt(
                workspace_id=self.workspace_id,
                reporter_user_id=self.user_id,
                key=command.key,
                payload_hash=digest,
                response=response,
            )
        )
        await self.session.commit()
        return response

    async def snapshot(self):
        from app.modules.auth.authorization import require_context
        require_context(self.context, "agent.read")
        # Explicit truncation keeps a large workspace from producing an unbounded response.
        agents = list(
            await self.session.scalars(
                select(ReportAgent)
                .where(ReportAgent.workspace_id == self.workspace_id)
                .order_by(ReportAgent.created_at, ReportAgent.id)
                .limit(1001)
            )
        )
        tasks = list(
            await self.session.scalars(
                select(ReportTask)
                .where(ReportTask.workspace_id == self.workspace_id)
                .order_by(ReportTask.updated_at.desc(), ReportTask.id)
                .limit(1001)
            )
        )
        return {
            "agents": [serialize(r) for r in agents[:1000]],
            "tasks": [serialize(r) for r in tasks[:1000]],
            "truncated": len(agents) > 1000 or len(tasks) > 1000,
            "server_time": datetime.now(UTC).isoformat(),
            "stale_after_seconds": 300,
        }

    async def detail(self, task_id, before_revision=None):
        from app.modules.auth.authorization import require_context
        require_context(self.context, "agent.read")
        task = await self.get(ReportTask, task_id)
        query = select(TaskReport).where(
            TaskReport.workspace_id == self.workspace_id, TaskReport.task_id == task.id
        )
        if before_revision is not None:
            query = query.where(TaskReport.revision < before_revision)
        reports = list(
            await self.session.scalars(query.order_by(TaskReport.revision.desc()).limit(51))
        )
        page = reports[:50]
        ids = [r.id for r in page]
        results = (
            list(
                await self.session.scalars(
                    select(ReportResult)
                    .where(
                        ReportResult.workspace_id == self.workspace_id,
                        ReportResult.report_id.in_(ids),
                    )
                    .order_by(ReportResult.id)
                )
            )
            if ids
            else []
        )
        # This projection contains only reporting invocation logs, never unrelated audit data.
        logs = (
            list(
                await self.session.scalars(
                    select(AuditEvent).where(
                        AuditEvent.workspace_id == self.workspace_id,
                        AuditEvent.id.in_([r.audit_event_id for r in page]),
                    )
                )
            )
            if ids
            else []
        )
        return {
            "task": serialize(task),
            "reports": [serialize(r) for r in page],
            "results": [serialize(r) for r in results],
            "logs": [serialize(r) for r in logs],
            "next_before_revision": page[-1].revision if len(reports) > 50 else None,
            "server_time": datetime.now(UTC).isoformat(),
            "stale_after_seconds": 300,
        }
