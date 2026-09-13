from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from api.http.routes.knowledge.documents import (
    _document,
    _hit,
    _profile,
    _provenance,
    _revision,
)
from agent_factory_core.knowledge.domain import (
    Document,
    DocumentRevision,
    DocumentStatus,
    DocumentType,
    EmbeddingProfile,
    Provenance,
    ProvenanceRelation,
    SearchHit,
)


def test_document_presenter_retains_legacy_http_shape() -> None:
    now = datetime.now(UTC)
    item = Document(
        id=uuid4(),
        workspace_id=uuid4(),
        document_type=DocumentType.PROCESSED,
        title="가공 문서",
        slug="processed-document",
        status=DocumentStatus.ACTIVE,
        metadata={"path": "가공/문서.md"},
        current_revision_number=2,
        revision=4,
        created_at=now,
        updated_at=now,
    )
    result = _document(item)
    assert result["document_metadata"] == {"path": "가공/문서.md"}
    assert result["current_revision_number"] == 2
    assert result["document_type"] == "processed"
    assert result["id"] == str(item.id)
    assert result["workspace_id"] == str(item.workspace_id)


def test_all_presenters_use_canonical_hyphenated_uuids() -> None:
    now = datetime.now(UTC)
    workspace_id, document_id, revision_id, user_id = (uuid4() for _ in range(4))
    revision = DocumentRevision(
        revision_id,
        workspace_id,
        document_id,
        1,
        "tenant/key",
        "file.md",
        "text/markdown",
        4,
        "0" * 64,
        user_id,
        {},
        now,
    )
    edge = Provenance(
        uuid4(),
        workspace_id,
        document_id,
        uuid4(),
        ProvenanceRelation.DERIVED_FROM,
        {},
        now,
    )
    profile = EmbeddingProfile(uuid4(), workspace_id, "default", "provider", "model", 1536, True)
    hit = SearchHit(uuid4(), document_id, revision_id, "content", 0.8, 0.9, 0.5)

    assert _revision(revision)["created_by_user_id"] == str(user_id)
    assert _revision(revision)["document_id"] == str(document_id)
    assert _provenance(edge)["source_document_id"] == str(document_id)
    assert _provenance(edge)["target_document_id"] == str(edge.target_document_id)
    assert _profile(profile)["workspace_id"] == str(workspace_id)
    assert _hit(hit)["chunk_id"] == str(hit.chunk_id)
    assert _hit(hit)["document_revision_id"] == str(revision_id)
