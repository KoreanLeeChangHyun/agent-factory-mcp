"""Authorized read projections for the existing public listing contract."""

from collections.abc import Mapping, Sequence
from typing import Protocol
from uuid import UUID
from agent_factory_core.identity.authorization import AuthorizedContext, require_context, require_workspace_id


class ScheduleProjectionRepository(Protocol):
    async def logs(self, workspace_id: UUID) -> Sequence[Mapping[str, object]]: ...
    async def agent_job(self, workspace_id: UUID, run_id: UUID) -> Mapping[str, object] | None: ...
    async def list(self, workspace_id: UUID) -> Sequence[Mapping[str, object]]: ...


class ScheduleQueries:
    def __init__(self, repository: ScheduleProjectionRepository):
        self.repository = repository

    async def list(self, context: AuthorizedContext) -> Sequence[Mapping[str, object]]:
        require_context(context, "schedule.read")
        return await self.repository.list(require_workspace_id(context))

    async def logs(self, context: AuthorizedContext):
        require_context(context, "audit.read")
        return await self.repository.logs(require_workspace_id(context))

    async def agent_job(self, context: AuthorizedContext, run_id: UUID):
        require_context(context, "agent.execute")
        return await self.repository.agent_job(require_workspace_id(context), run_id)
