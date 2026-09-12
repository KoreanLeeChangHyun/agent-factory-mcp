"""Focused actual MCPServer coverage for the Workbench protocol boundary."""

import json
from types import SimpleNamespace
from uuid import UUID

import pytest
from agent_factory_core import (
    WorkbenchConflictError,
    WorkbenchIdempotencyError,
    WorkbenchNotFoundError,
    WorkbenchPermissionError,
    WorkbenchValidationError,
)
from mcp.server.mcpserver.exceptions import ToolError

import app.mcp.server as adapter


USER = UUID("00000000-0000-4000-8000-000000000001")
ORGANIZATION = UUID("00000000-0000-4000-8000-000000000002")
WORKSPACE = UUID("00000000-0000-4000-8000-000000000003")


class Session:
    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None


class FailingQuery:
    def __init__(self, error):
        self.error = error

    async def execute(self, *_args, **_kwargs):
        raise self.error


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("error", "expected"),
    [
        (
            WorkbenchValidationError(("bad panel",)),
            {"code": "invalid_workbench_definition", "diagnostics": ["bad panel"]},
        ),
        (
            WorkbenchConflictError(7),
            {"code": "workbench_revision_conflict", "currentRevision": 7},
        ),
        (
            WorkbenchIdempotencyError("request-1"),
            {"code": "workbench_idempotency_conflict", "requestKey": "request-1"},
        ),
        (WorkbenchPermissionError(), {"code": "workbench_permission_required"}),
        (WorkbenchNotFoundError(), {"code": "workbench_not_found"}),
    ],
)
async def test_actual_server_maps_workbench_domain_errors(monkeypatch, error, expected) -> None:
    async def authorized(*_args, **_kwargs):
        return Session(), SimpleNamespace(
            principal=SimpleNamespace(user_id=USER),
            scope=SimpleNamespace(organization_id=ORGANIZATION, workspace_id=WORKSPACE),
            permissions=frozenset({"workbench.preview"}),
        )

    monkeypatch.setattr(adapter, "_authorized_session", authorized)
    monkeypatch.setattr(
        adapter,
        "build_workbench_service",
        lambda *_args, **_kwargs: SimpleNamespace(get_definition=FailingQuery(error)),
    )
    server = adapter.create_mcp_server()
    result = await server.call_tool(
        "workbench_draft_read",
        {
            "definition_id": "00000000-0000-4000-8000-000000000004",
            "organization_id": str(ORGANIZATION),
            "workspace_id": str(WORKSPACE),
        },
    )

    assert result.is_error is True
    assert json.loads(result.content[0].text) == expected


@pytest.mark.asyncio
async def test_actual_server_uses_closed_workbench_input_schemas() -> None:
    server = adapter.create_mcp_server()
    tools = {tool.name: tool for tool in await server.list_tools()}
    workbench_tools = [tool for name, tool in tools.items() if name.startswith("workbench_")]

    assert len(workbench_tools) == 9
    assert all(tool.input_schema.get("additionalProperties") is False for tool in workbench_tools)
    with pytest.raises(ToolError):
        await server.call_tool("workbench_list", {"unexpected": True})
    with pytest.raises(ToolError):
        await server.call_tool(
            "workbench_create",
            {"key": "UPPER", "title": "Title", "definition": {}},
        )
    with pytest.raises(ToolError):
        await server.call_tool(
            "workbench_publish",
            {
                "definition_id": "00000000-0000-4000-8000-000000000004",
                "expected_revision": 0,
                "request_key": "request-1",
            },
        )
    with pytest.raises(ToolError):
        await server.call_tool(
            "workbench_publish",
            {
                "definition_id": "00000000-0000-4000-8000-000000000004",
                "expected_revision": 1,
                "request_key": "x" * 161,
            },
        )
