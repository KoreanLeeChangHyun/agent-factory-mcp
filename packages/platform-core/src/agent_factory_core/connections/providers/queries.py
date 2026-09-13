"""Authorized read projections for the existing public listing contract."""

from collections.abc import Mapping, Sequence
from typing import Protocol
from uuid import UUID
from agent_factory_core.identity.authorization import AuthorizedContext, require_context, require_workspace_id


class ConnectionProjectionRepository(Protocol):
    async def list(self, workspace_id: UUID) -> Sequence[Mapping[str, object]]: ...


class ConnectionQueries:
    def __init__(self, repository: ConnectionProjectionRepository):
        self.repository = repository

    async def list(self, context: AuthorizedContext) -> Sequence[Mapping[str, object]]:
        require_context(context, "integration.read")
        return await self.repository.list(require_workspace_id(context))
