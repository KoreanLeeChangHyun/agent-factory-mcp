"""Compatibility imports for core authorization and its PostgreSQL port."""

from agent_factory_adapters.identity.postgres import PostgresAuthorizationRepository
from agent_factory_core.identity.authorization import (
    AuthorizationScope,
    AuthorizationState,
    AuthorizationService,
    AuthorizedContext,
    PermissionSource,
    require_context,
    require_workspace_id,
)

AuthorizationRepository = PostgresAuthorizationRepository

__all__ = [
    "AuthorizationRepository",
    "AuthorizationScope",
    "AuthorizationState",
    "AuthorizationService",
    "AuthorizedContext",
    "PermissionSource",
    "require_context",
    "require_workspace_id",
]
