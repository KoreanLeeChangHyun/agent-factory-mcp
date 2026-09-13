"""HTTP boundary behavior with shared verifier/authorizer mocked, no live DB."""

from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from starlette.requests import Request
from tests.knowledge.regression.test_cloud_documents import context

from app.common.errors import ApplicationError
from app.modules.document.preview import PREVIEW_HEADERS, render_preview
from app.router import cloud_documents as routes


def http_request(ctx, headers):
    return Request(
        {
            "type": "http",
            "method": "PUT",
            "path": "/",
            "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()],
            "path_params": {
                "organization_id": str(ctx.scope.organization_id),
                "workspace_id": str(ctx.scope.workspace_id),
            },
        }
    )


@pytest.mark.asyncio
async def test_upload_bearer_reuses_verifier_and_reauthorizes_scope(monkeypatch):
    ctx = context()
    token = SimpleNamespace(
        subject=str(ctx.principal.user_id),
        scopes=["document:write"],
        claims={
            "organization_id": str(ctx.scope.organization_id),
            "workspace_id": str(ctx.scope.workspace_id),
            "email": ctx.principal.email,
            "display_name": ctx.principal.display_name,
            "is_platform_admin": False,
        },
    )
    verifier = SimpleNamespace(verify_token=AsyncMock(return_value=token))
    authorizer = SimpleNamespace(authorize=AsyncMock(return_value=ctx))
    monkeypatch.setattr(routes, "ApiTokenVerifier", lambda settings: verifier)
    monkeypatch.setattr(routes, "AuthorizationService", lambda repository: authorizer)
    auth = SimpleNamespace(authenticate_session=AsyncMock())
    req = http_request(ctx, {"Authorization": "Bearer afm_test"})
    assert await routes.upload_context(req, object(), auth) == ctx
    verifier.verify_token.assert_awaited_once_with("afm_test")
    assert authorizer.authorize.call_args.args[1] == ctx.scope
    assert authorizer.authorize.call_args.args[2] == "document.import"
    auth.authenticate_session.assert_not_called()
    token.claims["workspace_id"] = str(uuid4())
    with pytest.raises(ApplicationError):
        await routes.upload_context(req, object(), auth)
    token.claims["workspace_id"] = str(ctx.scope.workspace_id)
    token.scopes = []
    with pytest.raises(ApplicationError):
        await routes.upload_context(req, object(), auth)
    assert authorizer.authorize.await_count == 1


@pytest.mark.asyncio
async def test_browser_binary_upload_requires_csrf_before_session_lookup():
    ctx = context()
    auth = SimpleNamespace(authenticate_session=AsyncMock())
    with pytest.raises(ApplicationError):
        await routes.upload_context(http_request(ctx, {}), object(), auth)
    auth.authenticate_session.assert_not_called()


def test_preview_has_no_package_script_escape_and_no_same_origin_sandbox():
    raw = b'<html><script>parent.document.body.innerHTML="unsafe"</script></html>'
    html = render_preview({"index.html": raw, "</script>.txt": b"data"}, "index.html")
    assert html.count("</script>") == 1
    assert 'parent.document.body.innerHTML="unsafe"' not in html
    assert "sandbox allow-scripts" in PREVIEW_HEADERS["Content-Security-Policy"]
    assert "allow-same-origin" not in PREVIEW_HEADERS["Content-Security-Policy"]
    assert "script-src 'unsafe-inline' data:;" in PREVIEW_HEADERS["Content-Security-Policy"]
    assert "connect-src 'none'" in PREVIEW_HEADERS["Content-Security-Policy"]
    assert "frame-src blob:" in PREVIEW_HEADERS["Content-Security-Policy"]
    with pytest.raises(ApplicationError):
        render_preview({}, "missing.html")
