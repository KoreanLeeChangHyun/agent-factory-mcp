from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class PostgresAgentWorkspaceLookup:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def organization_id(self, workspace_id: UUID) -> UUID | None:
        return await self.session.scalar(
            text("SELECT organization_id FROM workspaces WHERE id=:workspace_id"),
            {"workspace_id": workspace_id},
        )
