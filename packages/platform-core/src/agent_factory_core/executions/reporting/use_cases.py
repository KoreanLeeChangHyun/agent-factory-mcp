from __future__ import annotations

import unicodedata
from dataclasses import asdict, replace
from datetime import datetime
from urllib.parse import urlsplit
from uuid import UUID

from agent_factory_core.identity.authorization import (
    AuthorizedContext,
    require_context,
    require_workspace_id,
)
from agent_factory_core.shared.errors import (
    ApplicationError,
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
)

from .domain import (
    ReportAgent,
    ReportingCommand,
    ReportStatus,
    ReportTask,
    RuntimeBinding,
    RuntimeObservation,
    SearchRequest,
    canonical_command_digest,
    require_runtime_binding,
    require_transition,
)
from .ports import Clock, ReportingRepository


class ReportingUseCases:
    def __init__(self, repository: ReportingRepository, clock: Clock) -> None:
        self.repository = repository
        self.clock = clock

    async def snapshot(self, context: AuthorizedContext) -> dict[str, object]:
        require_context(context, "agent.read", "workspace.read")
        result = await self.repository.snapshot(require_workspace_id(context), 1001)
        return {**result, "server_time": self.clock.now().isoformat(), "stale_after_seconds": 300}

    async def detail(
        self, context: AuthorizedContext, task_id: UUID, before_revision: int | None = None
    ) -> dict[str, object]:
        require_context(context, "agent.read", "workspace.read")
        result = await self.repository.detail(
            require_workspace_id(context), task_id, before_revision, 51
        )
        if result is None:
            raise NotFoundError("report_record_not_found", "Record not found in this Workspace")
        return {**result, "server_time": self.clock.now().isoformat(), "stale_after_seconds": 300}

    async def search(self, context: AuthorizedContext, request: SearchRequest) -> dict[str, object]:
        require_context(context, "agent.read", "workspace.read")
        query = request.query.strip()
        if (
            not query
            or len(query) > 256
            or len(query.encode()) > 1024
            or any(unicodedata.category(char).startswith("C") for char in query)
        ):
            raise ApplicationError("invalid_report_search", "Search query is invalid", 422)
        if (
            request.kind not in {"agent", "task", "report", "result"}
            or not 1 <= request.limit <= 100
        ):
            raise ApplicationError("invalid_report_search", "Search kind or limit is invalid", 422)
        result = await self.repository.search(
            require_workspace_id(context),
            SearchRequest(query, request.kind, request.limit, request.after_id),
        )
        return {**result, "server_time": self.clock.now().isoformat(), "stale_after_seconds": 300}

    async def heartbeat(
        self,
        context: AuthorizedContext,
        *,
        task_id: UUID,
        binding: RuntimeBinding,
        sequence: int,
        observed_at: datetime,
        fact: str,
        key: str,
        connection_id: UUID | None = None,
    ) -> dict[str, object]:
        require_context(context, "agent.report")
        if sequence < 1 or fact not in {"process_alive", "process_exited", "unreachable"}:
            raise ApplicationError("invalid_report_heartbeat", "Heartbeat is invalid", 422)
        workspace_id = require_workspace_id(context)
        if not await self.repository.lock_workspace(context.scope.organization_id, workspace_id):
            raise NotFoundError("workspace_not_found", "Workspace not found")
        command = {
            "key": key,
            "operation": "heartbeat",
            "heartbeat": {
                "id": str(task_id),
                "runtime_binding": asdict(binding),
                "sequence": sequence,
                "observed_at": observed_at.isoformat(),
                "fact": fact,
            },
        }
        digest = canonical_command_digest(command)
        replay = await self.repository.replay_receipt(
            workspace_id, context.principal.user_id, key, digest
        )
        if replay is not None:
            await self.repository.commit()
            return replay
        task = await self.repository.get_task(workspace_id, task_id, lock=True)
        if task is None:
            raise NotFoundError("report_record_not_found", "Record not found in this Workspace")
        if task.owner_user_id != context.principal.user_id:
            raise PermissionDeniedError(
                "report_owner_required", "Only the registering user may report"
            )
        require_runtime_binding(task.runtime_binding, binding)
        # The workspace lock serializes the idempotency namespace. Rechecking after
        # the task lock also makes identical delivery deterministic for adapters
        # whose workspace lock is implemented with a narrower transaction scope.
        replay = await self.repository.replay_receipt(
            workspace_id, context.principal.user_id, key, digest
        )
        if replay is not None:
            await self.repository.commit()
            return replay
        now = self.clock.now()
        if observed_at.tzinfo is None or observed_at > now:
            raise ApplicationError("report_heartbeat_future", "Observation time is invalid", 422)
        previous = task.runtime_observation
        if previous and sequence <= previous.sequence:
            raise ConflictError("report_heartbeat_sequence_conflict", "Sequence must increase")
        if previous and observed_at < previous.observed_at:
            raise ConflictError("report_heartbeat_time_conflict", "Observation time regressed")
        receipt = await self.repository.record_observation(
            task,
            RuntimeObservation(sequence, observed_at, now, fact),
            reporter_user_id=context.principal.user_id,
            connection_id=connection_id,
            key=key,
            payload_hash=digest,
        )
        await self.repository.commit()
        return receipt

    async def command(
        self,
        context: AuthorizedContext,
        command: ReportingCommand,
        connection_id: UUID | None = None,
    ) -> dict[str, object]:
        require_context(context, "agent.report")
        self._validate_command(command)
        if command.operation == "heartbeat":
            heartbeat = command.heartbeat
            assert heartbeat is not None
            return await self.heartbeat(
                context,
                task_id=heartbeat.id,
                binding=heartbeat.runtime_binding,
                sequence=heartbeat.sequence,
                observed_at=heartbeat.observed_at,
                fact=heartbeat.fact,
                key=command.key,
                connection_id=connection_id,
            )
        workspace_id = require_workspace_id(context)
        if not await self.repository.lock_workspace(context.scope.organization_id, workspace_id):
            raise NotFoundError("workspace_not_found", "Workspace not found")
        digest = canonical_command_digest(command.canonical_payload())
        replay = await self.repository.replay_receipt(
            workspace_id, context.principal.user_id, command.key, digest
        )
        if replay is not None:
            await self.repository.commit()
            return replay
        if command.operation == "agent":
            return await self._write_agent(context, command, digest, connection_id)
        if command.operation == "task":
            return await self._write_task(context, command, digest, connection_id)
        return await self._write_report(context, command, digest, connection_id)

    async def _write_agent(
        self,
        context: AuthorizedContext,
        command: ReportingCommand,
        digest: str,
        connection_id: UUID | None,
    ) -> dict[str, object]:
        payload = command.agent
        assert payload is not None
        workspace_id = require_workspace_id(context)
        current = await self.repository.get_agent(workspace_id, payload.id)
        if current and current.owner_user_id != context.principal.user_id:
            raise PermissionDeniedError(
                "report_owner_required", "Only the registering user may report"
            )
        actual_revision = current.revision if current else 0
        if actual_revision != payload.revision:
            raise ConflictError(
                "report_revision_conflict", "Read current state before sending a new command"
            )
        await self._validate_hierarchy(workspace_id, "agent", payload.id, payload.parent_id)
        value = ReportAgent(
            payload.id,
            workspace_id,
            context.principal.user_id,
            payload.name.strip(),
            payload.role.strip(),
            payload.responsibilities.strip(),
            actual_revision + 1,
            payload.parent_id,
            current.last_report_at if current else None,
        )
        saved = await self.repository.save_agent(value, actual_revision)
        if saved is None:
            raise ConflictError(
                "report_revision_conflict", "Read current state before sending a new command"
            )
        receipt = await self.repository.record_registration(
            saved,
            operation="agent",
            received_at=self.clock.now(),
            reporter_user_id=context.principal.user_id,
            connection_id=connection_id,
            key=command.key,
            payload_hash=digest,
        )
        await self.repository.commit()
        return receipt

    async def _write_task(
        self,
        context: AuthorizedContext,
        command: ReportingCommand,
        digest: str,
        connection_id: UUID | None,
    ) -> dict[str, object]:
        payload = command.task
        assert payload is not None
        workspace_id = require_workspace_id(context)
        if await self.repository.get_task(workspace_id, payload.id) is not None:
            raise ConflictError("report_task_exists", "Task already exists")
        agent = await self.repository.get_agent(workspace_id, payload.agent_id)
        if agent is None:
            raise NotFoundError("report_record_not_found", "Record not found in this Workspace")
        if agent.owner_user_id != context.principal.user_id:
            raise PermissionDeniedError(
                "report_owner_required", "Only the registering user may report"
            )
        await self._validate_hierarchy(workspace_id, "task", payload.id, payload.parent_id)
        if payload.plan_item_id and not await self.repository.plan_item_exists(
            workspace_id, payload.plan_item_id
        ):
            raise NotFoundError("report_record_not_found", "Record not found in this Workspace")
        task = await self.repository.insert_task(
            ReportTask(
                payload.id,
                workspace_id,
                payload.agent_id,
                context.principal.user_id,
                payload.name.strip(),
                payload.description.strip(),
                ReportStatus.PENDING,
                1,
                payload.parent_id,
                payload.plan_item_id,
                payload.runtime_binding,
            )
        )
        receipt = await self.repository.record_registration(
            task,
            operation="task",
            received_at=self.clock.now(),
            reporter_user_id=context.principal.user_id,
            connection_id=connection_id,
            key=command.key,
            payload_hash=digest,
        )
        await self.repository.commit()
        return receipt

    async def _write_report(
        self,
        context: AuthorizedContext,
        command: ReportingCommand,
        digest: str,
        connection_id: UUID | None,
    ) -> dict[str, object]:
        payload = command.report
        assert payload is not None
        workspace_id = require_workspace_id(context)
        task = await self.repository.get_task(workspace_id, payload.id, lock=True)
        if task is None:
            raise NotFoundError("report_record_not_found", "Record not found in this Workspace")
        if task.owner_user_id != context.principal.user_id:
            raise PermissionDeniedError(
                "report_owner_required", "Only the registering user may report"
            )
        require_runtime_binding(task.runtime_binding, payload.runtime_binding)
        if task.revision != payload.revision:
            raise ConflictError(
                "report_revision_conflict", "Read current state before sending a new command"
            )
        require_transition(task.status, payload.status)
        for result in payload.results:
            self._validate_result(result.url, result.document_id)
            if result.document_id and not await self.repository.document_exists(
                workspace_id, result.document_id
            ):
                raise NotFoundError("document_not_found", "Document unavailable")
        now = self.clock.now()
        updated = replace(
            task,
            status=payload.status,
            revision=task.revision + 1,
            progress=payload.progress if payload.progress is not None else task.progress,
            last_report_at=now,
        )
        receipt = await self.repository.record_report(
            updated,
            payload,
            received_at=now,
            reporter_user_id=context.principal.user_id,
            connection_id=connection_id,
            key=command.key,
            payload_hash=digest,
        )
        await self.repository.commit()
        return receipt

    async def _validate_hierarchy(
        self,
        workspace_id: UUID,
        kind: str,
        identity: UUID,
        parent_id: UUID | None,
    ) -> None:
        visited = {identity}
        while parent_id is not None:
            if parent_id in visited:
                raise ConflictError("report_hierarchy_cycle", "Hierarchy must be cycle-free")
            visited.add(parent_id)
            if len(visited) > 64:
                raise ApplicationError("report_hierarchy_depth", "Hierarchy limit is 64", 422)
            parent = (
                await self.repository.get_agent(workspace_id, parent_id)
                if kind == "agent"
                else await self.repository.get_task(workspace_id, parent_id)
            )
            if parent is None:
                raise NotFoundError("report_record_not_found", "Record not found in this Workspace")
            parent_id = parent.parent_id

    @staticmethod
    def _validate_command(command: ReportingCommand) -> None:
        if not command.key.strip() or len(command.key) > 120:
            raise ApplicationError("invalid_report_command", "Command key is invalid", 422)
        fields = (command.agent, command.task, command.report, command.heartbeat)
        expected = {"agent": 0, "task": 1, "report": 2, "heartbeat": 3}
        if (
            command.operation not in expected
            or fields[expected[command.operation]] is None
            or sum(value is not None for value in fields) != 1
        ):
            raise ApplicationError("invalid_report_command", "Command payload does not match", 422)

    @staticmethod
    def _validate_result(url: str | None, document_id: UUID | None) -> None:
        if url and document_id:
            raise ApplicationError("invalid_report_result", "Choose document or URL", 422)
        if url:
            parsed = urlsplit(url)
            if (
                parsed.scheme not in {"http", "https"}
                or not parsed.hostname
                or parsed.username
                or parsed.password
            ):
                raise ApplicationError("invalid_report_result", "Result URL is invalid", 422)
