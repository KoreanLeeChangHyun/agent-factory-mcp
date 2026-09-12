"""Production identity composition owns the core/adapter wiring."""

from agent_factory_adapters.identity import (
    PostgresAuthorizationRepository,
    PostgresIdentityRepository,
)
from agent_factory_api.composition.identity import (
    IdentityCompositionSettings,
    compose_authorization,
    compose_identity,
)
from agent_factory_core.identity import AuthorizationService, AuthService


class Session:
    pass


def test_identity_composition_uses_core_services_and_postgres_ports() -> None:
    session = Session()
    authentication = compose_identity(
        session,  # type: ignore[arg-type]
        IdentityCompositionSettings("secret", 24, 5, 15),
    )
    authorization = compose_authorization(session)  # type: ignore[arg-type]

    assert type(authentication) is AuthService
    assert isinstance(authentication.repository, PostgresIdentityRepository)
    assert type(authorization) is AuthorizationService
    assert isinstance(authorization.repository, PostgresAuthorizationRepository)
