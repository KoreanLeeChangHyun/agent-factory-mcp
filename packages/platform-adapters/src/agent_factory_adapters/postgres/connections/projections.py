from uuid import UUID
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class PostgresConnectionProjections:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list(self, workspace_id: UUID):
        rows = await self.session.execute(text('SELECT id, workspace_id, provider_id, name, status, external_account_id, sync_cursor, last_synced_at, last_error_code, revision, created_at, updated_at FROM integration_connections WHERE workspace_id=:wid AND deleted_at IS NULL ORDER BY name'), {"wid": workspace_id})
        return [dict(row) for row in rows.mappings()]
