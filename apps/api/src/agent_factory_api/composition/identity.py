"""Identity composition shared by transitional and target API delivery adapters."""

from dataclasses import dataclass

from agent_factory_adapters.identity import (
    PostgresAuthorizationRepository,
    PostgresIdentityRepository,
    SystemClock,
    SystemIdentityCrypto,
)
from agent_factory_core.identity import AuthorizationService, AuthService, IdentitySettings
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(frozen=True, slots=True)
class IdentityCompositionSettings:
    token_secret: str
    session_ttl_hours: int
    max_failed_attempts: int
    lock_minutes: int


def compose_authorization(session: AsyncSession) -> AuthorizationService:
    return AuthorizationService(PostgresAuthorizationRepository(session))


def compose_identity(session: AsyncSession, settings: IdentityCompositionSettings) -> AuthService:
    repository = PostgresIdentityRepository(session)
    return AuthService(
        repository,
        IdentitySettings(
            session_ttl_hours=settings.session_ttl_hours,
            max_failed_attempts=settings.max_failed_attempts,
            lock_minutes=settings.lock_minutes,
        ),
        SystemClock(),
        SystemIdentityCrypto(settings.token_secret),
        authorization_factory=lambda: compose_authorization(session),
    )
