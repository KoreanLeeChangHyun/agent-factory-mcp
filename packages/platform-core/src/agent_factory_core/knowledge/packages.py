from __future__ import annotations

import io
import json
import re
import stat
import unicodedata
import zipfile
import zlib
from collections.abc import Mapping
from dataclasses import dataclass
from hashlib import sha256
from html.parser import HTMLParser
from pathlib import PurePosixPath

from .errors import KnowledgeValidationError

TEXT_SUFFIXES = frozenset({".md", ".txt", ".json", ".csv", ".html", ".yaml", ".yml"})


@dataclass(frozen=True, slots=True)
class PackageLimits:
    upload_bytes: int
    expanded_bytes: int
    member_bytes: int
    entries: int
    ratio: int


STANDALONE_PACKAGE_LIMITS = PackageLimits(
    4 * 1024 * 1024, 4 * 1024 * 1024, 4 * 1024 * 1024, 256, 100
)
_CLOUD_DEFAULTS = (64 * 1024 * 1024, 16 * 1024 * 1024, 2_048, 200)
_CLOUD_CAPS = (256 * 1024 * 1024, 64 * 1024 * 1024, 8_192, 1_000)


def _bounded_positive_integer(value: object, name: str, cap: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise TypeError(f"{name} must be an integer")
    if value <= 0:
        raise ValueError(f"{name} must be positive")
    return min(value, cap)


def cloud_package_limits(
    *,
    upload_bytes: object,
    expanded_bytes: object = _CLOUD_DEFAULTS[0],
    member_bytes: object = _CLOUD_DEFAULTS[1],
    entries: object = _CLOUD_DEFAULTS[2],
    ratio: object = _CLOUD_DEFAULTS[3],
) -> PackageLimits:
    return PackageLimits(
        _bounded_positive_integer(upload_bytes, "upload_bytes", 128 * 1024 * 1024),
        _bounded_positive_integer(expanded_bytes, "expanded_bytes", _CLOUD_CAPS[0]),
        _bounded_positive_integer(member_bytes, "member_bytes", _CLOUD_CAPS[1]),
        _bounded_positive_integer(entries, "entries", _CLOUD_CAPS[2]),
        _bounded_positive_integer(ratio, "ratio", _CLOUD_CAPS[3]),
    )


@dataclass(frozen=True, slots=True)
class PackageMember:
    path: str
    size_bytes: int
    sha256: str


def digest(content: bytes) -> str:
    return sha256(content).hexdigest()


def safe_package_path(path: str) -> str:
    parts = path.split("/")
    if (
        not path
        or len(path) > 1024
        or path.startswith("/")
        or re.search(r"[\\:\x00-\x1f]", path)
        or len(parts) > 32
        or any(part in {"", ".", ".."} for part in parts)
        or unicodedata.normalize("NFC", path) != path
    ):
        raise KnowledgeValidationError("invalid_package_path", "Package path is unsafe")
    return path


def unpack_package(
    content: bytes,
    media_type: str,
    filename: str,
    limits: PackageLimits | None = None,
) -> dict[str, bytes]:
    limits = limits or STANDALONE_PACKAGE_LIMITS
    if not content or len(content) > limits.upload_bytes:
        raise KnowledgeValidationError("document_bounds", "Document exceeds package bounds")
    if media_type != "application/zip":
        return {safe_package_path(filename): content}
    files: dict[str, bytes] = {}
    seen: set[str] = set()
    expanded = 0
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            if len(archive.infolist()) > limits.entries:
                raise KnowledgeValidationError("package_bounds", "Package has too many entries")
            for item in archive.infolist():
                path = safe_package_path(
                    item.filename.rstrip("/") if item.is_dir() else item.filename
                )
                mode = stat.S_IFMT(item.external_attr >> 16)
                if mode not in {0, stat.S_IFREG, stat.S_IFDIR} or item.flag_bits & 1:
                    raise KnowledgeValidationError(
                        "package_special_file", "Package contains a special or encrypted entry"
                    )
                if item.compress_type not in {zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED}:
                    raise KnowledgeValidationError(
                        "unsupported_archive", "Package compression is unsupported"
                    )
                folded = path.casefold()
                if folded in seen:
                    raise KnowledgeValidationError(
                        "package_path_collision", "Package paths collide"
                    )
                seen.add(folded)
                if item.is_dir():
                    continue
                expanded += item.file_size
                if (
                    item.file_size > limits.member_bytes
                    or expanded > limits.expanded_bytes
                    or item.file_size > max(1, item.compress_size) * limits.ratio
                ):
                    raise KnowledgeValidationError(
                        "package_bounds", "Package expansion exceeds bounds"
                    )
                with archive.open(item) as stream:
                    data = stream.read(limits.member_bytes + 1)
                if len(data) != item.file_size:
                    raise KnowledgeValidationError(
                        "package_bounds", "Package member size is inconsistent"
                    )
                files[path] = data
    except KnowledgeValidationError:
        raise
    except (zipfile.BadZipFile, zlib.error, RuntimeError, OSError, EOFError, ValueError) as error:
        raise KnowledgeValidationError("invalid_package", "Package is invalid") from error
    if not files:
        raise KnowledgeValidationError("invalid_package", "Package contains no files")
    folded_files = {path.casefold() for path in files}
    for path in files:
        if any(
            parent.as_posix().casefold() in folded_files
            for parent in PurePosixPath(path).parents
            if str(parent) != "."
        ):
            raise KnowledgeValidationError("package_path_collision", "A file shadows a directory")
    return files


class _VisibleText(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.hidden = 0
        self.values: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        del attrs
        if tag in {"script", "style"}:
            self.hidden += 1

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style"}:
            self.hidden = max(0, self.hidden - 1)

    def handle_data(self, data: str) -> None:
        if not self.hidden:
            self.values.append(data)


def searchable_chunks(
    files: Mapping[str, bytes], *, chunk_size: int = 2000
) -> list[tuple[str, str]]:
    chunks: list[tuple[str, str]] = []
    for path, content in sorted(files.items()):
        suffix = PurePosixPath(path).suffix.lower()
        if suffix not in TEXT_SUFFIXES:
            continue
        try:
            value = content.decode("utf-8")
            if suffix == ".json":
                value = json.dumps(json.loads(value), ensure_ascii=False, sort_keys=True)
            elif suffix == ".html":
                parser = _VisibleText()
                parser.feed(value)
                parser.close()
                value = " ".join(parser.values)
        except (UnicodeError, ValueError, RecursionError) as error:
            raise KnowledgeValidationError(
                "invalid_document_text", "Searchable content is invalid"
            ) from error
        chunks.extend(
            (path, value[offset : offset + chunk_size])
            for offset in range(0, len(value), chunk_size)
        )
    return [(path, value) for path, value in chunks if value]


def package_manifest(files: Mapping[str, bytes]) -> list[PackageMember]:
    return [
        PackageMember(path, len(content), digest(content))
        for path, content in sorted(files.items())
    ]


def extract_text(
    files: Mapping[str, bytes], media_type: str | None = None
) -> list[tuple[str, str]]:
    chunks: list[tuple[str, str]] = []
    for path, content in sorted(files.items()):
        suffix = PurePosixPath(path).suffix.lower()
        if media_type == "application/json":
            suffix = ".json"
        elif media_type and media_type.startswith("text/"):
            suffix = ".txt"
        if suffix not in TEXT_SUFFIXES:
            continue
        try:
            value = content.decode()
            if suffix == ".json":
                value = json.dumps(json.loads(value), ensure_ascii=False, sort_keys=True)
            elif suffix == ".html":
                parser = _VisibleText()
                parser.feed(value)
                value = " ".join(parser.values)
        except (UnicodeError, ValueError, RecursionError) as error:
            raise KnowledgeValidationError(
                "invalid_document_text", "Document text is invalid"
            ) from error
        chunks.extend(
            (path, value[offset : offset + 2000]) for offset in range(0, len(value), 2000)
        )
    return [(path, value) for path, value in chunks if value]
