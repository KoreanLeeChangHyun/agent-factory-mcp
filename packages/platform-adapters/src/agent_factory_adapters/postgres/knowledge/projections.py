from uuid import UUID
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class PostgresDocumentProjections:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list(self, workspace_id: UUID, document_type: str | None = None):
        rows = await self.session.execute(text('SELECT document_metadata, current_revision_number, document_type, title, slug, status, workspace_id, id, created_at, updated_at, deleted_at, revision FROM documents WHERE workspace_id=:wid AND deleted_at IS NULL AND (:kind IS NULL OR document_type=:kind) ORDER BY updated_at DESC'), {"wid": workspace_id, "kind": document_type})
        return [dict(row) for row in rows.mappings()]
