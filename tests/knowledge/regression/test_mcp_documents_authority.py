"""Focused MCP transport checks for the target Knowledge authority."""

import json
from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import uuid4

import pytest
from agent_factory_core.identity.authorization import AuthorizationScope, AuthorizedContext
from agent_factory_core.identity.domain import Principal
from agent_factory_core.knowledge.domain import (
    Document,
    DocumentRevision,
    DocumentStatus,
    DocumentType,
)
from agent_factory_core.knowledge.errors import (
    KnowledgeValidationError,
    KnowledgeWriteRolledBackError,
)
from pydantic import TypeAdapter

import app.mcp.documents as adapter
from app.modules.document.cloud_schemas import ReadRequest, WriteRequest
from tests.support.mcp import McpServerStub


@pytest.fixture(autouse=True)
def no_real_object_client(monkeypatch):
    monkeypatch.setattr(adapter, "S3ObjectStorage", lambda _settings: object())


class Session:
    def __init__(self) -> None:
        self.exit_error = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, error_type, _error, _traceback):
        self.exit_error = error_type


def payload(result):
    return json.loads(result.content[0].text)


def context(*permissions: str) -> AuthorizedContext:
    return AuthorizedContext(
        Principal(uuid4(), "owner@example.test", "Owner", False),
        AuthorizationScope(uuid4(), uuid4()),
        frozenset(permissions),
    )


def document(actor: AuthorizedContext) -> Document:
    now = datetime.now(UTC)
    return Document(
        uuid4(),
        actor.scope.workspace_id,
        DocumentType.ORIGINAL,
        "Document",
        "document",
        DocumentStatus.ACTIVE,
        {},
        1,
        1,
        now,
        now,
    )


@pytest.mark.asyncio
async def test_download_bound_rejects_before_target_storage_read(monkeypatch) -> None:
    current, session = context("document.read", "document.export"), Session()
    item = document(current)
    revision = DocumentRevision(
        uuid4(),
        current.scope.workspace_id,
        item.id,
        1,
        "must-not-read",
        "large.bin",
        "application/zip",
        256 * 1024 + 1,
        "0" * 64,
        current.principal.user_id,
        {},
        datetime.now(UTC),
    )

    class Documents:
        repository = SimpleNamespace(get_revision=lambda *_args: None)

        async def get(self, *_args):
            return item

        async def download(self, *_args):
            raise AssertionError("storage must not be read above the MCP bound")

    async def get_revision(*_args):
        return revision

    Documents.repository.get_revision = get_revision
    authorizations = []

    async def authorize(*args):
        authorizations.append(args)
        return session, current

    monkeypatch.setattr(
        adapter, "build_document_knowledge_service", lambda *_args, **_kwargs: Documents()
    )
    monkeypatch.setattr(
        adapter,
        "build_cloud_knowledge_service",
        lambda *_args, **_kwargs: SimpleNamespace(),
    )
    server = McpServerStub()
    adapter.install_documents(server, authorize)

    result = await server.tools["document_read"](
        ReadRequest(
            schema_version="1", operation="download", document_id=item.id, revision_number=1
        ),
        "organization",
        "workspace",
    )

    assert result.is_error
    assert payload(result)["code"] == "document_too_large"
    assert authorizations == [("organization", "workspace", "document:read", "document.export")]


@pytest.mark.asyncio
async def test_target_digest_and_transaction_failures_remain_bounded(monkeypatch) -> None:
    current, session = context("document.read", "document.export"), Session()
    item = document(current)
    revision = DocumentRevision(
        uuid4(),
        current.scope.workspace_id,
        item.id,
        1,
        "corrupt",
        "source.md",
        "text/markdown",
        7,
        "0" * 64,
        current.principal.user_id,
        {},
        datetime.now(UTC),
    )

    class Documents:
        async def get(self, *_args):
            return item

        async def download(self, *_args):
            raise KnowledgeValidationError(
                "document_digest_mismatch", "Stored revision no longer matches its immutable digest"
            )

    async def get_revision(*_args):
        return revision

    Documents.repository = SimpleNamespace(get_revision=get_revision)

    async def authorize(*_args):
        return session, current

    monkeypatch.setattr(
        adapter, "build_document_knowledge_service", lambda *_args, **_kwargs: Documents()
    )
    monkeypatch.setattr(
        adapter,
        "build_cloud_knowledge_service",
        lambda *_args, **_kwargs: SimpleNamespace(),
    )
    server = McpServerStub()
    adapter.install_documents(server, authorize)

    result = await server.tools["document_read"](
        ReadRequest(
            schema_version="1", operation="download", document_id=item.id, revision_number=1
        )
    )

    assert result.is_error
    assert payload(result) == {
        "code": "document_digest_mismatch",
        "message": "Stored revision no longer matches its immutable digest",
    }
    assert session.exit_error is KnowledgeValidationError

    class UnknownFailure:
        async def get(self, *_args):
            raise RuntimeError("provider returned secret-value")

    monkeypatch.setattr(
        adapter,
        "build_document_knowledge_service",
        lambda *_args, **_kwargs: UnknownFailure(),
    )
    redacted = await server.tools["document_read"](
        ReadRequest(schema_version="1", operation="get", document_id=item.id)
    )

    assert redacted.is_error
    assert payload(redacted) == {
        "code": "document_operation_failed",
        "message": "Document operation failed",
    }
    assert "secret-value" not in redacted.content[0].text


@pytest.mark.asyncio
async def test_metadata_bound_and_rollback_error_prevent_target_write(monkeypatch) -> None:
    current, session = context("document.create"), Session()
    calls = []

    class Documents:
        async def create(self, *_args, **_kwargs):
            calls.append("create")
            raise KnowledgeWriteRolledBackError(
                "document_write_rolled_back", "Document write was rolled back"
            )

    async def authorize(*_args):
        return session, current

    monkeypatch.setattr(
        adapter, "build_document_knowledge_service", lambda *_args, **_kwargs: Documents()
    )
    monkeypatch.setattr(
        adapter,
        "build_cloud_knowledge_service",
        lambda *_args, **_kwargs: SimpleNamespace(),
    )
    server = McpServerStub()
    adapter.install_documents(server, authorize)
    requests = TypeAdapter(WriteRequest)
    oversized = requests.validate_python(
        {
            "schema_version": "1",
            "operation": "create",
            "title": "Oversized",
            "slug": "oversized",
            "document_type": "original",
            "metadata": {"evidence": "x" * 32_000},
        }
    )

    bounded = await server.tools["document_write"](oversized)

    assert bounded.is_error and payload(bounded)["code"] == "document_bounds"
    assert calls == []
    valid = requests.validate_python(
        {
            "schema_version": "1",
            "operation": "create",
            "title": "Rollback",
            "slug": "rollback",
            "document_type": "original",
            "metadata": {},
        }
    )

    rolled_back = await server.tools["document_write"](valid)

    assert rolled_back.is_error
    assert payload(rolled_back)["code"] == "document_write_rolled_back"
    assert calls == ["create"]
    assert session.exit_error is KnowledgeWriteRolledBackError
