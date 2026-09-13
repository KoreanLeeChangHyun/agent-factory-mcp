"""System cryptography implementation for identity ports."""

import hmac
import secrets
from hashlib import sha256

from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError


class SystemIdentityCrypto:
    def __init__(self, token_secret: str) -> None:
        self._secret = token_secret
        self._password_hash = PasswordHash.recommended()
        self._dummy_hash = self._password_hash.hash("agent-factory-constant-time-placeholder")

    def hash_password(self, password: str) -> str:
        return self._password_hash.hash(password)

    def verify_password(self, password: str, encoded: str | None) -> tuple[bool, str | None]:
        try:
            valid, updated = self._password_hash.verify_and_update(
                password, encoded or self._dummy_hash
            )
        except UnknownHashError:
            return False, None
        return valid and encoded is not None, updated if encoded is not None else None

    def new_opaque_token(self) -> str:
        return secrets.token_urlsafe(32)

    def token_digest(self, token: str) -> bytes:
        return hmac.new(self._secret.encode(), token.encode(), sha256).digest()


class SystemTokenDigest:
    def __init__(self, secret: str):
        self._secret = secret

    def token_digest(self, token: str) -> bytes:
        return hmac.new(self._secret.encode(), token.encode(), sha256).digest()
