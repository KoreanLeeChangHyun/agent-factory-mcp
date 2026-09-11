"""Atomic Agent run and durable Job submission use cases."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.exc import IntegrityError

from app.common.errors import ConflictError
from app.modules.agent.models import AgentRun
from app.modules.agent.service import AgentService
from app.modules.auth.authorization import AuthorizedContext, require_workspace_id
from app.modules.schedule.models import Job
from app.modules.schedule.service import ScheduleService


@dataclass(frozen=True)
class AgentExecution:
    run: AgentRun
    job: Job


class AgentExecutionService:
    """Coordinate Agent and scheduling domains behind one reusable boundary."""

    def __init__(self, agents: AgentService, schedules: ScheduleService) -> None:
        self.agents = agents
        self.schedules = schedules

    async def submit(
        self,
        context: AuthorizedContext,
        definition_id: UUID,
        version_id: UUID | None,
        idempotency_key: str,
        input_payload: dict[str, object],
    ) -> AgentExecution:
        try:
            run = await self.agents.prepare_run(
                context,
                definition_id,
                version_id,
                idempotency_key,
                input_payload,
            )
            return await self._persist_and_publish(context, run)
        except IntegrityError as exc:
            await self.schedules.repository.rollback()
            existing = await self.agents.repository.find_run_by_idempotency(
                require_workspace_id(context), idempotency_key
            )
            if existing is None:
                raise ConflictError("agent_run_conflict", "Agent run could not be created") from exc
            return await self._persist_and_publish(context, existing)

    async def retry(self, context: AuthorizedContext, run_id: UUID) -> AgentExecution:
        run = await self.agents.prepare_retry(context, run_id)
        return await self._persist_and_publish(context, run)

    async def _persist_and_publish(
        self, context: AuthorizedContext, run: AgentRun
    ) -> AgentExecution:
        job, _ = await self.schedules.prepare_enqueue(
            context,
            "agent.run",
            "agents",
            {"agent_run_id": str(run.id)},
            f"agent-run:{run.id}",
        )
        await self.schedules.repository.commit()
        if job.celery_task_id is None:
            job.celery_task_id = self.schedules.publisher.publish(job)
            await self.schedules.repository.commit()
        return AgentExecution(run, job)
