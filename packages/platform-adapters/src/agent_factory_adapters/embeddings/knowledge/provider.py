from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol


class EmbeddingClient(Protocol):
    dimensions: int

    async def embed(self, texts: list[str]) -> list[list[float]]: ...


class ServerEmbeddingProvider:
    """Keeps credentials and provider selection behind the server-owned client."""

    def __init__(self, client: EmbeddingClient) -> None:
        self.client = client

    @property
    def dimensions(self) -> int:
        return self.client.dimensions

    async def embed(self, texts: Sequence[str]) -> Sequence[Sequence[float]]:
        return await self.client.embed(list(texts))
