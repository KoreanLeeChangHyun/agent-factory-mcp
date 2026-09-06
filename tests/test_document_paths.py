"""Explorer paths are logical metadata, never server filesystem paths."""

import pytest
from pydantic import ValidationError

from app.modules.document.schemas import DocumentCreate, DocumentUpdate


@pytest.mark.parametrize("schema", [DocumentCreate, DocumentUpdate])
@pytest.mark.parametrize(
    "path",
    ["/etc/passwd", "../secret", "a/../b", "a//b", "a\\b", "a\x00b", "", 42, "/".join(["a"] * 33)],
)
def test_invalid_document_paths_are_rejected(schema: type, path: object) -> None:
    with pytest.raises(ValidationError, match="metadata.path"):
        schema(
            title="문서",
            slug="document",
            document_type="processed",
            status="active",
            revision=1,
            metadata={"path": path},
        )


def test_optional_path_and_existing_metadata_are_preserved() -> None:
    base = {"title": "설계", "slug": "design", "document_type": "specification"}
    assert DocumentCreate(**base).metadata == {}
    metadata = {"path": "설계/API/인증.md", "tags": ["인증"]}
    assert DocumentCreate(**base, metadata=metadata).metadata == metadata
