"""Workspace-bound HTTP entrypoint; successful MCP results verify client setup."""

import json
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select, update
from starlette._utils import get_route_path
from starlette.responses import JSONResponse

from app.common.errors import ApplicationError
from app.core.config import settings
from app.db.session import get_session_factory
from app.mcp.auth import ApiTokenVerifier
from app.modules.auth.authorization import (
    AuthorizationRepository,
    AuthorizationScope,
    AuthorizationService,
)
from app.modules.auth.service import Principal
from app.modules.mcp_connection.models import MCPConnection
from app.modules.organization.permissions import token_permissions
from app.modules.workspace.models import Workspace, WorkspaceStatus


def successful_result(body: bytes) -> bool:
    try:
        value = json.loads(body)
        return (
            isinstance(value, dict)
            and "result" in value
            and "error" not in value
            and not (isinstance(value["result"], dict) and value["result"].get("isError"))
        )
    except (ValueError, UnicodeDecodeError):
        return any(
            successful_result(line[5:].strip())
            for line in body.splitlines()
            if line.startswith(b"data:")
        )


class WorkspaceMCPTransport:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        path = get_route_path(scope).rstrip("/")
        if not path.startswith("/workspaces/"):
            return await self.app(scope, receive, send)
        try:
            workspace_id = UUID(path.removeprefix("/workspaces/"))
        except ValueError:
            return await JSONResponse({"error": "invalid_workspace"}, status_code=404)(
                scope, receive, send
            )
        headers = dict(scope.get("headers", []))
        bearer = headers.get(b"authorization", b"").decode("latin-1")
        if not bearer.lower().startswith("bearer "):
            return await self.error(scope, receive, send, 401, "authentication_required")
        token = await ApiTokenVerifier(settings).verify_token(bearer[7:])
        if token is None:
            return await self.error(scope, receive, send, 401, "invalid_or_expired_token")
        claims = token.claims or {}
        if claims.get("workspace_id") != str(workspace_id) or not claims.get("connection_id"):
            return await self.error(scope, receive, send, 403, "workspace_token_required")
        principal = Principal(
            UUID(token.subject),
            claims["email"],
            claims["display_name"],
            claims["is_platform_admin"],
        )
        auth_scope = AuthorizationScope(UUID(claims["organization_id"]), workspace_id)
        try:
            async with get_session_factory()() as session:
                await AuthorizationService(AuthorizationRepository(session)).authorize_any(
                    principal, auth_scope, token_permissions(token.scopes)
                )
                active = await session.scalar(
                    select(Workspace.id).where(
                        Workspace.id == workspace_id, Workspace.status == WorkspaceStatus.ACTIVE
                    )
                )
                if active is None:
                    return await self.error(scope, receive, send, 403, "workspace_unavailable")
        except ApplicationError:
            return await self.error(scope, receive, send, 403, "workspace_access_denied")
        # Replay the body unchanged to the official SDK after inspecting its method.
        chunks = []
        while True:
            event = await receive()
            if event["type"] == "http.disconnect":
                return
            chunks.append(event.get("body", b""))
            if sum(map(len, chunks)) > 2 * 1024 * 1024:
                return await self.error(scope, receive, send, 413, "request_too_large")
            if not event.get("more_body"):
                break
        body = b"".join(chunks)
        try:
            message = json.loads(body)
        except ValueError:
            message = {}
        sent = False

        async def replay():
            nonlocal sent
            if not sent:
                sent = True
                return {"type": "http.request", "body": body, "more_body": False}
            return await receive()

        status = 0
        output = bytearray()

        async def capture(event):
            nonlocal status
            if event["type"] == "http.response.start":
                status = event["status"]
            if event["type"] == "http.response.body" and len(output) < 2 * 1024 * 1024:
                output.extend(event.get("body", b""))
            await send(event)

        forwarded = dict(scope)
        forwarded["path"] = scope.get("root_path", "") + "/"
        forwarded["raw_path"] = forwarded["path"].encode()
        await self.app(forwarded, replay, capture)
        method = message.get("method") if isinstance(message, dict) else None
        if (
            status == 200
            and method in {"tools/list", "tools/call", "resources/read"}
            and successful_result(bytes(output))
        ):
            async with get_session_factory()() as session:
                try:
                    await AuthorizationService(AuthorizationRepository(session)).authorize_any(
                        principal, auth_scope, token_permissions(token.scopes)
                    )
                except ApplicationError:
                    return
                now = datetime.now(UTC)
                params = message.get("params") or {}
                client_info = (params.get("_meta") or {}).get(
                    "io.modelcontextprotocol/clientInfo", {}
                )
                client_name = client_info.get("name") if isinstance(client_info, dict) else None
                # Header/client metadata is descriptive only, never identity or authority.
                client_name = str(
                    client_name or headers.get(b"user-agent", b"MCP client").decode("latin-1")
                )[:120]
                await session.execute(
                    update(MCPConnection)
                    .where(
                        MCPConnection.id == UUID(claims["connection_id"]),
                        MCPConnection.user_id == principal.user_id,
                        MCPConnection.workspace_id == workspace_id,
                    )
                    .values(
                        first_confirmed_at=func.coalesce(MCPConnection.first_confirmed_at, now),
                        last_seen_at=now,
                        client_name=client_name,
                    )
                )
                await session.commit()

    async def error(self, scope, receive, send, status, code):
        headers = {"Cache-Control": "no-store"}
        if status == 401:
            headers["WWW-Authenticate"] = 'Bearer realm="Agent Factory", error="invalid_token"'
        if status == 403:
            headers["WWW-Authenticate"] = 'Bearer error="insufficient_scope"'
        await JSONResponse({"error": code}, status_code=status, headers=headers)(
            scope, receive, send
        )
