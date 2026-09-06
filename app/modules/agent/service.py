"""Versioned Agent and execution lifecycle use cases."""

from __future__ import annotations

from app.modules.auth.authorization import require_context

from uuid import UUID, uuid4

from sqlalchemy.exc import IntegrityError

from app.common.errors import ApplicationError, ConflictError, NotFoundError
from app.modules.agent.models import (
    AgentDefinition,
    AgentRun,
    AgentRunEvent,
    AgentRunStatus,
    AgentStatus,
    AgentVersion,
)
from app.modules.agent.repository import AgentRepository
from app.modules.auth.authorization import AuthorizedContext

TRANSITIONS: dict[AgentRunStatus, frozenset[AgentRunStatus]] = {
    AgentRunStatus.QUEUED: frozenset({AgentRunStatus.RUNNING, AgentRunStatus.CANCELLED}),
    AgentRunStatus.RUNNING: frozenset(
        {AgentRunStatus.SUCCEEDED, AgentRunStatus.FAILED, AgentRunStatus.CANCEL_REQUESTED}
    ),
    AgentRunStatus.CANCEL_REQUESTED: frozenset(
        {AgentRunStatus.CANCELLED, AgentRunStatus.SUCCEEDED, AgentRunStatus.FAILED}
    ),
    AgentRunStatus.SUCCEEDED: frozenset(),
    AgentRunStatus.FAILED: frozenset(),
    AgentRunStatus.CANCELLED: frozenset(),
}


class AgentService:
    def __init__(self, repository: AgentRepository) -> None:
        self.repository = repository

    async def list_definitions(self, context: AuthorizedContext) -> list[AgentDefinition]:
        require_context(context, "agent.read")
        return await self.repository.list_definitions(_workspace_id(context))

    async def create_definition(
        self, context: AuthorizedContext, name: str, slug: str, description: str
    ) -> AgentDefinition:
        require_context(context, "agent.create")
        try:
            record = await self.repository.create_definition(
                _workspace_id(context), name.strip(), slug, description.strip()
            )
            await self.repository.commit()
            return record
        except IntegrityError as exc:
            await self.repository.rollback()
            raise ConflictError("agent_slug_conflict", "Agent slug already exists") from exc

    async def update_definition(
        self,
        context: AuthorizedContext,
        definition_id: UUID,
        name: str,
        description: str,
        status: AgentStatus,
        revision: int,
    ) -> AgentDefinition:
        require_context(context, "agent.update")
        record = await self.repository.update_definition(
            _workspace_id(context),
            definition_id,
            name.strip(),
            description.strip(),
            status,
            revision,
        )
        if record is None:
            raise ConflictError("agent_revision_conflict", "Agent definition changed concurrently")
        await self.repository.commit()
        return record

    async def create_version(
        self,
        context: AuthorizedContext,
        definition_id: UUID,
        instructions: str,
        model: str,
        configuration: dict[str, object],
        allowed_tools: list[str],
    ) -> AgentVersion:
        require_context(context, "agent.update")
        definition = await self._definition(context, definition_id)
        version = await self.repository.create_version(
            definition,
            instructions.strip(),
            model.strip(),
            configuration,
            sorted(set(allowed_tools)),
            context.principal.user_id,
        )
        await self.repository.commit()
        return version

    async def delete_definition(self, context: AuthorizedContext, definition_id: UUID) -> None:
        from datetime import UTC, datetime
        from sqlalchemy import select

        require_context(context, "agent.delete")
        record = await self.repository.session.scalar(
            select(AgentDefinition)
            .where(
                AgentDefinition.id == definition_id,
                AgentDefinition.workspace_id == _workspace_id(context),
                AgentDefinition.deleted_at.is_(None),
            )
            .with_for_update()
        )
        if record is None:
            raise NotFoundError("agent_definition_not_found", "에이전트를 찾을 수 없습니다.")
        record.deleted_at = datetime.now(UTC)
        record.revision += 1
        await self.repository.commit()

    async def list_versions(
        self, context: AuthorizedContext, definition_id: UUID
    ) -> list[AgentVersion]:
        require_context(context, "agent.read")
        await self._definition(context, definition_id)
        return await self.repository.list_versions(_workspace_id(context), definition_id)

    async def create_run(
        self,
        context: AuthorizedContext,
        definition_id: UUID,
        version_id: UUID | None,
        idempotency_key: str,
        input_payload: dict[str, object],
    ) -> AgentRun:
        require_context(context, "agent.execute")
        workspace_id = _workspace_id(context)
        definition = await self._definition(context, definition_id)
        if definition.status != AgentStatus.ACTIVE:
            raise ConflictError("agent_inactive", "Inactive Agent cannot be executed")
        existing = await self.repository.find_run_by_idempotency(workspace_id, idempotency_key)
        if existing is not None:
            return existing
        version = await self.repository.get_version(workspace_id, definition_id, version_id)
        if version is None:
            raise NotFoundError("agent_version_not_found", "Agent version not found")
        try:
            run = await self.repository.create_run(
                workspace_id,
                definition_id,
                version.id,
                context.principal.user_id,
                idempotency_key,
                input_payload,
            )
            await self.repository.commit()
            return run
        except IntegrityError as exc:
            await self.repository.rollback()
            existing = await self.repository.find_run_by_idempotency(workspace_id, idempotency_key)
            if existing is not None:
                return existing
            raise ConflictError("agent_run_conflict", "Agent run could not be created") from exc

    async def list_runs(self, context: AuthorizedContext) -> list[AgentRun]:
        require_context(context, "agent.read")
        return await self.repository.list_runs(_workspace_id(context))

    async def get_run(self, context: AuthorizedContext, run_id: UUID) -> AgentRun:
        require_context(context, "agent.read")
        return await self._run(context, run_id)

    async def _run(self, context: AuthorizedContext, run_id: UUID) -> AgentRun:
        run = await self.repository.get_run(_workspace_id(context), run_id)
        if run is None:
            raise NotFoundError("agent_run_not_found", "Agent run not found")
        return run

    async def cancel_run(self, context: AuthorizedContext, run_id: UUID) -> AgentRun:
        require_context(context, "agent.stop")
        run = await self._run(context, run_id)
        target = (
            AgentRunStatus.CANCELLED
            if run.status == AgentRunStatus.QUEUED
            else AgentRunStatus.CANCEL_REQUESTED
        )
        await self.transition(run, target)
        return run

    async def retry_run(self, context: AuthorizedContext, run_id: UUID) -> AgentRun:
        require_context(context, "agent.execute")
        original = await self._run(context, run_id)
        if original.status not in {AgentRunStatus.FAILED, AgentRunStatus.CANCELLED}:
            raise ConflictError(
                "agent_run_not_retryable", "Only failed or cancelled runs can retry"
            )
        run = await self.repository.create_run(
            original.workspace_id,
            original.agent_definition_id,
            original.agent_version_id,
            context.principal.user_id,
            f"retry:{original.id}:{uuid4().hex}",
            original.input_payload,
            retry_of_run_id=original.id,
        )
        await self.repository.commit()
        return run

    async def transition(self, run: AgentRun, target: AgentRunStatus, **values: object) -> None:
        if target not in TRANSITIONS[run.status]:
            raise ConflictError(
                "invalid_agent_run_transition",
                f"Cannot transition Agent run from {run.status} to {target}",
            )
        await self.repository.transition_run(run, target, **values)  # type: ignore[arg-type]
        await self.repository.commit()

    async def list_events(self, context: AuthorizedContext, run_id: UUID) -> list[AgentRunEvent]:
        require_context(context, "agent.read")
        await self._run(context, run_id)
        return await self.repository.list_events(_workspace_id(context), run_id)

    async def _definition(self, context: AuthorizedContext, definition_id: UUID) -> AgentDefinition:
        record = await self.repository.get_definition(_workspace_id(context), definition_id)
        if record is None:
            raise NotFoundError("agent_not_found", "Agent definition not found")
        return record


def _workspace_id(context: AuthorizedContext) -> UUID:
    if context.scope.workspace_id is None:
        raise ApplicationError("workspace_scope_required", "Workspace scope is required", 400)
    return context.scope.workspace_id
