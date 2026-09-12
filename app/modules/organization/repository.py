"""Compatibility session holder for target organization/account adapters."""

from sqlalchemy.ext.asyncio import AsyncSession


class OrganizationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
