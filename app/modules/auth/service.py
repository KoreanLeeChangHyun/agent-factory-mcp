"""Legacy constructor bridge to framework-independent identity use cases."""

from typing import Any

from agent_factory_adapters.identity import (
    PostgresAuthorizationRepository,
    SystemClock,
    SystemIdentityCrypto,
)
from agent_factory_core.identity import LoginResult, Principal
from agent_factory_core.identity.authorization import AuthorizationService
from agent_factory_core.identity.settings import IdentitySettings
from agent_factory_core.identity.use_cases import AuthService as CoreAuthService


class AuthService(CoreAuthService):
    def __init__(self, repository: Any, settings: Any) -> None:
        super().__init__(
            repository=repository,  # type: ignore[arg-type]
            settings=IdentitySettings(
                session_ttl_hours=settings.auth_session_ttl_hours,
                max_failed_attempts=settings.auth_max_failed_attempts,
                lock_minutes=settings.auth_lock_minutes,
            ),
            clock=SystemClock(),
            crypto=SystemIdentityCrypto(settings.auth_token_secret.get_secret_value()),
            authorization_factory=lambda: AuthorizationService(
                PostgresAuthorizationRepository(repository.session)
            ),
        )


__all__ = ["AuthService", "LoginResult", "Principal"]
