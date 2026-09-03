"""MCP capability registration and token verifier tests."""

import pytest

from app.mcp.server import ACTIVITIES, create_mcp_server


@pytest.mark.asyncio
async def test_mcp_registers_six_activity_resources_and_scoped_tools() -> None:
    server = create_mcp_server()
    resources = await server.list_resources()
    tools = await server.list_tools()

    assert len(ACTIVITIES) == 6
    assert len(resources) == 6
    assert {tool.name for tool in tools} >= {
        "workspace_list",
        "document_list",
        "agent_list",
        "schedule_list",
        "integration_list",
        "log_list",
        "test_status",
        "agent_run_submit",
    }
