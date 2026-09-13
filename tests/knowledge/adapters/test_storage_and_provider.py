from __future__ import annotations

import pytest
from agent_factory_adapters.embeddings.knowledge.provider import ServerEmbeddingProvider
from agent_factory_adapters.object_storage.knowledge.storage import KnowledgeObjectStorage


class Client:
    dimensions = 3

    def __init__(self) -> None:
        self.values: dict[str, bytes] = {}

    async def put(self, key: str, content: bytes, media_type: str) -> None:
        assert media_type == "text/plain"
        self.values[key] = content

    async def get(self, key: str) -> bytes:
        return self.values[key]

    async def delete(self, key: str) -> None:
        self.values.pop(key, None)

    async def embed(self, texts: list[str]) -> list[list[float]]:
        return [[float(len(text)), 0.0, 1.0] for text in texts]


@pytest.mark.asyncio
async def test_adapters_preserve_narrow_port_contracts() -> None:
    client = Client()
    storage = KnowledgeObjectStorage(client)
    await storage.put("tenant/key", b"hello", "text/plain")
    assert await storage.get("tenant/key") == b"hello"
    await storage.delete("tenant/key")
    assert client.values == {}

    embeddings = ServerEmbeddingProvider(client)
    assert embeddings.dimensions == 3
    assert await embeddings.embed(("한글",)) == [[2.0, 0.0, 1.0]]
