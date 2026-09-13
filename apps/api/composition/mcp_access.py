"""Session-scoped construction of MCP authentication and access use cases."""

from contextlib import asynccontextmanager

from agent_factory_adapters.clock import SystemClock
from agent_factory_adapters.identity import PostgresIdentityRepository
from agent_factory_adapters.identity.crypto import SystemTokenDigest
from agent_factory_adapters.postgres.connections.access import PostgresMCPAccessRepository
from agent_factory_adapters.postgres.database.session import get_session_factory
from agent_factory_core.connections.mcp.access import MCPAccessUseCases, MCPTokenUseCases

from .identity import compose_authorization


@asynccontextmanager
async def mcp_access():
    async with get_session_factory()() as session:
        yield MCPAccessUseCases(PostgresMCPAccessRepository(session), compose_authorization(session), SystemClock())


@asynccontextmanager
async def mcp_tokens(secret: str):
    async with get_session_factory()() as session:
        clock = SystemClock()
        access = MCPAccessUseCases(PostgresMCPAccessRepository(session), compose_authorization(session), clock)
        yield MCPTokenUseCases(PostgresIdentityRepository(session), access, SystemTokenDigest(secret), clock)
