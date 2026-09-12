"""Compatibility functions backed by the system identity crypto adapter."""

from agent_factory_adapters.identity.crypto import SystemIdentityCrypto


def hash_password(password: str) -> str:
    return SystemIdentityCrypto("").hash_password(password)


def verify_password(password: str, encoded: str | None) -> tuple[bool, str | None]:
    return SystemIdentityCrypto("").verify_password(password, encoded)


def new_opaque_token() -> str:
    return SystemIdentityCrypto("").new_opaque_token()


def token_digest(token: str, secret: str) -> bytes:
    return SystemIdentityCrypto(secret).token_digest(token)
