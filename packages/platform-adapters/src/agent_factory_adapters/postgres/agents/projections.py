from uuid import UUID
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class PostgresAgentProjections:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list(self, workspace_id: UUID):
        rows = await self.session.execute(text('SELECT id, workspace_id, name, slug, description, status, current_version_number, created_at, updated_at, deleted_at, revision FROM agent_definitions WHERE workspace_id=:wid AND deleted_at IS NULL ORDER BY name'), {"wid": workspace_id})
        return [dict(row) for row in rows.mappings()]
