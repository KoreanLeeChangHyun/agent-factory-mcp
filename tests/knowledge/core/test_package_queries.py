from dataclasses import replace
from datetime import UTC, datetime
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from agent_factory_core.knowledge.domain import DocumentRevision, KnowledgeActor
from agent_factory_core.knowledge.errors import (
    KnowledgeNotFoundError,
    KnowledgePermissionError,
    KnowledgeValidationError,
)
from agent_factory_core.knowledge.package_queries import DocumentPackageQueries
from agent_factory_core.knowledge.packages import PackageLimits, digest


def application(*permissions):
    actor = KnowledgeActor(uuid4(), uuid4(), uuid4(), frozenset(permissions))
    revision = DocumentRevision(
        uuid4(),
        actor.workspace_id,
        uuid4(),
        1,
        "tenant/key",
        "source.md",
        "text/markdown",
        5,
        digest(b"hello"),
        actor.user_id,
        {},
        datetime.now(UTC),
    )
    repository = AsyncMock()
    repository.get_document.return_value = object()
    repository.get_revision.return_value = revision
    storage = AsyncMock()
    storage.get.return_value = b"hello"
    service = DocumentPackageQueries(repository, storage, PackageLimits(1024, 1024, 1024, 10, 10))
    return actor, revision, repository, storage, service


@pytest.mark.asyncio
async def test_package_authorization_precedes_repository_and_storage_access():
    actor, revision, repository, storage, service = application()
    with pytest.raises(KnowledgePermissionError):
        await service.read(actor, revision.document_id, 1)
    repository.get_document.assert_not_awaited()
    storage.get.assert_not_awaited()


@pytest.mark.asyncio
async def test_missing_tenant_document_does_not_read_object_bytes():
    actor, revision, repository, storage, service = application("document.read")
    repository.get_document.return_value = None
    with pytest.raises(KnowledgeNotFoundError):
        await service.read(actor, revision.document_id, 1)
    repository.get_document.assert_awaited_once_with(actor, revision.document_id)
    repository.get_revision.assert_awaited_once_with(actor, revision.document_id, 1)
    storage.get.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize("content", [b"wrong", b"hello extra"])
async def test_corrupt_revision_bytes_are_rejected(content):
    actor, revision, _, storage, service = application("document.read")
    storage.get.return_value = content
    with pytest.raises(KnowledgeNotFoundError) as error:
        await service.read(actor, revision.document_id, 1)
    assert error.value.code == "source_hash_mismatch"


@pytest.mark.asyncio
async def test_member_export_requires_both_permissions_and_safe_existing_path():
    actor, revision, repository, storage, service = application("document.read")
    with pytest.raises(KnowledgePermissionError):
        await service.member(actor, revision.document_id, 1, "source.md")
    repository.get_document.assert_not_awaited()
    actor = replace(actor, permissions=frozenset({"document.read", "document.export"}))
    with pytest.raises(KnowledgeValidationError):
        await service.member(actor, revision.document_id, 1, "../source.md")
    storage.get.assert_not_awaited()
    assert await service.member(actor, revision.document_id, 1, "source.md") == b"hello"
    with pytest.raises(KnowledgeNotFoundError):
        await service.member(actor, revision.document_id, 1, "absent.md")
