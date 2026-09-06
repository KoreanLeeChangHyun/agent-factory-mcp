"""Packaged copy-once authoring baseline; delivery is data, never executable HTML."""
import base64
import hashlib
import json
from importlib.resources import files
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.common.errors import ApplicationError


class TemplateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    operation: Literal["manifest", "read"] = "manifest"
    path: str | None = Field(default=None, max_length=256)
    offset: int = Field(default=0, ge=0, le=16 * 1024 * 1024)
    limit: int = Field(default=65536, ge=1, le=65536)
    version: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")


def read_template(request: TemplateRequest) -> dict:
    resource = files("app.resources")
    raw_manifest = resource.joinpath("document_template_inventory.json").read_bytes()
    version = hashlib.sha256(raw_manifest).hexdigest()
    inventory = json.loads(raw_manifest)
    if request.operation == "manifest":
        if request.path is not None or request.offset or request.version is not None:
            raise ApplicationError("template_request_invalid", "Manifest takes no member or version", 400)
        return {"template": "specification", "version": version, "files": inventory,
                "accepted_pair": False, "chunk_limit": 65536}
    if request.version != version:
        raise ApplicationError("template_version_conflict", "Read the current template manifest first", 409)
    if request.path not in inventory:
        raise ApplicationError("template_member_not_found", "Unknown template member", 404)
    raw = resource.joinpath("document_template", *request.path.split("/")).read_bytes()
    expected = inventory[request.path]
    if len(raw) != expected["size_bytes"] or hashlib.sha256(raw).hexdigest() != expected["sha256"]:
        raise ApplicationError("template_integrity_error", "Packaged template does not match inventory", 500)
    if request.offset > len(raw):
        raise ApplicationError("template_offset_invalid", "Offset exceeds member length", 400)
    chunk = raw[request.offset:request.offset + request.limit]
    end = request.offset + len(chunk)
    return {"version": version, "path": request.path, **expected, "offset": request.offset,
            "content_base64": base64.b64encode(chunk).decode("ascii"),
            "next_offset": end if end < len(raw) else None}
