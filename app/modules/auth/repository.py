"""Compatibility imports for the PostgreSQL identity adapter."""

from agent_factory_adapters.identity.postgres import PostgresIdentityRepository
from agent_factory_core.identity import PasswordLoginRecord, ResolvedApiToken

AuthRepository = PostgresIdentityRepository
ApiTokenRecord = ResolvedApiToken

__all__ = ["ApiTokenRecord", "AuthRepository", "PasswordLoginRecord"]
