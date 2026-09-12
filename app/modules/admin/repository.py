"""Legacy construction identity for the target administration adapter."""

from sqlalchemy.ext.asyncio import AsyncSession


class AdminRepository:
    """Retain dependency-override identity while SQL lives in platform-adapters."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
