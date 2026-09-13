"""Bounded package and cloud service contracts; no live infrastructure."""

import base64
import io
import stat
import zipfile
from dataclasses import replace
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy.dialects import postgresql

from app.common.errors import ApplicationError, ConflictError
from app.modules.auth.authorization import AuthorizationScope, AuthorizedContext
from app.modules.auth.service import Principal
from app.modules.document.cloud_models import DocumentImport, DocumentText
from app.modules.document.cloud_schemas import ImportRequest, Pair
from app.modules.document.cloud_service import CloudDocumentService, require
from app.modules.document.models import Document, DocumentType
from app.modules.document.package import (
    MAX_BYTES,
    decode_content,
    digest,
    extract,
    safe_path,
    unpack,
)
from app.modules.document.pair import tree_hash, validate_pair


def context():
    return AuthorizedContext(
        Principal(uuid4(), "test@example.com", "Test", False),
        AuthorizationScope(uuid4(), uuid4()),
        frozenset({"document.read", "document.import", "document.update", "document.export"}),
    )


def request(raw=b"hello", **changes):
    payload = {
        "schema_version": "1",
        "idempotency_key": "import-1",
        "expected_revision": 0,
        "title": "Source",
        "slug": "source",
        "document_type": "original",
        "filename": "notes.txt",
        "media_type": "text/plain",
        "content_base64": base64.b64encode(raw).decode(),
        "source_sha256": digest(raw),
        "source_identity": "git:repo/notes.txt",
        "collection_context": "Human upload",
    }
    payload.update(changes)
    return ImportRequest(**payload)


def archive(files, compression=zipfile.ZIP_STORED):
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w", compression=compression) as target:
        for name, content in files.items():
            target.writestr(name, content)
    return stream.getvalue()


def pair_fixture():
    ai, human = "skills/source", "human/source"
    skill = f"---\nname: source\nmetadata:\n  specification-id: source\n  ai-root: {ai}/\n  human-entry: {human}/index.html\n---\nRead this.\n".encode()
    html = f'''<!doctype html><html lang="ko"><head>
<meta name="agent-factory:specification-id" content="source">
<meta name="agent-factory:ai-root" content="{ai}/">
<meta name="agent-factory:ai-binding-entry" content="{ai}/SKILL.md">
</head><body><section data-ai-source="{ai}/SKILL.md" data-ai-sha256="{digest(skill)}">
<p data-source-lines="1-{len(skill.splitlines())}" data-source-sha256="{digest(skill)}">이 문서는 명세를 설명합니다.</p></section></body></html>'''.encode()
    files = {
        f"{ai}/SKILL.md": skill,
        f"{human}/index.html": html,
        f"{human}/styles.css": b"body {}",
        f"{human}/app.js": b"// progressive",
    }
    pair = Pair(
        specification_id="source",
        ai_root=ai,
        human_root=human,
        git_repository="https://example.com/repo",
        git_commit="a" * 40,
        review={
            "reviewer": "review-run-2",
            "evidence": "Reviewed decisions, scope, Korean prose and unresolved claims.",
            "authority_reference": "human-decision-1",
            "ai_sha256": tree_hash(files, ai),
            "human_sha256": tree_hash(files, human),
            "verdict": "aligned",
        },
    )
    return files, pair


@pytest.mark.parametrize(
    "path", ["../escape", "/abs", "a/../b", "a\\b", "C:evil", "a//b", "./a", "a\x00b"]
)
def test_path_escape(path):
    with pytest.raises(ApplicationError):
        safe_path(path)


def test_source_hash_bounds_unknown_fields():
    with pytest.raises(ApplicationError):
        decode_content(request(source_sha256="0" * 64))
    with pytest.raises(ValidationError):
        request(extra="untrusted")
    with pytest.raises(ValidationError):
        request(schema_version="2")
    with pytest.raises(ApplicationError):
        unpack(b"x" * (MAX_BYTES + 1), "text/plain", "a.txt")


def test_zip_symlink_and_bomb():
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w") as target:
        link = zipfile.ZipInfo("link")
        link.create_system = 3
        link.external_attr = (stat.S_IFLNK | 0o777) << 16
        target.writestr(link, "../../secret")
    with pytest.raises(ApplicationError):
        unpack(stream.getvalue(), "application/zip", "a.zip")
    raw = archive({"large.txt": b"x" * 100000}, zipfile.ZIP_DEFLATED)
    with pytest.raises(ApplicationError):
        unpack(raw, "application/zip", "a.zip")
    with pytest.raises(ApplicationError):
        unpack(archive({"../outside": b"x"}), "application/zip", "a.zip")
    with pytest.raises(ApplicationError):
        unpack(archive({"A.txt": b"a", "a.txt": b"b"}), "application/zip", "a.zip")


def test_json_text_and_package_extraction():
    files = {
        "a.json": '{"name":"명세 문서","id":"cloud_doc_1"}'.encode(),
        "notes.md": "검색 원본".encode(),
        "index.html": "<p>가공 문서</p><script>secret_script</script>".encode(),
    }
    chunks = extract(unpack(archive(files), "application/zip", "package.zip"))
    combined = " ".join(text for _, text in chunks)
    assert "명세 문서" in combined and "cloud_doc_1" in combined and "가공 문서" in combined
    assert "secret_script" not in combined
    assert "명세" in extract(unpack(files["a.json"], "application/json", "a.json"))[0][1]


def test_pair_coverage_and_review_are_separate():
    files, pair = pair_fixture()
    assert validate_pair(files, pair, "source")["semantic_alignment"] == "review_attested"
    with pytest.raises(ApplicationError):
        validate_pair({k: v for k, v in files.items() if not k.endswith("app.js")}, pair, "source")
    stale = pair.model_copy(
        update={"review": pair.review.model_copy(update={"human_sha256": "0" * 64})}
    )
    with pytest.raises(ApplicationError):
        validate_pair(files, stale, "source")
    files["skills/source/references/extra.md"] = b"Uncovered instruction"
    with pytest.raises(ApplicationError):
        validate_pair(files, pair, "source")


def test_workspace_and_write_guards():
    ctx = context()
    assert require(ctx, True) == ctx.scope.workspace_id
    with pytest.raises(ApplicationError):
        require(replace(ctx, permissions=frozenset({"workspace.read"})), True)
    with pytest.raises(ApplicationError):
        require(replace(ctx, scope=AuthorizationScope(ctx.scope.organization_id)))


class Session:
    def __init__(self):
        self.receipt = None
        self.document = None
        self.added = []
        self.statements = []
        self.commits = 0
        self.rollbacks = 0

    async def execute(self, statement, *args):
        self.statements.append(statement)

    async def scalar(self, statement):
        self.statements.append(statement)
        entity = statement.column_descriptions[0]["entity"]
        if entity is DocumentImport:
            return self.receipt
        return self.document

    async def scalars(self, statement):
        self.statements.append(statement)
        return []

    def add(self, record):
        self.added.append(record)
        if isinstance(record, DocumentImport):
            self.receipt = record

    async def commit(self):
        self.commits += 1

    async def rollback(self):
        self.rollbacks += 1


class Storage:
    def __init__(self):
        self.objects = {}

    async def put(self, key, data, media):
        self.objects[key] = data

    async def get(self, key):
        return self.objects[key]


def service_fixture():
    ctx = context()
    session, storage = Session(), Storage()
    service = CloudDocumentService(
        session,
        storage,
        SimpleNamespace(document_max_upload_bytes=MAX_BYTES, embedding_provider="disabled"),
    )
    doc = Document(
        id=uuid4(),
        workspace_id=ctx.scope.workspace_id,
        slug="source",
        title="Source",
        document_type=DocumentType.ORIGINAL,
        document_metadata={},
        current_revision_number=0,
        revision=1,
    )
    session.document = doc
    service.repository = SimpleNamespace(
        create=AsyncMock(return_value=doc),
        get=AsyncMock(return_value=doc),
        add_revision=AsyncMock(),
    )
    return ctx, session, storage, service, doc


@pytest.mark.asyncio
async def test_import_retry_no_duplicates_and_changed_payload_conflict():
    ctx, session, storage, service, _doc = service_fixture()
    first = await service.import_document(ctx, request())
    second = await service.import_document(ctx, request())
    assert first == second and session.commits == 1 and len(storage.objects) == 1
    assert sum(isinstance(row, DocumentText) for row in session.added) == 1
    with pytest.raises(ConflictError):
        await service.import_document(ctx, request(b"changed"))
    assert session.commits == 1 and len(storage.objects) == 1


@pytest.mark.asyncio
async def test_conflict_and_cross_workspace_have_no_object_writes():
    ctx, session, storage, service, doc = service_fixture()
    with pytest.raises(ConflictError):
        await service.import_document(ctx, request(document_id=doc.id, expected_revision=4))
    session.document = None
    with pytest.raises(ApplicationError):
        await service.import_document(ctx, request(document_id=doc.id))
    query = session.statements[-1].compile(dialect=postgresql.dialect())
    assert ctx.scope.workspace_id in query.params.values()
    assert not storage.objects


@pytest.mark.asyncio
async def test_incomplete_pair_preserves_prior_publication():
    ctx, session, storage, service, doc = service_fixture()
    files, pair = pair_fixture()
    good = request(
        archive(files),
        document_type="specification",
        filename="pair.zip",
        media_type="application/zip",
        pair=pair,
    )
    doc.document_type = DocumentType.SPECIFICATION
    first = await service.import_document(ctx, good)
    files.pop("human/source/app.js")
    bad = request(
        archive(files),
        document_type="specification",
        filename="pair.zip",
        media_type="application/zip",
        pair=pair,
        idempotency_key="second",
        document_id=doc.id,
        expected_revision=1,
    )
    with pytest.raises(ApplicationError):
        await service.import_document(ctx, bad)
    assert session.commits == 1 and len(storage.objects) == 1
    assert doc.document_metadata["cloud_pair_revision"] == first["revision_number"]


@pytest.mark.asyncio
@pytest.mark.parametrize("query", ["명세", "cloud_doc_1", "100%_literal"])
async def test_lexical_query_without_embedding_is_scoped_and_escaped(query):
    ctx, session, _storage, service, _doc = service_fixture()
    assert await service.search(ctx, query) == []
    sql = session.statements[-1].compile(dialect=postgresql.dialect())
    assert "ILIKE" in str(sql) and "ESCAPE" in str(sql)
    assert ctx.scope.workspace_id in sql.params.values()
    assert "current_revision_number" in str(sql) and "deleted_at IS NULL" in str(sql)


@pytest.mark.asyncio
async def test_failed_staging_readback_does_not_publish():
    ctx, session, storage, service, _doc = service_fixture()
    storage.get = AsyncMock(return_value=b"corrupt")
    with pytest.raises(ApplicationError):
        await service.import_document(ctx, request())
    assert session.commits == 0 and session.rollbacks == 1
    assert session.receipt is None
    service.repository.add_revision.assert_not_called()


@pytest.mark.asyncio
async def test_import_write_denial_precedes_storage_and_database():
    ctx, session, storage, service, _doc = service_fixture()
    with pytest.raises(ApplicationError):
        await service.import_document(
            replace(ctx, permissions=frozenset({"workspace.read"})), request()
        )
    assert not session.statements and not storage.objects


def test_no_extension_text_is_indexable():
    assert extract({"notes": "명세 검색".encode()}, "text/plain") == [("notes", "명세 검색")]
