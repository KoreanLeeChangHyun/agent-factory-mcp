from datetime import datetime
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from agent_factory_core.connections.mcp.access import MCPTokenBinding
from .mcp import PostgresMCPConnectionRepository


class PostgresMCPAccessRepository:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.connections = PostgresMCPConnectionRepository(session)

    async def token_binding(self, token_id: UUID) -> MCPTokenBinding | None:
        await self.session.execute(text("SELECT set_config('app.is_platform_admin', 'true', true)"))
        row = (await self.session.execute(text("SELECT id, user_id, organization_id, workspace_id FROM mcp_connections WHERE token_id=:id"), {"id": token_id})).mappings().one_or_none()
        return MCPTokenBinding(row['id'], row['user_id'], row['organization_id'], row['workspace_id']) if row else None

    async def workspace_available(self, organization_id: UUID, workspace_id: UUID) -> bool:
        return await self.connections.workspace_available(organization_id, workspace_id)

    async def confirm(self, binding: MCPTokenBinding, client_name: str, now: datetime) -> None:
        await self.session.execute(text("""UPDATE mcp_connections SET
            first_confirmed_at=COALESCE(first_confirmed_at,:now), last_seen_at=:now, client_name=:name
            WHERE id=:id AND user_id=:uid AND organization_id=:oid AND workspace_id=:wid"""),
            {"id": binding.id, "uid": binding.user_id, "oid": binding.organization_id,
             "wid": binding.workspace_id, "now": now, "name": client_name})

    async def commit(self) -> None:
        await self.session.commit()

    async def rollback(self) -> None:
        await self.session.rollback()
