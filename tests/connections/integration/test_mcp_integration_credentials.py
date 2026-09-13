"""Focused MCP transport contract for migrated provider credential authority."""

import json
from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import uuid4

import pytest
from agent_factory_core.connections.providers.credentials import OAuthStart
from agent_factory_core.shared.errors import ApplicationError
from mcp.server import MCPServer

import app.mcp.integrations as adapter


class Session:
    def __init__(self) -> None:
        self.exit_error = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, error_type, _error, _traceback):
        self.exit_error = error_type


class Credentials:
    def __init__(self) -> None:
        self.calls = []

    async def set_token(self, context, connection_id, *, token, approved_scopes):
        self.calls.append(("token", context, connection_id, token, approved_scopes))
        return {
            "connection_id": str(connection_id),
            "health": "unknown",
            "granted_scopes": None,
        }

    async def begin(self, context, connection_id, scopes):
        self.calls.append(("begin", context, connection_id, scopes))
        return OAuthStart(
            "https://accounts.example/authorize?state=opaque",
            datetime(2026, 9, 14, 1, 2, 3, tzinfo=UTC),
            tuple(scopes),
        )

    async def complete(self, context, *, provider, state, code):
        self.calls.append(("complete", context, provider, state, code))
        return {
            "connection_id": str(uuid4()),
            "status": "active",
            "requested_scopes": ["Files.Read"],
            "granted_scopes": ["Files.Read"],
            "excess_scopes": [],
        }


def payload(result):
    return json.loads(result.content[0].text)


@pytest.mark.asyncio
async def test_mcp_credential_tools_use_target_context_and_preserve_results(monkeypatch) -> None:
    session, credentials = Session(), Credentials()
    context = SimpleNamespace(scope=SimpleNamespace(workspace_id=uuid4()))
    authorizations = []

    async def authorize(organization_id, workspace_id, token_scope, permission):
        authorizations.append((organization_id, workspace_id, token_scope, permission))
        return session, context

    monkeypatch.setattr(
        adapter, "build_target_credential_service", lambda current, _settings: credentials
    )
    server = MCPServer("credential-contract")
    adapter.install_integrations(server, authorize)
    connection_id = str(uuid4())

    token = await server.call_tool(
        "integration_token_set",
        {
            "connection_id": connection_id,
            "token": "secret-input",
            "approved_scopes": [],
            "organization_id": "organization",
            "workspace_id": "workspace",
        },
    )
    begun = await server.call_tool(
        "integration_oauth_begin",
        {
            "connection_id": connection_id,
            "scopes": ["Files.Read"],
            "organization_id": "organization",
            "workspace_id": "workspace",
        },
    )
    completed = await server.call_tool(
        "integration_oauth_complete",
        {
            "state": "opaque",
            "code": "authorization-code",
            "organization_id": "organization",
            "workspace_id": "workspace",
        },
    )

    assert payload(token) == {
        "connection_id": connection_id,
        "health": "unknown",
        "granted_scopes": None,
    }
    assert payload(begun) == {
        "authorization_url": "https://accounts.example/authorize?state=opaque",
        "expires_at": "2026-09-14T01:02:03+00:00",
        "requested_scopes": ["Files.Read"],
    }
    assert payload(completed)["status"] == "active"
    assert credentials.calls[-1][2] is None
    assert authorizations == [
        ("organization", "workspace", "integration:manage", "integration.update")
    ] * 3
    assert "secret-input" not in json.dumps(
        [payload(token), payload(begun), payload(completed)]
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("error", "expected"),
    [
        (
            ApplicationError("unsupported_scope", "Scope is not approved", 422),
            {"code": "unsupported_scope", "message": "Scope is not approved"},
        ),
        (
            RuntimeError("provider response contained secret-value"),
            {"code": "integration_operation_failed"},
        ),
    ],
)
async def test_mcp_credential_failures_are_bounded_and_trigger_session_rollback(
    monkeypatch, error, expected
) -> None:
    session = Session()

    class FailingCredentials:
        async def set_token(self, *_args, **_kwargs):
            raise error

    async def authorize(*_args):
        return session, object()

    monkeypatch.setattr(
        adapter,
        "build_target_credential_service",
        lambda current, _settings: FailingCredentials(),
    )
    server = MCPServer("credential-errors")
    adapter.install_integrations(server, authorize)

    result = await server.call_tool(
        "integration_token_set",
        {
            "connection_id": str(uuid4()),
            "token": "secret-value",
            "approved_scopes": [],
        },
    )

    assert result.is_error is True
    assert payload(result) == expected
    assert "secret-value" not in result.content[0].text
    assert session.exit_error is type(error)
