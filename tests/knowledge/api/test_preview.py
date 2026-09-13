from __future__ import annotations

from api.http.routes.knowledge.preview import PREVIEW_HEADERS, render_preview


def test_package_preview_uses_isolated_headers_and_escapes_embedded_markup() -> None:
    rendered = render_preview(
        {
            "index.html": b"<h1>safe</h1></script><script>globalThis.compromised=true</script>",
            "asset.css": b"body { color: red; }",
        },
        "index.html",
    )

    assert PREVIEW_HEADERS["X-Frame-Options"] == "SAMEORIGIN"
    assert PREVIEW_HEADERS["Cache-Control"] == "no-store"
    assert "connect-src 'none'" in PREVIEW_HEADERS["Content-Security-Policy"]
    assert "sandbox allow-scripts" in PREVIEW_HEADERS["Content-Security-Policy"]
    assert "</script><script>globalThis.compromised" not in rendered
    assert "const packageData=" in rendered
    assert "render(packageData.entry)" in rendered
