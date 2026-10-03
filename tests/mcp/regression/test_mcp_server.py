"""MCP capability registration and token verifier tests."""

import pytest
from api.mcp.server import ACTIVITIES, create_mcp_server


@pytest.mark.asyncio
async def test_mcp_registers_six_activity_resources_and_scoped_tools() -> None:
    server = create_mcp_server()
    resources = await server.list_resources()
    tools = await server.list_tools()

    assert set(ACTIVITIES) == {"schedule", "agents", "documents", "integrations", "logs", "tests"}
    assert {str(resource.uri) for resource in resources} == {
        "agent-factory://activities/schedule",
        "agent-factory://activities/agents",
        "agent-factory://activities/documents",
        "agent-factory://activities/integrations",
        "agent-factory://activities/logs",
        "agent-factory://activities/tests",
        "agent-factory://planning/import-guide",
        "agent-factory://reporting/guide",
        "agent-factory://reporting/cloud-guide",
        "agent-factory://integrations/guide",
    }
    assert {tool.name for tool in tools} >= {
        "planning_schema",
        "planning_read",
        "planning_import_preview",
        "planning_import_apply",
        "reporting_read",
        "reporting_write",
        "workspace_list",
        "document_list",
        "document_import",
        "document_template",
        "document_read",
        "document_write",
        "document_search",
        "document_index",
        "document_prepare_upload",
        "document_finalize_upload",
        "reporting_search",
        "integration_inspect",
        "integration_token_set",
        "integration_oauth_begin",
        "integration_oauth_complete",
        "collection_list",
        "collection_create",
        "collection_start",
        "collection_status",
        "collection_results",
        "collection_cancel",
        "agent_list",
        "schedule_list",
        "integration_list",
        "log_list",
        "test_status",
        "agent_run_submit",
    }


def test_bound_token_scope_accepts_equivalent_uuid_text_forms(monkeypatch) -> None:
    from types import SimpleNamespace
    from uuid import uuid4

    from agent_factory_core.shared.errors import PermissionDeniedError
    from api.mcp import server

    organization_id, workspace_id = uuid4(), uuid4()
    token = SimpleNamespace(
        claims={"organization_id": str(organization_id), "workspace_id": str(workspace_id)}
    )
    monkeypatch.setattr(server, "get_access_token", lambda: token)

    expected = (str(organization_id), str(workspace_id))
    assert server._resolve_scope(organization_id.hex, workspace_id.hex) == expected
    assert server._resolve_scope(None, str(workspace_id).upper()) == expected
    with pytest.raises(PermissionDeniedError, match="workspace_token_mismatch"):
        server._resolve_scope(None, uuid4().hex)
    with pytest.raises(PermissionDeniedError, match="workspace_token_mismatch"):
        server._resolve_scope(None, "not-a-uuid")
