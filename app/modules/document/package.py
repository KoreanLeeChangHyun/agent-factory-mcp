"""Bounded in-memory package inspection. Never materializes or executes files."""
import base64
import binascii
import hashlib
import io
import json
import re
import stat
import unicodedata
import zipfile
import zlib
from html.parser import HTMLParser
from pathlib import PurePosixPath
from app.common.errors import ApplicationError
from app.modules.document.cloud_schemas import MAX_BYTES, INLINE_MAX_BYTES
from app.modules.document.delivery_limits import PackageLimits

TEXT_SUFFIXES = {".md", ".txt", ".json", ".csv", ".html", ".css", ".js", ".py", ".yaml", ".yml"}

def invalid(code="invalid_package"):
    raise ApplicationError(code, "Document payload failed bounded content validation", 400)

def safe_path(path):
    if (not path or len(path) > 1024 or re.search(r"[\\:\x00-\x1f]", path)
        or path.startswith("/") or any(p in {"", ".", ".."} for p in path.split("/"))
        or len(path.split("/")) > 32 or unicodedata.normalize("NFC", path) != path):
        invalid("invalid_package_path")
    return path

def digest(content):
    return hashlib.sha256(content).hexdigest()

def decode_content(request):
    try:
        raw = base64.b64decode(request.content_base64, validate=True)
    except (ValueError, binascii.Error):
        invalid("invalid_base64")
    if not raw or len(raw) > INLINE_MAX_BYTES:
        invalid("document_bounds")
    if digest(raw) != request.source_sha256:
        invalid("source_hash_mismatch")
    safe_path(request.filename)
    return raw

def unpack(raw, media_type, filename, limits=None):
    limits = limits or PackageLimits(upload_bytes=MAX_BYTES, expanded_bytes=MAX_BYTES, member_bytes=MAX_BYTES, entries=256, ratio=100)
    if len(raw) > limits.upload_bytes:
        invalid("document_bounds")
    if media_type != "application/zip":
        return {safe_path(filename): raw}
    result = {}
    seen = set()
    total = 0
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            if len(archive.infolist()) > limits.entries:
                invalid("package_bounds")
            for item in archive.infolist():
                name = safe_path(item.filename.rstrip("/") if item.is_dir() else item.filename)
                mode = item.external_attr >> 16
                if stat.S_IFMT(mode) not in {0, stat.S_IFREG, stat.S_IFDIR}:
                    invalid("package_special_file")
                if (stat.S_IFMT(mode) == stat.S_IFDIR) != item.is_dir() and stat.S_IFMT(mode) != 0:
                    invalid("package_special_file")
                if item.flag_bits & 1 or item.compress_type not in {zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED}:
                    invalid("unsupported_archive")
                if name.casefold() in seen:
                    invalid("package_path_collision")
                seen.add(name.casefold())
                if item.is_dir():
                    continue
                total += item.file_size
                if item.file_size > limits.member_bytes or total > limits.expanded_bytes or item.file_size > max(1, item.compress_size) * limits.ratio:
                    invalid("package_bounds")
                with archive.open(item) as stream:
                    data = stream.read(limits.member_bytes + 1)
                if len(data) != item.file_size:
                    invalid("package_bounds")
                result[name] = data
        if not result:
            invalid()
        for name in result:
            if any(parent.as_posix().casefold() in {p.casefold() for p in result}
                   for parent in PurePosixPath(name).parents if str(parent) != "."):
                invalid("package_path_collision")
        return result
    except (zipfile.BadZipFile, zlib.error, RuntimeError, NotImplementedError, OSError, EOFError, ValueError):
        invalid()

class TextParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.text = []
        self.hidden = 0
    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style"}: self.hidden += 1
    def handle_endtag(self, tag):
        if tag in {"script", "style"}: self.hidden = max(0, self.hidden - 1)
    def handle_data(self, data):
        if not self.hidden: self.text.append(data)

def extract(files, media_type=None):
    result = []
    for name, raw in sorted(files.items()):
        suffix = PurePosixPath(name).suffix.lower()
        if media_type == "application/json":
            suffix = ".json"
        elif media_type and media_type.startswith("text/"):
            suffix = ".txt"
        if suffix not in TEXT_SUFFIXES:
            continue
        try:
            text = raw.decode("utf-8")
            if suffix == ".json":
                text = json.dumps(json.loads(text), ensure_ascii=False, sort_keys=True)
            elif suffix == ".html":
                parser = TextParser()
                parser.feed(text)
                text = " ".join(parser.text)
        except (UnicodeError, ValueError, RecursionError):
            invalid("invalid_document_text")
        for offset in range(0, len(text), 2000):
            result.append((name, text[offset:offset + 2000]))
    return result
