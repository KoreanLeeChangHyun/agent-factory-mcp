from __future__ import annotations

from typing import Protocol


class ObjectClient(Protocol):
    async def put(self, key: str, content: bytes, media_type: str) -> None: ...
    async def get(self, key: str) -> bytes: ...
    async def delete(self, key: str) -> None: ...


class KnowledgeObjectStorage:
    """Narrow production adapter that keeps provider concerns outside platform-core."""

    def __init__(self, client: ObjectClient) -> None:
        self.client = client

    async def put(self, key: str, content: bytes, media_type: str) -> None:
        await self.client.put(key, content, media_type)

    async def get(self, key: str) -> bytes:
        return await self.client.get(key)

    async def delete(self, key: str) -> None:
        await self.client.delete(key)
