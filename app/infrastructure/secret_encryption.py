"""Versioned authenticated encryption for integration secrets."""

import json
import os
from hashlib import sha256

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


class SecretCipher:
    def __init__(self, secret: str, key_version: int) -> None:
        self._cipher = AESGCM(sha256(secret.encode()).digest())
        self.key_version = key_version

    def encrypt(self, value: dict[str, object] | str) -> bytes:
        plaintext = (
            value
            if isinstance(value, str)
            else json.dumps(value, separators=(",", ":"), sort_keys=True)
        ).encode()
        nonce = os.urandom(12)
        aad = f"agent-factory:integration:v{self.key_version}".encode()
        return nonce + self._cipher.encrypt(nonce, plaintext, aad)

    def decrypt_json(self, value: bytes) -> dict[str, object]:
        decoded = self.decrypt_text(value)
        result = json.loads(decoded)
        if not isinstance(result, dict):
            raise TypeError("encrypted integration credential is not an object")
        return result

    def decrypt_text(self, value: bytes) -> str:
        nonce, ciphertext = value[:12], value[12:]
        aad = f"agent-factory:integration:v{self.key_version}".encode()
        return self._cipher.decrypt(nonce, ciphertext, aad).decode()
