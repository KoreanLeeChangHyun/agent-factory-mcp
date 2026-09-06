"""MCP adapter for external reporting. Authorization precedes persistence."""

import json
from importlib.resources import files
from typing import Annotated
from uuid import UUID

from mcp.server.auth.middleware.auth_context import get_access_token
from mcp_types import CallToolResult, TextContent

from app.common.errors import ApplicationError
from app.modules.reporting.guide import CLOUD_REPORTING_GUIDE
from app.modules.reporting.schemas import Command, SearchQuery
from app.modules.reporting.search import search_reports
from app.modules.reporting.service import ReportingService

GUIDE = files("app.resources").joinpath("external-agent-reporting.md")


def _tool_result(payload: dict, *, is_error: bool = False) -> CallToolResult:
    # Explicit error results bypass the SDK's ToolError text-prefix wrapping.
    return CallToolResult(
        content=[TextContent(text=json.dumps(payload))],
        structured_content=None if is_error else payload,
        is_error=is_error,
    )


def install_reporting(server, authorize):
    @server.resource("agent-factory://reporting/guide", name="external-agent-reporting-guide")
    async def guide() -> str:
        return GUIDE.read_text(encoding="utf-8")

    @server.resource("agent-factory://reporting/cloud-guide", name="cloud-reporting-guide")
    async def cloud_guide() -> str:
        return CLOUD_REPORTING_GUIDE

    @server.tool(
        name="reporting_search",
        description="Search authorized agents/tasks/reports/results with bounded literal Unicode substrings. No embeddings or execution. Read agent-factory://reporting/cloud-guide.",
    )
    async def reporting_search(
        request: SearchQuery,
        organization_id: str | None = None,
        workspace_id: str | None = None,
    ) -> Annotated[CallToolResult, dict]:
        try:
            session, context = await authorize(
                organization_id, workspace_id, "agent:read", "agent.read"
            )
            async with session:
                return _tool_result(await search_reports(session, context, request))
        except ApplicationError as exc:
            return _tool_result({"code": exc.code, "message": exc.message}, is_error=True)

    @server.tool(
        name="reporting_read",
        description="Read persistent external agent configuration and tasks. Read agent-factory://reporting/guide before reporting; this does not run AI.",
    )
    async def reporting_read(
        organization_id: str | None = None,
        workspace_id: str | None = None,
        task_id: str | None = None,
        before_revision: int | None = None,
    ) -> Annotated[CallToolResult, dict]:
        try:
            session, context = await authorize(
                organization_id, workspace_id, "agent:read", "agent.read"
            )
            async with session:
                service = ReportingService(session, context)
                payload = (
                    await service.detail(UUID(task_id), before_revision)
                    if task_id
                    else await service.snapshot()
                )
                return _tool_result(payload)
        except ApplicationError as exc:
            return _tool_result({"code": exc.code, "message": exc.message}, is_error=True)

    @server.tool(
        name="reporting_write",
        description="Register/update external agent configuration, register a task, or report start/progress/input required/finish and results. Supports immutable local runtime binding and observed heartbeats; see agent-factory://reporting/cloud-guide. Requires agent:report and agent.report. Never schedules or executes AI. Read agent-factory://reporting/guide.",
    )
    async def reporting_write(
        command: Command, organization_id: str | None = None, workspace_id: str | None = None
    ) -> Annotated[CallToolResult, dict]:
        try:
            session, context = await authorize(
                organization_id, workspace_id, "agent:report", "agent.report"
            )
            async with session:
                claims = get_access_token().claims or {}
                payload = await ReportingService(session, context).command(
                    command, UUID(claims["connection_id"]) if claims.get("connection_id") else None
                )
                return _tool_result(payload)
        except ApplicationError as exc:
            return _tool_result({"code": exc.code, "message": exc.message}, is_error=True)
