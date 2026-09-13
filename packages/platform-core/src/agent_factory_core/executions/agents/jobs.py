"""Coordinate Agent runs with durable scheduling through application ports."""

from dataclasses import replace

from agent_factory_core.executions.scheduling.domain import Job, new_job
from agent_factory_core.executions.scheduling.ports import JobPublisher, SchedulingRepository

from .domain import AgentRun
from .ports import AgentWorkspaceLookup, Clock


class DurableAgentJobPublisher:
    """Stage Agent execution in the shared Job transaction before broker publication."""

    def __init__(self, repository: SchedulingRepository, workspaces: AgentWorkspaceLookup, publisher: JobPublisher, clock: Clock, max_attempts: int) -> None:
        self.repository = repository
        self.workspaces = workspaces
        self.clock = clock
        self.publisher = publisher
        self.max_attempts = max_attempts

    async def stage(self, run: AgentRun) -> Job:
        organization_id = await self.workspaces.organization_id(run.workspace_id)
        if organization_id is None:
            raise RuntimeError("Agent run Workspace disappeared before Job staging")
        job = new_job(
            organization_id=organization_id,
            workspace_id=run.workspace_id,
            user_id=run.requested_by_user_id,
            task_type="agent.run",
            queue="agents",
            payload={"run_id": str(run.id)},
            idempotency_key=f"agent-run:{run.id}",
            priority=5,
            max_attempts=self.max_attempts,
        )
        staged = await self.repository.insert_job(job)
        await self.repository.append_event(staged, "job.queued", {"run_id": str(run.id)})
        return staged

    def publish(self, job: Job) -> str:
        return self.publisher.publish(job)

    async def record_publication(self, job: Job, publication_id: str) -> None:
        await self.repository.replace_job(replace(job, broker_task_id=publication_id))

    async def cancel(self, run: AgentRun) -> None:
        job = await self.repository.find_job(run.workspace_id, f"agent-run:{run.id}")
        if job is None:
            return
        changed = await self.repository.replace_job(job.request_cancel(self.clock.now()))
        await self.repository.append_event(
            changed, f"job.{changed.status.value}", {"run_id": str(run.id)}
        )
        await self.repository.commit()

