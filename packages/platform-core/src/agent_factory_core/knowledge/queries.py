"""Authorized read projections for the existing public listing contract."""

from collections.abc import Mapping, Sequence
from typing import Protocol
from uuid import UUID
from agent_factory_core.identity.authorization import AuthorizedContext, require_context, require_workspace_id


from .domain import DocumentType

class DocumentProjectionRepository(Protocol):
    async def list(self, workspace_id: UUID, document_type: str | None = None) -> Sequence[Mapping[str, object]]: ...


class DocumentQueries:
    def __init__(self, repository: DocumentProjectionRepository):
        self.repository = repository

    async def list(self, context: AuthorizedContext, document_type: str | None = None) -> Sequence[Mapping[str, object]]:
        require_context(context, "document.read")
        if document_type is not None:
            document_type = DocumentType(document_type).value
        return await self.repository.list(require_workspace_id(context), document_type)
