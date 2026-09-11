"""Agent definition and run persistence."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.agent.models import (
    AgentDefinition,
    AgentRun,
    AgentRunEvent,
    AgentRunStatus,
    AgentStatus,
    AgentVersion,
)


class AgentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_definitions(self, workspace_id: UUID) -> list[AgentDefinition]:
        return list(
            await self.session.scalars(
                select(AgentDefinition)
                .where(
                    AgentDefinition.workspace_id == workspace_id,
                    AgentDefinition.deleted_at.is_(None),
                )
                .order_by(AgentDefinition.name)
            )
        )

    async def get_definition(
        self, workspace_id: UUID, definition_id: UUID, *, lock: bool = False
    ) -> AgentDefinition | None:
        statement = select(AgentDefinition).where(
            AgentDefinition.id == definition_id,
            AgentDefinition.workspace_id == workspace_id,
            AgentDefinition.deleted_at.is_(None),
        )
        if lock:
            statement = statement.with_for_update()
        return await self.session.scalar(statement)

    async def create_definition(
        self, workspace_id: UUID, name: str, slug: str, description: str
    ) -> AgentDefinition:
        definition = AgentDefinition(
            workspace_id=workspace_id, name=name, slug=slug, description=description
        )
        self.session.add(definition)
        await self.session.flush()
        return definition

    async def update_definition(
        self,
        workspace_id: UUID,
        definition_id: UUID,
        name: str,
        description: str,
        status: AgentStatus,
        revision: int,
    ) -> AgentDefinition | None:
        return await self.session.scalar(
            update(AgentDefinition)
            .where(
                AgentDefinition.id == definition_id,
                AgentDefinition.workspace_id == workspace_id,
                AgentDefinition.revision == revision,
                AgentDefinition.deleted_at.is_(None),
            )
            .values(
                name=name,
                description=description,
                status=status,
                revision=AgentDefinition.revision + 1,
            )
            .returning(AgentDefinition)
        )

    async def create_version(
        self,
        definition: AgentDefinition,
        instructions: str,
        model: str,
        configuration: dict[str, object],
        allowed_tools: list[str],
        user_id: UUID,
    ) -> AgentVersion:
        current = await self.session.scalar(
            select(AgentDefinition.current_version_number)
            .where(AgentDefinition.id == definition.id)
            .with_for_update()
        )
        number = int(current or 0) + 1
        version = AgentVersion(
            workspace_id=definition.workspace_id,
            agent_definition_id=definition.id,
            version_number=number,
            instructions=instructions,
            model=model,
            configuration=configuration,
            allowed_tools=allowed_tools,
            created_by_user_id=user_id,
        )
        self.session.add(version)
        definition.current_version_number = number
        definition.revision += 1
        await self.session.flush()
        return version

    async def list_versions(self, workspace_id: UUID, definition_id: UUID) -> list[AgentVersion]:
        return list(
            await self.session.scalars(
                select(AgentVersion)
                .where(
                    AgentVersion.workspace_id == workspace_id,
                    AgentVersion.agent_definition_id == definition_id,
                )
                .order_by(AgentVersion.version_number.desc())
            )
        )

    async def get_version(
        self, workspace_id: UUID, definition_id: UUID, version_id: UUID | None
    ) -> AgentVersion | None:
        statement = select(AgentVersion).where(
            AgentVersion.workspace_id == workspace_id,
            AgentVersion.agent_definition_id == definition_id,
        )
        if version_id is not None:
            statement = statement.where(AgentVersion.id == version_id)
        else:
            statement = statement.order_by(AgentVersion.version_number.desc()).limit(1)
        return await self.session.scalar(statement)

    async def find_run_by_idempotency(self, workspace_id: UUID, key: str) -> AgentRun | None:
        return await self.session.scalar(
            select(AgentRun).where(
                AgentRun.workspace_id == workspace_id, AgentRun.idempotency_key == key
            )
        )

    async def create_run(
        self,
        workspace_id: UUID,
        definition_id: UUID,
        version_id: UUID,
        user_id: UUID,
        idempotency_key: str,
        input_payload: dict[str, object],
        retry_of_run_id: UUID | None = None,
    ) -> AgentRun:
        run = AgentRun(
            workspace_id=workspace_id,
            agent_definition_id=definition_id,
            agent_version_id=version_id,
            requested_by_user_id=user_id,
            retry_of_run_id=retry_of_run_id,
            idempotency_key=idempotency_key,
            input_payload=input_payload,
        )
        self.session.add(run)
        await self.session.flush()
        await self.append_event(run, "run.queued", {})
        return run

    async def get_run(self, workspace_id: UUID, run_id: UUID) -> AgentRun | None:
        return await self.session.scalar(
            select(AgentRun).where(AgentRun.id == run_id, AgentRun.workspace_id == workspace_id)
        )

    async def list_runs(self, workspace_id: UUID, limit: int = 100) -> list[AgentRun]:
        return list(
            await self.session.scalars(
                select(AgentRun)
                .where(AgentRun.workspace_id == workspace_id)
                .order_by(AgentRun.created_at.desc())
                .limit(limit)
            )
        )

    async def transition_run(
        self,
        run: AgentRun,
        target: AgentRunStatus,
        *,
        output: dict[str, object] | None = None,
        error_code: str | None = None,
        error_message: str | None = None,
        input_tokens: int = 0,
        output_tokens: int = 0,
        estimated_cost_usd: float = 0,
    ) -> None:
        now = datetime.now(UTC)
        run.status = target
        if target == AgentRunStatus.RUNNING:
            run.started_at = now
        if target in {AgentRunStatus.SUCCEEDED, AgentRunStatus.FAILED, AgentRunStatus.CANCELLED}:
            run.finished_at = now
        run.output_payload = output
        run.error_code = error_code
        run.error_message = error_message
        run.input_tokens = input_tokens
        run.output_tokens = output_tokens
        run.estimated_cost_usd = estimated_cost_usd
        await self.append_event(run, f"run.{target.value}", {})

    async def append_event(
        self, run: AgentRun, event_type: str, payload: dict[str, object]
    ) -> AgentRunEvent:
        current = await self.session.scalar(
            select(func.coalesce(func.max(AgentRunEvent.sequence), 0)).where(
                AgentRunEvent.agent_run_id == run.id
            )
        )
        event = AgentRunEvent(
            workspace_id=run.workspace_id,
            agent_run_id=run.id,
            sequence=int(current or 0) + 1,
            event_type=event_type,
            payload=payload,
        )
        self.session.add(event)
        await self.session.flush()
        return event

    async def list_events(self, workspace_id: UUID, run_id: UUID) -> list[AgentRunEvent]:
        return list(
            await self.session.scalars(
                select(AgentRunEvent)
                .where(
                    AgentRunEvent.workspace_id == workspace_id,
                    AgentRunEvent.agent_run_id == run_id,
                )
                .order_by(AgentRunEvent.sequence)
            )
        )

    async def commit(self) -> None:
        await self.session.commit()

    async def rollback(self) -> None:
        await self.session.rollback()
