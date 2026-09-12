"""Compatibility session holder for target Workspace adapters."""

from sqlalchemy.ext.asyncio import AsyncSession


class WorkspaceRepositoryStore:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
