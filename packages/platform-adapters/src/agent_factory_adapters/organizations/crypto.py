"""Secure invitation token implementation for the organization core port."""

import hashlib
import hmac
import secrets


class SystemInvitationTokens:
    def __init__(self, secret: str) -> None:
        self._secret = secret.encode()

    def new_token(self) -> str:
        return secrets.token_urlsafe(32)

    def digest(self, token: str) -> bytes:
        return hmac.new(self._secret, token.encode(), hashlib.sha256).digest()
