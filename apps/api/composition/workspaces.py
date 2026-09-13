"""Workspace/account discovery composition root."""

from agent_factory_adapters.workspaces import (
    PostgresWorkspaceRepository,
    RemoteRepositoryLocationResolver,
)
from agent_factory_core.workspaces import WorkspaceUseCases
from agent_factory_core.workspaces.ports import RepositoryLocationResolver
from sqlalchemy.ext.asyncio import AsyncSession


def workspace_use_cases(
    session: AsyncSession,
    locations: RepositoryLocationResolver | None = None,
) -> WorkspaceUseCases:
    return WorkspaceUseCases(
        PostgresWorkspaceRepository(session), locations or RemoteRepositoryLocationResolver()
    )
