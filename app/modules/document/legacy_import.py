"""One-way importer for legacy project-local Agent Factory Documents.

The source tree is never modified. A dry run emits a content-addressed manifest;
``--apply`` uploads the same packages into the configured PostgreSQL/S3 service.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import mimetypes
import re
from dataclasses import asdict, dataclass
from hashlib import sha256
from io import BytesIO
from pathlib import Path
from uuid import UUID
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

from app.core.config import settings
from app.db.session import dispose_engine, get_session_factory
from app.db.tenant import TenantContext, apply_tenant_context
from app.infrastructure.object_storage import S3ObjectStorage
from app.modules.auth.authorization import AuthorizationScope, AuthorizedContext
from app.modules.auth.service import Principal
from app.modules.document.models import DocumentType
from app.modules.document.repository import DocumentRepository
from app.modules.document.service import DocumentService

TYPE_DIRECTORIES = {
    "original": DocumentType.ORIGINAL,
    "processed": DocumentType.PROCESSED,
    "specification": DocumentType.SPECIFICATION,
    "specifications": DocumentType.SPECIFICATION,
}
IMPORTABLE_MEDIA_TYPES = {
    "application/json",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip",
    "text/csv",
    "text/markdown",
    "text/plain",
}
_SLUG_PARTS = re.compile(r"[^a-z0-9]+")


@dataclass(frozen=True, slots=True)
class ImportItem:
    document_type: str
    title: str
    slug: str
    source_path: str
    filename: str
    media_type: str
    size_bytes: int
    sha256: str


@dataclass(frozen=True, slots=True)
class PreparedItem:
    manifest: ImportItem
    content: bytes


def _legacy_document_root(source: Path) -> Path:
    source = source.expanduser().resolve()
    candidates = (source / ".agent-factory" / "document", source / "document", source)
    for candidate in candidates:
        if any((candidate / name).is_dir() for name in TYPE_DIRECTORIES):
            return candidate
    raise ValueError(f"legacy document root not found below {source}")


def _slug(value: str) -> str:
    slug = _SLUG_PARTS.sub("-", value.casefold()).strip("-")
    if not slug:
        slug = f"legacy-{sha256(value.encode()).hexdigest()[:12]}"
    return slug[:140].rstrip("-")


def _regular_files(package: Path) -> list[Path]:
    files: list[Path] = []
    for path in sorted(package.rglob("*")):
        if path.is_symlink():
            raise ValueError(f"symlinks are not importable: {path}")
        if path.is_file():
            files.append(path)
        elif not path.is_dir():
            raise ValueError(f"special files are not importable: {path}")
    if not files:
        raise ValueError(f"empty document package: {package}")
    return files


def _bundle_directory(package: Path) -> bytes:
    output = BytesIO()
    with ZipFile(output, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for path in _regular_files(package):
            _write_archive_entry(archive, path.relative_to(package).as_posix(), path.read_bytes())
    return output.getvalue()


def _bundle_file(path: Path) -> bytes:
    output = BytesIO()
    with ZipFile(output, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
        _write_archive_entry(archive, path.name, path.read_bytes())
    return output.getvalue()


def _write_archive_entry(archive: ZipFile, name: str, content: bytes) -> None:
    info = ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
    info.compress_type = ZIP_DEFLATED
    info.external_attr = 0o100644 << 16
    archive.writestr(info, content)


def prepare_import(source: Path) -> list[PreparedItem]:
    root = _legacy_document_root(source)
    prepared: list[PreparedItem] = []
    seen: set[tuple[str, str]] = set()
    for directory_name, document_type in TYPE_DIRECTORIES.items():
        type_root = root / directory_name
        if not type_root.is_dir():
            continue
        for package in sorted(type_root.iterdir()):
            if package.is_symlink():
                raise ValueError(f"symlinks are not importable: {package}")
            if package.is_dir():
                content = _bundle_directory(package)
                filename = f"{package.name}.zip"
                media_type = "application/zip"
            elif package.is_file():
                content = package.read_bytes()
                filename = package.name
                guessed_type = mimetypes.guess_type(filename)[0]
                if guessed_type in IMPORTABLE_MEDIA_TYPES:
                    media_type = guessed_type
                else:
                    content = _bundle_file(package)
                    filename = f"{package.name}.zip"
                    media_type = "application/zip"
            else:
                raise ValueError(f"special files are not importable: {package}")
            digest = sha256(content).hexdigest()
            slug = _slug(package.stem if package.is_file() else package.name)
            identity = (document_type.value, slug)
            if identity in seen:
                slug = f"{slug}-{digest[:10]}"
                identity = (document_type.value, slug)
            if identity in seen:
                raise ValueError(f"duplicate import identity: {document_type.value}/{slug}")
            seen.add(identity)
            manifest = ImportItem(
                document_type=document_type.value,
                title=package.stem if package.is_file() else package.name,
                slug=slug,
                source_path=package.relative_to(root).as_posix(),
                filename=filename,
                media_type=media_type,
                size_bytes=len(content),
                sha256=digest,
            )
            prepared.append(PreparedItem(manifest, content))
    return prepared


def build_manifest(items: list[PreparedItem], source: Path) -> dict[str, object]:
    records = [asdict(item.manifest) for item in items]
    payload = json.dumps(records, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return {
        "version": 1,
        "source": str(source.expanduser().resolve()),
        "item_count": len(records),
        "items_sha256": sha256(payload.encode()).hexdigest(),
        "items": records,
    }


async def apply_import(
    items: list[PreparedItem], organization_id: UUID, workspace_id: UUID, user_id: UUID
) -> tuple[int, int]:
    context = AuthorizedContext(
        Principal(user_id, "legacy-import@agent-factory.local", "Legacy import", True),
        AuthorizationScope(organization_id, workspace_id),
        frozenset({"workspace.read", "document.read", "document.create", "document.update"}),
    )
    async with get_session_factory()() as session:
        await apply_tenant_context(
            session,
            TenantContext(user_id, organization_id, workspace_id, is_platform_admin=True),
        )
        service = DocumentService(DocumentRepository(session), S3ObjectStorage(settings), settings)
        oversized = [
            item.manifest.source_path
            for item in items
            if item.manifest.size_bytes > settings.document_max_upload_bytes
        ]
        if oversized:
            raise ValueError(f"document packages exceed upload limit: {', '.join(oversized)}")
        existing = {
            (item.document_type.value, item.slug): item for item in await service.list(context)
        }
        for item in items:
            prior = existing.get((item.manifest.document_type, item.manifest.slug))
            if (
                prior
                and prior.document_metadata.get("legacy_content_sha256") != item.manifest.sha256
            ):
                raise ValueError(
                    f"conflicting destination document: {item.manifest.document_type}/"
                    f"{item.manifest.slug}"
                )

        imported = skipped = 0
        for item in items:
            prior = existing.get((item.manifest.document_type, item.manifest.slug))
            if prior and prior.current_revision_number > 0:
                skipped += 1
                continue
            record = prior
            if record is None:
                record = await service.create(
                    context,
                    item.manifest.title,
                    item.manifest.slug,
                    DocumentType(item.manifest.document_type),
                    {
                        "legacy_source_path": item.manifest.source_path,
                        "legacy_content_sha256": item.manifest.sha256,
                        "migration": "project-local-v1",
                    },
                )
            revision = await service.add_revision(
                context,
                record.id,
                item.manifest.filename,
                item.manifest.media_type,
                item.content,
                {"legacy_content_sha256": item.manifest.sha256},
            )
            if revision.sha256 != item.manifest.sha256:
                raise RuntimeError(f"content verification failed for {item.manifest.source_path}")
            imported += 1
        return imported, skipped


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source", type=Path, required=True, help="project or legacy document root"
    )
    parser.add_argument("--manifest", type=Path, help="write the dry-run manifest to this file")
    parser.add_argument(
        "--apply", action="store_true", help="write to PostgreSQL and object storage"
    )
    parser.add_argument("--organization-id", type=UUID)
    parser.add_argument("--workspace-id", type=UUID)
    parser.add_argument("--user-id", type=UUID, help="existing user recorded as revision author")
    return parser


async def _main() -> int:
    args = _parser().parse_args()
    items = prepare_import(args.source)
    manifest = build_manifest(items, args.source)
    rendered = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    if args.manifest:
        args.manifest.write_text(rendered, encoding="utf-8")
    else:
        print(rendered, end="")
    if not args.apply:
        return 0
    if not all((args.organization_id, args.workspace_id, args.user_id)):
        raise SystemExit("--apply requires --organization-id, --workspace-id, and --user-id")
    try:
        imported, skipped = await apply_import(
            items, args.organization_id, args.workspace_id, args.user_id
        )
        print(json.dumps({"imported": imported, "skipped": skipped}))
    finally:
        await dispose_engine()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(_main()))
