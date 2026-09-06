"""Trusted preview wrapper; package code runs only in a nested opaque origin."""
import base64
import json
from pathlib import Path
from app.common.errors import ApplicationError

# Integration must preserve these headers ONLY on the authenticated preview route.
# The outer frame's frame-src also gates navigation initiated by its untrusted child.
PREVIEW_CSP = ("default-src 'none'; script-src 'unsafe-inline' data:; "
               "style-src 'unsafe-inline' data: blob:; img-src data: blob:; font-src data: blob:; "
               "media-src data: blob:; connect-src 'none'; frame-src blob:; "
               "object-src 'none'; base-uri 'none'; form-action 'none'; "
               "frame-ancestors 'self'; sandbox allow-scripts")
PREVIEW_HEADERS = {"Content-Security-Policy": PREVIEW_CSP, "X-Frame-Options": "SAMEORIGIN",
                   "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
                   "Referrer-Policy": "no-referrer",
                   "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()"}

def render_preview(files, entry):
    if entry not in files:
        raise ApplicationError("human_entry_missing", "Package has no readable HTML entry", 422)
    payload = json.dumps({"entry": entry, "files": {name: base64.b64encode(raw).decode()
                          for name, raw in files.items()}}, ensure_ascii=True).replace("<", "\\u003c")
    runtime = Path(__file__).with_name("preview_runtime.js").read_text(encoding="utf-8")
    return ('<!doctype html><html lang="ko"><meta charset="utf-8"><title>명세 문서</title>'
            '<style>html,body,iframe{margin:0;width:100%;height:100%;border:0}body{overflow:hidden}</style>'
            '<body><script>const packageData=' + payload + ';\n' + runtime + '</script></body></html>')
