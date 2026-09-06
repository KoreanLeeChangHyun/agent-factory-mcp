"""Authoring baseline delivery preserves source bytes and never grants publication."""
import base64
import hashlib
import json
from importlib.resources import files
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError
from app.common.errors import ApplicationError, PermissionDeniedError
from app.mcp.documents import install_documents
from app.modules.document.template import TemplateRequest, read_template


def test_complete_inventory_roundtrip_and_licenses():
    manifest = read_template(TemplateRequest())
    assert manifest["accepted_pair"] is False
    root = files("app.resources").joinpath("document_template")
    assert {"index.html", "styles.css", "app.js", "library.css", "THIRD_PARTY_NOTICES.txt"} <= manifest["files"].keys()
    assert {"vendor/mermaid/11.17.2/LICENSE", "vendor/tabulator/6.5.2/LICENSE"} <= manifest["files"].keys()
    for path, metadata in manifest["files"].items():
        raw = bytearray(); offset = 0
        while offset is not None:
            result = read_template(TemplateRequest(operation="read", path=path, version=manifest["version"], offset=offset))
            chunk = base64.b64decode(result["content_base64"])
            assert len(chunk) <= 65536
            raw.extend(chunk); offset = result["next_offset"]
        assert bytes(raw) == root.joinpath(*path.split("/")).read_bytes()
        assert len(raw) == metadata["size_bytes"]
        assert hashlib.sha256(raw).hexdigest() == metadata["sha256"]
    html = root.joinpath("index.html").read_text()
    assert 'data-template-placeholder' in html  # A baseline, not an accepted pair.
    assert 'src="./app.js"' in html and 'href="./styles.css"' in html
    assert '<svg' in html and '<main' in html


@pytest.mark.parametrize("path", ["../index.html", "/etc/passwd", "vendor/../index.html", "missing", "index.html/child"])
def test_unlisted_member_is_never_opened(path):
    version = read_template(TemplateRequest())["version"]
    with pytest.raises(ApplicationError, match="Unknown template member"):
        read_template(TemplateRequest(operation="read", path=path, version=version))


@pytest.mark.parametrize("payload", [{"limit": 65537}, {"offset": -1}, {"unknown": True}, {"operation": "write"}, {"version": "bad"}])
def test_closed_bounded_request(payload):
    with pytest.raises(ValidationError): TemplateRequest(**payload)


def test_version_and_offset_fail_closed():
    with pytest.raises(ApplicationError, match="current template manifest"):
        read_template(TemplateRequest(operation="read", path="index.html", version="0" * 64))
    manifest = read_template(TemplateRequest())
    with pytest.raises(ApplicationError, match="Offset exceeds"):
        read_template(TemplateRequest(operation="read", path="index.html", version=manifest["version"], offset=manifest["files"]["index.html"]["size_bytes"] + 1))


class Server:
    def __init__(self): self.tools = {}
    def tool(self, name, **kwargs):
        def register(fn): self.tools[name] = fn; return fn
        return register


@pytest.mark.asyncio
async def test_template_uses_shared_workspace_authorization_before_read(monkeypatch):
    server = Server()
    authorize = AsyncMock(side_effect=PermissionDeniedError("denied", "Denied"))
    install_documents(server, authorize)
    reader = lambda request: pytest.fail("Read before authorization")
    monkeypatch.setattr("app.mcp.documents.read_template", reader)
    result = await server.tools["document_template"](TemplateRequest(), "organization", "workspace")
    assert result.is_error
    authorize.assert_awaited_once_with("organization", "workspace", "document:read", "workspace.read")


@pytest.mark.asyncio
async def test_template_manifest_is_json_data_after_current_permission(monkeypatch):
    server = Server()
    session = AsyncMock()
    context = SimpleNamespace(permissions=frozenset({"workspace.read"}), scope=SimpleNamespace(workspace_id="workspace"))
    authorize = AsyncMock(return_value=(session, context))
    install_documents(server, authorize)
    result = await server.tools["document_template"](TemplateRequest(), "organization", "workspace")
    assert not result.is_error
    manifest = json.loads(result.content[0].text)
    assert manifest["accepted_pair"] is False
    assert "files" in manifest
