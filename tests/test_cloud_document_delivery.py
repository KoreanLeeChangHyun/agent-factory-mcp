"""Delivery contracts; run only by independent Verification. No live providers."""

from dataclasses import replace
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy.dialects import postgresql
from test_cloud_documents import archive, request, service_fixture

from app.common.errors import ApplicationError
from app.modules.document.cloud_schemas import PrepareUpload
from app.modules.document.delivery_limits import MiB, PackageLimits
from app.modules.document.delivery_models import DocumentUpload
from app.modules.document.delivery_service import DocumentDelivery
from app.modules.document.package import digest, unpack


def delivery_fixture(raw=b"hello", **changes):
    ctx, session, storage, cloud, doc = service_fixture()
    cloud.settings.document_max_upload_bytes = 25 * MiB
    payload = request().model_dump(exclude={"content_base64"})
    payload.update(size_bytes=len(raw), source_sha256=digest(raw), **changes)
    metadata = PrepareUpload(**payload)
    delivery = DocumentDelivery(cloud)
    record = DocumentUpload(
        id=uuid4(),
        workspace_id=ctx.scope.workspace_id,
        user_id=ctx.principal.user_id,
        idempotency_key=metadata.idempotency_key,
        metadata_payload=metadata.model_dump(mode="json"),
        request_sha256="0" * 64,
        capability_sha256=digest(b"capability"),
        uploaded=False,
        finalized=False,
        expires_at=datetime.now(UTC) + timedelta(minutes=15),
    )
    original_scalar = session.scalar

    async def scalar(statement):
        if statement.column_descriptions[0]["entity"] is DocumentUpload:
            session.statements.append(statement)
            return record
        return await original_scalar(statement)

    session.scalar = scalar
    return ctx, session, storage, cloud, doc, delivery, record, metadata


async def chunks(*values):
    for value in values:
        yield value


def test_large_complete_package_and_all_bounds():
    files = {"ai/vendor.js": b"a" * (5 * MiB), "human/vendor.js": b"b" * (5 * MiB)}
    raw = archive(files)
    assert unpack(raw, "application/zip", "pair.zip", PackageLimits()) == files
    for limits in (
        PackageLimits(upload_bytes=MiB),
        PackageLimits(expanded_bytes=MiB),
        PackageLimits(member_bytes=MiB),
        PackageLimits(entries=1),
    ):
        with pytest.raises(ApplicationError):
            unpack(raw, "application/zip", "pair.zip", limits)
    import zipfile

    bomb = archive({"bomb.txt": b"0" * MiB}, zipfile.ZIP_DEFLATED)
    with pytest.raises(ApplicationError):
        unpack(bomb, "application/zip", "pair.zip", PackageLimits(ratio=2))
    limits = PackageLimits(
        upload_bytes=10**12, expanded_bytes=10**12, member_bytes=10**12, entries=10**9, ratio=10**9
    )
    assert (
        limits.upload_bytes,
        limits.expanded_bytes,
        limits.member_bytes,
        limits.entries,
        limits.ratio,
    ) == (128 * MiB, 256 * MiB, 64 * MiB, 8192, 1000)


@pytest.mark.asyncio
async def test_binary_delivery_and_idempotent_finalize_preserve_native_format():
    raw = b"%PDF-1.7\n" + b"\xff\x00" * (3 * MiB)
    ctx, _session, storage, cloud, _doc, delivery, record, metadata = delivery_fixture(
        raw, media_type="application/pdf", filename="original.pdf"
    )
    await delivery.upload(ctx, record.id, "capability", chunks(raw[:1000], raw[1000:]))
    first = await delivery.finalize(ctx, record.id)
    second = await delivery.finalize(ctx, record.id)
    assert first == second and record.finalized
    assert len(storage.objects) == 2 and all(value == raw for value in storage.objects.values())
    revision = cloud.repository.add_revision.call_args.args[0]
    assert revision.media_type == "application/pdf" and revision.size_bytes == len(raw)
    assert revision.revision_metadata["source_identity"] == metadata.source_identity


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "fault", ["wrong-capability", "expired", "too-long", "too-short", "digest"]
)
async def test_upload_rejections_never_stage(fault):
    ctx, _session, storage, _cloud, _doc, delivery, record, _metadata = delivery_fixture()
    capability, raw = "capability", b"hello"
    if fault == "wrong-capability":
        capability = "wrong"
    if fault == "expired":
        record.expires_at -= timedelta(hours=1)
    if fault == "too-long":
        raw += b"!"
    if fault == "too-short":
        raw = raw[:-1]
    if fault == "digest":
        raw = b"xxxxx"
    with pytest.raises(ApplicationError):
        await delivery.upload(ctx, record.id, capability, chunks(raw))
    assert not storage.objects and not record.uploaded


@pytest.mark.asyncio
async def test_finalize_stale_revision_and_corruption_preserve_staging():
    ctx, _session, storage, cloud, doc, delivery, record, _metadata = delivery_fixture()
    record.metadata_payload.update(document_id=str(doc.id), expected_revision=99)
    await delivery.upload(ctx, record.id, "capability", chunks(b"hello"))
    with pytest.raises(ApplicationError):
        await delivery.finalize(ctx, record.id)
    assert len(storage.objects) == 1
    cloud.repository.add_revision.assert_not_called()
    storage.objects[delivery.key(record)] = b"xxxxx"
    with pytest.raises(ApplicationError):
        await delivery.finalize(ctx, record.id)
    cloud.repository.add_revision.assert_not_called()


@pytest.mark.asyncio
async def test_intent_read_is_workspace_and_owner_scoped_and_permission_gated():
    ctx, session, _storage, _cloud, _doc, delivery, record, _metadata = delivery_fixture()
    await delivery.intent(ctx, record.id)
    sql = session.statements[-1].compile(dialect=postgresql.dialect())
    assert (
        ctx.scope.workspace_id in sql.params.values()
        and ctx.principal.user_id in sql.params.values()
    )
    assert "FOR UPDATE" in str(sql)
    with pytest.raises(ApplicationError):
        await delivery.intent(replace(ctx, permissions=frozenset()), record.id)


@pytest.mark.asyncio
async def test_package_member_validates_whole_archive_and_authorizes_revision():
    ctx, _session, storage, cloud, doc, delivery, _record, _metadata = delivery_fixture()
    raw = archive({"index.html": b"<p>readable</p>", "assets/a.js": b"// local"})
    revision = SimpleNamespace(
        id=uuid4(),
        revision_number=2,
        revision_metadata={},
        storage_key="revision",
        sha256=digest(raw),
        media_type="application/zip",
        size_bytes=len(raw),
        filename="source.zip",
    )
    cloud.repository.get_revision = AsyncMock(return_value=revision)
    storage.objects["revision"] = raw
    manifest = await delivery.manifest(ctx, doc.id, 2)
    assert manifest["human_entry"] == "index.html"
    assert await delivery.member(ctx, doc.id, 2, "assets/a.js") == b"// local"
    cloud.repository.get_revision.assert_awaited_with(ctx.scope.workspace_id, doc.id, 2)
    for path in ("../secret", "/secret", "missing"):
        with pytest.raises(ApplicationError):
            await delivery.member(ctx, doc.id, 2, path)
    malicious = archive({"index.html": b"good", "../escape": b"bad"})
    revision.sha256, revision.size_bytes = digest(malicious), len(malicious)
    storage.objects["revision"] = malicious
    with pytest.raises(ApplicationError):
        await delivery.member(ctx, doc.id, 2, "index.html")
    cloud.repository.get.return_value = None
    with pytest.raises(ApplicationError):
        await delivery.member(ctx, doc.id, 2, "index.html")


def test_prepare_closed_metadata():
    _, _, _, _, _, _, _, metadata = delivery_fixture()
    with pytest.raises(ValidationError):
        PrepareUpload(**metadata.model_dump(), local_path="/etc/passwd")
    with pytest.raises(ValidationError):
        PrepareUpload(**metadata.model_dump(), source_url="https://example.com")


@pytest.mark.asyncio
async def test_prepare_retry_rotates_capability_without_changing_intent_or_bytes():
    from app.modules.document.delivery_service import fingerprint

    ctx, _session, storage, _cloud, _doc, delivery, record, metadata = delivery_fixture()
    record.request_sha256 = fingerprint(metadata)
    record.uploaded = True
    record.expires_at -= timedelta(hours=1)
    first = await delivery.prepare(ctx, metadata)
    second = await delivery.prepare(ctx, metadata)
    assert first["upload_id"] == second["upload_id"] == str(record.id)
    assert first["capability"] != second["capability"]
    assert record.capability_sha256 == digest(second["capability"].encode())
    assert record.uploaded and not storage.objects
    assert record.expires_at > datetime.now(UTC)
    with pytest.raises(ApplicationError):
        await delivery.prepare(
            ctx, metadata.model_copy(update={"source_identity": "different-source"})
        )
    other = replace(ctx, principal=replace(ctx.principal, user_id=uuid4()))
    with pytest.raises(ApplicationError):
        await delivery.prepare(other, metadata)


@pytest.mark.asyncio
async def test_failed_storage_readback_leaves_intent_unpublished_and_resumable():
    ctx, session, storage, _cloud, _doc, delivery, record, _metadata = delivery_fixture()
    original_get = storage.get
    storage.get = AsyncMock(return_value=b"corrupt")
    with pytest.raises(ApplicationError):
        await delivery.upload(ctx, record.id, "capability", chunks(b"hello"))
    assert not record.uploaded and not record.finalized and session.commits == 0
    assert storage.objects[delivery.key(record)] == b"hello"
    storage.get = original_get
    await delivery.upload(ctx, record.id, "capability", chunks(b"hello"))
    assert record.uploaded
    await delivery.finalize(ctx, record.id)
    assert record.finalized


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "media,filename,raw",
    [
        (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "source.docx",
            b"PK\x00native-docx",
        ),
        ("image/png", "source.png", b"\x89PNG\r\n\x1a\n\xff"),
        ("image/jpeg", "source.jpg", b"\xff\xd8\xff"),
    ],
)
async def test_native_binary_not_forced_to_zip_or_utf8(media, filename, raw):
    ctx, _session, storage, cloud, _doc, delivery, record, _metadata = delivery_fixture(
        raw, media_type=media, filename=filename
    )
    await delivery.upload(ctx, record.id, "capability", chunks(raw))
    await delivery.finalize(ctx, record.id)
    revision = cloud.repository.add_revision.call_args.args[0]
    assert revision.media_type == media and revision.sha256 == digest(raw)
    assert storage.objects[revision.storage_key] == raw


def test_actual_distributable_source_inventories_fit_without_omissions():
    from pathlib import Path

    from tests.support.inventory import assert_same_bytes, git_source_files, template_source_files

    plugin = Path(__file__).resolve().parents[2] / "plugin"
    assert (plugin / "skills/document").is_dir(), "Final gate requires the plugin source checkout"
    for identity in ("document", "agent", "template"):
        files = (
            template_source_files()
            if identity == "template"
            else git_source_files(plugin, f"skills/{identity}", f"docs/specifications/{identity}")
        )
        # Real packages exercise binary delivery above the inline limit without padding.
        # The separate synthetic 10 MiB test above protects large-capacity bounds.
        assert sum(map(len, files.values())) > 256 * 1024
        assert any(path.endswith("mermaid.min.js") for path in files)
        raw = archive(files)
        unpacked = unpack(raw, "application/zip", identity + ".zip", PackageLimits())
        assert set(unpacked) == set(files)
        for name, content in files.items():
            assert_same_bytes(unpacked[name], content, name)
