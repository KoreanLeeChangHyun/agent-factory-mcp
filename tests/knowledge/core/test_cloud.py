from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID, uuid4

import pytest
from agent_factory_core.knowledge.cloud import (
    CloudImportCommand,
    CloudKnowledgeUseCases,
    CloudRevisionSource,
)
from agent_factory_core.knowledge.domain import DocumentType, KnowledgeActor
from agent_factory_core.knowledge.errors import KnowledgePermissionError, KnowledgeValidationError
from agent_factory_core.knowledge.packages import PackageLimits, digest


@dataclass
class MemoryStorage:
    values: dict[str, bytes]

    async def put(self, key: str, content: bytes, media_type: str) -> None:
        del media_type
        self.values[key] = content

    async def get(self, key: str) -> bytes:
        return self.values[key]

    async def delete(self, key: str) -> None:
        self.values.pop(key, None)


class IndexRepository:
    def __init__(self, source: CloudRevisionSource) -> None:
        self.source = source
        self.replacement: tuple[UUID, int, list[tuple[str, str]]] | None = None

    async def get_revision_source(self, actor, *, document_id, revision_number):
        del actor
        if (
            document_id == self.source.document_id
            and revision_number == self.source.revision_number
        ):
            return self.source
        return None

    async def replace_lexical_chunks(self, actor, *, document_id, revision_number, chunks):
        del actor
        self.replacement = (document_id, revision_number, list(chunks))
        return len(chunks)


def actor(*permissions: str) -> KnowledgeActor:
    return KnowledgeActor(uuid4(), uuid4(), uuid4(), frozenset(permissions))


@pytest.mark.asyncio
async def test_index_reads_authoritative_revision_and_replaces_projection() -> None:
    content = b"Korean identifier_1"
    document_id = uuid4()
    source = CloudRevisionSource(
        document_id,
        uuid4(),
        2,
        "revision-key",
        "source.md",
        "text/markdown",
        len(content),
        digest(content),
    )
    repository = IndexRepository(source)
    service = CloudKnowledgeUseCases(
        repository,  # type: ignore[arg-type]
        MemoryStorage({source.storage_key: content}),
        PackageLimits(1024, 1024, 1024, 10, 10),
    )

    count = await service.index(
        actor("document.update"), document_id=document_id, revision_number=2
    )

    assert count == 1
    assert repository.replacement == (document_id, 2, [("source.md", "Korean identifier_1")])


@pytest.mark.asyncio
async def test_index_enforces_permission_and_authoritative_digest() -> None:
    content = b"content"
    source = CloudRevisionSource(
        uuid4(), uuid4(), 1, "revision-key", "source.md", "text/markdown", len(content), "0" * 64
    )
    service = CloudKnowledgeUseCases(
        IndexRepository(source),  # type: ignore[arg-type]
        MemoryStorage({source.storage_key: content}),
        PackageLimits(1024, 1024, 1024, 10, 10),
    )

    with pytest.raises(KnowledgePermissionError):
        await service.index(actor(), document_id=source.document_id, revision_number=1)
    with pytest.raises(KnowledgeValidationError, match="integrity"):
        await service.index(
            actor("document.update"), document_id=source.document_id, revision_number=1
        )


@pytest.mark.asyncio
async def test_cloud_import_and_search_classify_missing_permissions_as_authorization() -> None:
    content = b"hello"
    source = CloudRevisionSource(
        uuid4(), uuid4(), 1, "unused", "source.md", "text/markdown", len(content), digest(content)
    )
    service = CloudKnowledgeUseCases(
        IndexRepository(source),  # type: ignore[arg-type]
        MemoryStorage({}),
        PackageLimits(1024, 1024, 1024, 10, 10),
    )
    command = CloudImportCommand(
        "permission-test",
        None,
        0,
        "Permission test",
        "permission-test",
        DocumentType.ORIGINAL,
        "source.md",
        "text/markdown",
        digest(content),
        "fixture:source.md",
        "controlled permission fixture",
    )

    with pytest.raises(KnowledgePermissionError):
        await service.import_bytes(actor(), command, content)
    with pytest.raises(KnowledgePermissionError):
        await service.search(actor(), "query")
