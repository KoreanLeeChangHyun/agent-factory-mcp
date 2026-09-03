"""Legacy project-local Document migration tests."""

from hashlib import sha256
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile

import pytest

from app.modules.document.legacy_import import build_manifest, prepare_import


def test_prepare_import_preserves_packages_as_deterministic_archives(tmp_path: Path) -> None:
    package = tmp_path / ".agent-factory" / "document" / "specification" / "workspace"
    package.mkdir(parents=True)
    (package / "index.html").write_text("<h1>Workspace</h1>", encoding="utf-8")
    (package / "styles.css").write_text("body{}", encoding="utf-8")

    first = prepare_import(tmp_path)
    second = prepare_import(tmp_path)

    assert len(first) == 1
    assert first[0].content == second[0].content
    assert first[0].manifest.document_type == "specification"
    assert first[0].manifest.filename == "workspace.zip"
    assert first[0].manifest.sha256 == sha256(first[0].content).hexdigest()
    with ZipFile(BytesIO(first[0].content)) as archive:
        assert archive.namelist() == ["index.html", "styles.css"]


def test_manifest_is_content_addressed_and_source_is_untouched(tmp_path: Path) -> None:
    document = tmp_path / "document" / "original" / "notes.md"
    document.parent.mkdir(parents=True)
    document.write_text("source evidence", encoding="utf-8")

    items = prepare_import(tmp_path)
    manifest = build_manifest(items, tmp_path)

    assert manifest["item_count"] == 1
    assert len(str(manifest["items_sha256"])) == 64
    assert document.read_text(encoding="utf-8") == "source evidence"


def test_import_rejects_symlinks(tmp_path: Path) -> None:
    original = tmp_path / "document" / "original"
    original.mkdir(parents=True)
    target = tmp_path / "outside.txt"
    target.write_text("secret", encoding="utf-8")
    (original / "linked.txt").symlink_to(target)

    with pytest.raises(ValueError, match="symlinks"):
        prepare_import(tmp_path)
