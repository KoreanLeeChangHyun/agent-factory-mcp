"""Authorized read projections for the existing public listing contract."""

from collections.abc import Mapping, Sequence
from typing import Protocol
from uuid import UUID
from agent_factory_core.identity.authorization import AuthorizedContext, require_context, require_workspace_id


class AgentProjectionRepository(Protocol):
    async def list(self, workspace_id: UUID) -> Sequence[Mapping[str, object]]: ...


class AgentQueries:
    def __init__(self, repository: AgentProjectionRepository):
        self.repository = repository

    async def list(self, context: AuthorizedContext) -> Sequence[Mapping[str, object]]:
        require_context(context, "agent.read")
        return await self.repository.list(require_workspace_id(context))
