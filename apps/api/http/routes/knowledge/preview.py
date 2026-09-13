from __future__ import annotations

import base64
import json
from collections.abc import Mapping
from importlib.resources import files

from agent_factory_core.knowledge.errors import KnowledgeValidationError

PREVIEW_CSP = (
    "default-src 'none'; script-src 'unsafe-inline' data:; "
    "style-src 'unsafe-inline' data: blob:; img-src data: blob:; "
    "font-src data: blob:; media-src data: blob:; connect-src 'none'; "
    "frame-src blob:; object-src 'none'; base-uri 'none'; form-action 'none'; "
    "frame-ancestors 'self'; sandbox allow-scripts"
)
PREVIEW_HEADERS = {
    "Content-Security-Policy": PREVIEW_CSP,
    "X-Frame-Options": "SAMEORIGIN",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
}


def render_preview(package_files: Mapping[str, bytes], entry: str) -> str:
    if entry not in package_files:
        raise KnowledgeValidationError("human_entry_missing", "Package has no readable entry")
    payload = json.dumps(
        {
            "entry": entry,
            "files": {
                path: base64.b64encode(content).decode() for path, content in package_files.items()
            },
        },
        ensure_ascii=True,
    ).replace("<", "\\u003c")
    runtime = (
        files("api.http.routes.knowledge")
        .joinpath("preview_runtime.js")
        .read_text(encoding="utf-8")
    )
    return (
        '<!doctype html><html lang="ko"><meta charset="utf-8">'
        "<title>명세 문서</title>"
        "<style>html,body,iframe{margin:0;width:100%;height:100%;border:0}"
        "body{overflow:hidden}</style><body><script>const packageData="
        + payload
        + ";\n"
        + runtime
        + "</script></body></html>"
    )
