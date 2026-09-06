"""Document lifecycle, object storage, and provenance tests."""

from uuid import UUID

import pytest
from pydantic import SecretStr

from app.common.errors import ApplicationError
from app.core.config import Settings
from app.modules.auth.authorization import AuthorizationScope, AuthorizedContext
from app.modules.auth.service import Principal
from app.modules.document.models import Document, DocumentType, ProvenanceRelation
from app.modules.document.service import DocumentService, _validate_relation

USER_ID = UUID("11111111-1111-4111-8111-111111111111")
ORGANIZATION_ID = UUID("22222222-2222-4222-8222-222222222222")
WORKSPACE_ID = UUID("33333333-3333-4333-8333-333333333333")
DOCUMENT_ID = UUID("44444444-4444-4444-8444-444444444444")


def context() -> AuthorizedContext:
    return AuthorizedContext(
        Principal(USER_ID, "member@example.com", "Member", False),
        AuthorizationScope(ORGANIZATION_ID, WORKSPACE_ID),
        frozenset({"document.read", "document.update"}),
    )


def build_settings() -> Settings:
    return Settings(
        environment="test",
        auth_token_secret=SecretStr("test-secret"),
        document_max_upload_bytes=32,
    )


class MemoryStorage:
    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}
        self.deleted: list[str] = []

    async def put(self, key: str, content: bytes, media_type: str) -> None:
        del media_type
        self.objects[key] = content

    async def get(self, key: str) -> bytes:
        return self.objects[key]

    async def delete(self, key: str) -> None:
        self.deleted.append(key)
        self.objects.pop(key, None)


class FakeDocumentRepository:
    def __init__(self, *, fail_revision: bool = False) -> None:
        self.fail_revision = fail_revision
        self.document = Document(
            id=DOCUMENT_ID,
            workspace_id=WORKSPACE_ID,
            title="Source",
            slug="source",
            document_type=DocumentType.ORIGINAL,
            document_metadata={},
            current_revision_number=0,
            revision=1,
        )
        self.revision_record: object | None = None
        self.commits = 0
        self.rollbacks = 0

    async def get(self, workspace_id: UUID, document_id: UUID) -> Document | None:
        if (workspace_id, document_id) == (WORKSPACE_ID, DOCUMENT_ID):
            return self.document
        return None

    async def next_revision_number(self, document_id: UUID) -> int:
        del document_id
        return 1

    async def add_revision(self, record: object) -> None:
        if self.fail_revision:
            raise RuntimeError("database unavailable")
        self.revision_record = record

    async def commit(self) -> None:
        self.commits += 1

    async def rollback(self) -> None:
        self.rollbacks += 1


@pytest.mark.asyncio
async def test_revision_upload_is_content_addressed_and_persisted() -> None:
    repository = FakeDocumentRepository()
    storage = MemoryStorage()
    service = DocumentService(repository, storage, build_settings())  # type: ignore[arg-type]

    record = await service.add_revision(
        context(), DOCUMENT_ID, "../notes.md", "text/markdown", b"hello"
    )

    assert record.filename == "notes.md"
    assert record.sha256 == "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    assert storage.objects[record.storage_key] == b"hello"
    assert repository.commits == 1


@pytest.mark.asyncio
async def test_failed_database_write_removes_uploaded_object() -> None:
    repository = FakeDocumentRepository(fail_revision=True)
    storage = MemoryStorage()
    service = DocumentService(repository, storage, build_settings())  # type: ignore[arg-type]

    with pytest.raises(RuntimeError, match="database unavailable"):
        await service.add_revision(context(), DOCUMENT_ID, "notes.md", "text/markdown", b"hello")

    assert storage.objects == {}
    assert len(storage.deleted) == 1
    assert repository.rollbacks == 1


@pytest.mark.asyncio
async def test_upload_size_and_media_type_are_validated_before_storage() -> None:
    repository = FakeDocumentRepository()
    storage = MemoryStorage()
    service = DocumentService(repository, storage, build_settings())  # type: ignore[arg-type]

    with pytest.raises(ApplicationError, match="Unsupported"):
        await service.add_revision(
            context(), DOCUMENT_ID, "payload.exe", "application/octet-stream", b"payload"
        )
    with pytest.raises(ApplicationError, match="upload limit"):
        await service.add_revision(context(), DOCUMENT_ID, "large.txt", "text/plain", b"x" * 33)

    assert storage.objects == {}


def test_typed_provenance_enforces_document_pipeline() -> None:
    _validate_relation(
        DocumentType.ORIGINAL,
        DocumentType.PROCESSED,
        ProvenanceRelation.PROCESSED_FROM,
    )
    _validate_relation(
        DocumentType.PROCESSED,
        DocumentType.SPECIFICATION,
        ProvenanceRelation.SPECIFIES,
    )
    with pytest.raises(ApplicationError, match="types"):
        _validate_relation(
            DocumentType.ORIGINAL,
            DocumentType.SPECIFICATION,
            ProvenanceRelation.SPECIFIES,
        )
