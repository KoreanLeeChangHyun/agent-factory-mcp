"""External provider driver contract owned by infrastructure adapters."""

from typing import Protocol


class IntegrationDriver(Protocol):
    key: str

    async def authorization_url(self, state: str, code_challenge: str) -> str: ...

    async def exchange_code(self, code: str, verifier: str) -> dict[str, object]: ...

    async def validate_credentials(self, credentials: dict[str, object]) -> str: ...

    async def synchronize(
        self, credentials: dict[str, object], cursor: dict[str, object]
    ) -> tuple[list[dict[str, object]], dict[str, object]]: ...

    def verify_webhook(self, payload: bytes, signature: str, secret: str) -> bool: ...
