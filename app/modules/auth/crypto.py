"""Password and opaque-token cryptography."""

import hmac
import secrets
from hashlib import sha256

from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError

_password_hash = PasswordHash.recommended()
_dummy_password_hash = _password_hash.hash("agent-factory-constant-time-placeholder")


def hash_password(password: str) -> str:
    """Hash a password with the current recommended Argon2 parameters."""

    return _password_hash.hash(password)


def verify_password(password: str, encoded: str | None) -> tuple[bool, str | None]:
    """Verify and opportunistically upgrade a hash without leaking unknown users."""

    target = encoded or _dummy_password_hash
    try:
        valid, updated = _password_hash.verify_and_update(password, target)
    except UnknownHashError:
        return False, None
    return valid and encoded is not None, updated if encoded is not None else None


def new_opaque_token() -> str:
    """Create a URL-safe bearer credential with 256 bits of entropy."""

    return secrets.token_urlsafe(32)


def token_digest(token: str, secret: str) -> bytes:
    """Return a keyed, fixed-size digest suitable for database lookup."""

    return hmac.new(secret.encode(), token.encode(), sha256).digest()
