from __future__ import annotations

import re
from uuid import UUID, uuid4

from agent_factory_core.identity.authorization import (
    AuthorizedContext,
    require_context,
    require_workspace_id,
)
from agent_factory_core.shared.errors import ApplicationError, ConflictError, NotFoundError

from .domain import (
    AgentDefinition,
    AgentRun,
    AgentStatus,
    AgentVersion,
    RunEvidence,
    RunStatus,
    revise_definition,
    transition_run,
)
from .ports import AgentJobPublisher, AgentRepository, Clock

_SLUG = re.compile(r"^[a-z][a-z0-9-]{0,119}$")


class AgentUseCases:
    def __init__(
        self, repository: AgentRepository, clock: Clock, publisher: AgentJobPublisher | None = None
    ) -> None:
        self.repository = repository
        self.clock = clock
        self.publisher = publisher

    async def definitions(self, context: AuthorizedContext) -> list[AgentDefinition]:
        require_context(context, "agent.read")
        return await self.repository.list_definitions(require_workspace_id(context))

    async def create_definition(
        self, context: AuthorizedContext, *, name: str, slug: str, description: str = ""
    ) -> AgentDefinition:
        require_context(context, "agent.create")
        workspace_id = await self._lock(context)
        if not name.strip() or not _SLUG.fullmatch(slug):
            raise ApplicationError(
                "invalid_agent_definition", "A valid name and slug are required", 422
            )
        value = AgentDefinition(uuid4(), workspace_id, name.strip(), slug, description.strip())
        try:
            result = await self.repository.insert_definition(value)
            await self.repository.commit()
            return result
        except Exception:
            await self.repository.rollback()
            raise

    async def update_definition(
        self,
        context: AuthorizedContext,
        definition_id: UUID,
        *,
        name: str,
        description: str,
        status: AgentStatus,
        expected_revision: int,
    ) -> AgentDefinition:
        require_context(context, "agent.update")
        workspace_id = await self._lock(context)
        current = await self._definition(workspace_id, definition_id)
        result = await self.repository.replace_definition(
            revise_definition(current, name=name, description=description, status=status),
            expected_revision,
        )
        if result is None:
            await self.repository.rollback()
            raise ConflictError("agent_revision_conflict", "Agent definition changed concurrently")
        await self.repository.commit()
        return result

    async def delete_definition(
        self, context: AuthorizedContext, definition_id: UUID, *, expected_revision: int
    ) -> None:
        require_context(context, "agent.delete")
        workspace_id = await self._lock(context)
        current = await self._definition(workspace_id, definition_id, lock=True)
        if current.revision != expected_revision:
            await self.repository.rollback()
            raise ConflictError("agent_revision_conflict", "Agent definition changed concurrently")
        try:
            deleted = await self.repository.soft_delete_definition(
                workspace_id, definition_id, expected_revision, self.clock.now()
            )
            if not deleted:
                await self.repository.rollback()
                raise ConflictError(
                    "agent_revision_conflict", "Agent definition changed concurrently"
                )
            await self.repository.commit()
        except Exception:
            await self.repository.rollback()
            raise

    async def create_version(
        self,
        context: AuthorizedContext,
        definition_id: UUID,
        *,
        instructions: str,
        model: str,
        configuration: dict[str, object],
        allowed_tools: list[str],
    ) -> AgentVersion:
        require_context(context, "agent.update")
        workspace_id = await self._lock(context)
        definition = await self._definition(workspace_id, definition_id, lock=True)
        if not instructions.strip() or not model.strip():
            raise ApplicationError(
                "invalid_agent_version", "Instructions and model are required", 422
            )
        value = AgentVersion(
            uuid4(),
            workspace_id,
            definition.id,
            definition.current_version_number + 1,
            instructions.strip(),
            model.strip(),
            dict(configuration),
            tuple(sorted(set(allowed_tools))),
            context.principal.user_id,
            self.clock.now(),
        )
        result = await self.repository.insert_version(definition, value)
        await self.repository.commit()
        return result

    async def versions(self, context: AuthorizedContext, definition_id: UUID) -> list[AgentVersion]:
        require_context(context, "agent.read")
        workspace_id = require_workspace_id(context)
        await self._definition(workspace_id, definition_id)
        return await self.repository.list_versions(workspace_id, definition_id)

    async def runs(self, context: AuthorizedContext) -> list[AgentRun]:
        require_context(context, "agent.read")
        return await self.repository.list_runs(require_workspace_id(context))

    async def run(self, context: AuthorizedContext, run_id: UUID) -> AgentRun:
        require_context(context, "agent.read")
        return await self._run(require_workspace_id(context), run_id)

    async def submit(
        self,
        context: AuthorizedContext,
        definition_id: UUID,
        *,
        version_id: UUID | None,
        idempotency_key: str,
        input_payload: dict[str, object],
    ) -> AgentRun:
        require_context(context, "agent.execute")
        if not idempotency_key.strip() or len(idempotency_key) > 160:
            raise ApplicationError(
                "invalid_idempotency_key", "Run idempotency key is required", 422
            )
        workspace_id = await self._lock(context)
        existing = await self.repository.find_run(workspace_id, idempotency_key)
        if existing is not None:
            return existing
        definition = await self._definition(workspace_id, definition_id)
        if definition.status != AgentStatus.ACTIVE:
            raise ConflictError("agent_inactive", "Inactive Agent cannot be executed")
        version = await self.repository.get_version(workspace_id, definition.id, version_id)
        if version is None:
            raise NotFoundError("agent_version_not_found", "Agent version not found")
        return await self._stage_run(
            context,
            definition,
            version,
            idempotency_key=idempotency_key,
            input_payload=input_payload,
        )

    async def _stage_run(
        self,
        context: AuthorizedContext,
        definition: AgentDefinition,
        version: AgentVersion,
        *,
        idempotency_key: str,
        input_payload: dict[str, object],
        retry_of_run_id: UUID | None = None,
    ) -> AgentRun:
        run = await self.repository.insert_run(
            AgentRun(
                uuid4(),
                definition.workspace_id,
                definition.id,
                version.id,
                context.principal.user_id,
                idempotency_key,
                dict(input_payload),
                retry_of_run_id=retry_of_run_id,
            )
        )
        await self.repository.append_event(run, "run.queued", {})
        job = await self.publisher.stage(run) if self.publisher else None
        await self.repository.commit()
        if self.publisher is not None and job is not None:
            publication_id = self.publisher.publish(job)
            await self.publisher.record_publication(job, publication_id)
            await self.repository.commit()
        return run

    async def cancel(self, context: AuthorizedContext, run_id: UUID) -> AgentRun:
        require_context(context, "agent.stop")
        workspace_id = await self._lock(context)
        current = await self._run(workspace_id, run_id, lock=True)
        target = (
            RunStatus.CANCELLED
            if current.status == RunStatus.QUEUED
            else RunStatus.CANCEL_REQUESTED
        )
        result = await self.repository.replace_run(
            transition_run(current, target, now=self.clock.now())
        )
        await self.repository.append_event(result, f"run.{target.value}", {})
        await self.repository.commit()
        if self.publisher is not None and hasattr(self.publisher, "cancel"):
            await self.publisher.cancel(result)
        return result

    async def retry(self, context: AuthorizedContext, run_id: UUID) -> AgentRun:
        require_context(context, "agent.execute")
        workspace_id = await self._lock(context)
        original = await self._run(workspace_id, run_id, lock=True)
        if original.status not in {RunStatus.FAILED, RunStatus.CANCELLED}:
            raise ConflictError(
                "agent_run_not_retryable", "Only failed or cancelled runs can retry"
            )
        definition = await self._definition(workspace_id, original.definition_id)
        version = await self.repository.get_version(
            workspace_id, original.definition_id, original.version_id
        )
        if version is None:
            raise NotFoundError("agent_version_not_found", "Agent version not found")
        return await self._stage_run(
            context,
            definition,
            version,
            idempotency_key=f"retry:{original.id}:{uuid4().hex}",
            input_payload=original.input_payload,
            retry_of_run_id=original.id,
        )

    async def events(self, context: AuthorizedContext, run_id: UUID) -> list[object]:
        require_context(context, "agent.read")
        workspace_id = require_workspace_id(context)
        await self._run(workspace_id, run_id)
        return list(await self.repository.list_events(workspace_id, run_id))

    async def evidence(self, context: AuthorizedContext, run_id: UUID) -> RunEvidence:
        require_context(context, "agent.read")
        workspace_id = require_workspace_id(context)
        run = await self._run(workspace_id, run_id)
        events = await self.repository.list_events(workspace_id, run_id)
        tool_calls = await self.repository.list_tool_calls(workspace_id, run_id)
        artifacts = await self.repository.list_artifacts(workspace_id, run_id)
        documents = await self.repository.list_document_links(workspace_id, run_id)
        return RunEvidence(
            run, tuple(events), tuple(tool_calls), tuple(artifacts), tuple(documents)
        )

    async def _lock(self, context: AuthorizedContext) -> UUID:
        workspace_id = require_workspace_id(context)
        if not await self.repository.lock_workspace(context.scope.organization_id, workspace_id):
            raise NotFoundError("workspace_not_found", "Workspace not found")
        return workspace_id

    async def _definition(
        self, workspace_id: UUID, definition_id: UUID, *, lock: bool = False
    ) -> AgentDefinition:
        result = await self.repository.get_definition(workspace_id, definition_id, lock=lock)
        if result is None:
            raise NotFoundError("agent_not_found", "Agent definition not found")
        return result

    async def _run(self, workspace_id: UUID, run_id: UUID, *, lock: bool = False) -> AgentRun:
        result = await self.repository.get_run(workspace_id, run_id, lock=lock)
        if result is None:
            raise NotFoundError("agent_run_not_found", "Agent run not found")
        return result
