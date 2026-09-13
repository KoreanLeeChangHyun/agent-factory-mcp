from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from agent_factory_core.knowledge.domain import (
    Document,
    DocumentRevision,
    DocumentStatus,
    DocumentType,
    KnowledgeActor,
    ProvenanceRelation,
)
from agent_factory_core.knowledge.errors import (
    KnowledgeCommitUnknownError,
    KnowledgePermissionError,
    KnowledgeValidationError,
    KnowledgeWriteRolledBackError,
)
from agent_factory_core.knowledge.use_cases import DocumentUseCases, split_text, validate_path


class MemoryStorage:
    def __init__(self) -> None:
        self.values: dict[str, bytes] = {}

    async def put(self, key: str, content: bytes, media_type: str) -> None:
        del media_type
        self.values[key] = content

    async def get(self, key: str) -> bytes:
        return self.values[key]

    async def delete(self, key: str) -> None:
        self.values.pop(key, None)


class MemoryRepository:
    def __init__(self, *documents: Document) -> None:
        self.documents = {item.id: item for item in documents}
        self.provenance_call: tuple[DocumentType, DocumentType, ProvenanceRelation] | None = None

    async def get_document(self, actor: KnowledgeActor, document_id):
        item = self.documents.get(document_id)
        return item if item and item.workspace_id == actor.workspace_id else None

    async def list_documents(self, actor: KnowledgeActor, document_type):
        return [
            item
            for item in self.documents.values()
            if item.workspace_id == actor.workspace_id
            and (document_type is None or item.document_type is document_type)
        ]

    async def add_provenance(
        self, actor, *, source_document_id, target_document_id, relation, metadata
    ):
        del actor, source_document_id, target_document_id, relation, metadata
        raise AssertionError("invalid relation must fail before persistence")


class FailingRevisionRepository(MemoryRepository):
    def __init__(
        self, item: Document, error: Exception, reconciled: DocumentRevision | None = None
    ) -> None:
        super().__init__(item)
        self.error = error
        self.reconciled = reconciled

    async def reserve_revision(self, *args, **kwargs):
        del args, kwargs
        raise self.error

    async def reconcile_revision(self, actor, document_id, storage_key):
        del actor, document_id, storage_key
        return self.reconciled


def actor(*permissions: str) -> KnowledgeActor:
    return KnowledgeActor(uuid4(), uuid4(), uuid4(), frozenset(permissions))


def document(workspace_id, document_type: DocumentType) -> Document:
    now = datetime.now(UTC)
    return Document(
        uuid4(),
        workspace_id,
        document_type,
        "문서",
        "document",
        DocumentStatus.ACTIVE,
        {},
        0,
        1,
        now,
        now,
    )


def test_document_paths_reject_escape_and_control_components() -> None:
    validate_path({"path": "설계/API/인증.md"})
    for path in ("/root.md", "../root.md", "folder//file.md", "folder\\file.md", "bad\x00.md"):
        with pytest.raises(KnowledgeValidationError, match="safe relative path"):
            validate_path({"path": path})


def test_split_text_is_deterministic_and_overlaps() -> None:
    assert split_text("alpha\nbeta\ngamma", 10, 2) == ["alpha", "ha\nbeta", "ta\ngamma"]
    with pytest.raises(KnowledgeValidationError, match="empty"):
        split_text("   ", 10, 2)


@pytest.mark.asyncio
async def test_list_requires_document_read() -> None:
    current = actor()
    service = DocumentUseCases(MemoryRepository(), MemoryStorage(), max_upload_bytes=1024)  # type: ignore[arg-type]
    with pytest.raises(KnowledgePermissionError):
        await service.list(current)


@pytest.mark.asyncio
async def test_provenance_enforces_pipeline_types_before_write() -> None:
    current = actor("document.read", "document.update")
    source = document(current.workspace_id, DocumentType.ORIGINAL)
    target = document(current.workspace_id, DocumentType.SPECIFICATION)
    service = DocumentUseCases(
        MemoryRepository(source, target), MemoryStorage(), max_upload_bytes=1024
    )  # type: ignore[arg-type]
    with pytest.raises(KnowledgeValidationError, match="types"):
        await service.add_provenance(
            current,
            source_document_id=source.id,
            target_document_id=target.id,
            relation=ProvenanceRelation.SPECIFIES,
            metadata={},
        )


@pytest.mark.asyncio
async def test_revision_retains_bytes_when_commit_acknowledgement_is_unknown() -> None:
    current = actor("document.update")
    item = document(current.workspace_id, DocumentType.ORIGINAL)
    storage = MemoryStorage()
    service = DocumentUseCases(
        FailingRevisionRepository(
            item,
            KnowledgeCommitUnknownError("revision_commit_unknown", "acknowledgement lost"),
        ),
        storage,
        max_upload_bytes=1024,
    )  # type: ignore[arg-type]

    with pytest.raises(KnowledgeCommitUnknownError):
        await service.add_revision(
            current,
            item.id,
            filename="evidence.md",
            media_type="text/markdown",
            content=b"retained",
        )

    assert list(storage.values.values()) == [b"retained"]


@pytest.mark.asyncio
async def test_revision_returns_authoritative_row_after_lost_commit_acknowledgement() -> None:
    current = actor("document.update")
    item = document(current.workspace_id, DocumentType.ORIGINAL)
    committed = DocumentRevision(
        uuid4(),
        current.workspace_id,
        item.id,
        1,
        "authoritative-key",
        "evidence.md",
        "text/markdown",
        9,
        "f" * 64,
        current.user_id,
        {},
        datetime.now(UTC),
    )
    storage = MemoryStorage()
    service = DocumentUseCases(
        FailingRevisionRepository(
            item,
            KnowledgeCommitUnknownError("revision_commit_unknown", "acknowledgement lost"),
            committed,
        ),
        storage,
        max_upload_bytes=1024,
    )  # type: ignore[arg-type]

    result = await service.add_revision(
        current,
        item.id,
        filename="evidence.md",
        media_type="text/markdown",
        content=b"committed",
    )

    assert result is committed
    assert list(storage.values.values()) == [b"committed"]


@pytest.mark.asyncio
async def test_revision_removes_bytes_after_confirmed_rollback() -> None:
    current = actor("document.update")
    item = document(current.workspace_id, DocumentType.ORIGINAL)
    storage = MemoryStorage()
    service = DocumentUseCases(
        FailingRevisionRepository(
            item,
            KnowledgeWriteRolledBackError("revision_write_rolled_back", "rolled back"),
        ),
        storage,
        max_upload_bytes=1024,
    )  # type: ignore[arg-type]

    with pytest.raises(KnowledgeWriteRolledBackError):
        await service.add_revision(
            current,
            item.id,
            filename="evidence.md",
            media_type="text/markdown",
            content=b"discarded",
        )

    assert storage.values == {}
