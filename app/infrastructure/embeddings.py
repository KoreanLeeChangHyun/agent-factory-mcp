"""Replaceable embedding provider clients."""

from __future__ import annotations

from hashlib import sha256
from math import sqrt
from typing import Protocol

import httpx

from app.common.errors import ApplicationError
from app.core.config import Settings


class EmbeddingProvider(Protocol):
    dimensions: int

    async def embed(self, texts: list[str]) -> list[list[float]]: ...


class OpenAICompatibleEmbeddingProvider:
    def __init__(self, settings: Settings) -> None:
        if settings.embedding_api_key is None:
            raise ApplicationError(
                "embedding_provider_unconfigured", "Embedding provider is not configured", 503
            )
        self.base_url = settings.embedding_base_url.rstrip("/")
        self.api_key = settings.embedding_api_key.get_secret_value()
        self.model = settings.embedding_model
        self.dimensions = settings.embedding_dimensions

    async def embed(self, texts: list[str]) -> list[list[float]]:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{self.base_url}/embeddings",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={"model": self.model, "input": texts, "dimensions": self.dimensions},
            )
            response.raise_for_status()
        rows = sorted(response.json()["data"], key=lambda row: row["index"])
        vectors = [row["embedding"] for row in rows]
        if len(vectors) != len(texts) or any(len(vector) != self.dimensions for vector in vectors):
            raise ApplicationError(
                "invalid_embedding_response", "Embedding provider returned invalid dimensions", 502
            )
        return vectors


class DeterministicEmbeddingProvider:
    """Offline provider used only by tests and local evaluation."""

    def __init__(self, dimensions: int = 1536) -> None:
        self.dimensions = dimensions

    async def embed(self, texts: list[str]) -> list[list[float]]:
        return [self._vector(text) for text in texts]

    def _vector(self, text: str) -> list[float]:
        digest = sha256(text.encode()).digest()
        values = [((digest[index % len(digest)] / 255) * 2) - 1 for index in range(self.dimensions)]
        magnitude = sqrt(sum(value * value for value in values)) or 1
        return [value / magnitude for value in values]


class DisabledEmbeddingProvider:
    def __init__(self, dimensions: int) -> None:
        self.dimensions = dimensions

    async def embed(self, texts: list[str]) -> list[list[float]]:
        del texts
        raise ApplicationError(
            "embedding_provider_unconfigured", "Embedding provider is not configured", 503
        )


def build_embedding_provider(settings: Settings) -> EmbeddingProvider:
    if settings.embedding_provider == "openai-compatible":
        return OpenAICompatibleEmbeddingProvider(settings)
    if settings.embedding_provider == "deterministic" and settings.environment in {"local", "test"}:
        return DeterministicEmbeddingProvider(settings.embedding_dimensions)
    return DisabledEmbeddingProvider(settings.embedding_dimensions)
