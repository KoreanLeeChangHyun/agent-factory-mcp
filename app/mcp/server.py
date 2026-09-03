"""Authenticated Agent Factory MCP resources and tools."""

from uuid import UUID

from mcp.server import MCPServer
from mcp.server.auth.middleware.auth_context import get_access_token
from mcp.server.auth.settings import AuthSettings

from app.common.errors import PermissionDeniedError
from app.core.config import settings
from app.db.session import get_session_factory
from app.infrastructure.job_queue import CeleryJobPublisher
from app.mcp.auth import ApiTokenVerifier
from app.modules.agent.repository import AgentRepository
from app.modules.agent.service import AgentService
from app.modules.auth.authorization import (
    AuthorizationRepository,
    AuthorizationScope,
    AuthorizationService,
)
from app.modules.auth.service import Principal
from app.modules.document.models import DocumentType
from app.modules.document.repository import DocumentRepository
from app.modules.integration.repository import IntegrationRepository
from app.modules.schedule.repository import ScheduleRepository
from app.modules.schedule.service import ScheduleService
from app.modules.workspace.repository import WorkspaceRepositoryStore

ACTIVITIES = {
    "schedule": "Schedules and durable background jobs",
    "agents": "Versioned Agent definitions and executions",
    "documents": "Original, Processed, and Specification Documents",
    "integrations": "External provider connections and synchronization",
    "logs": "Durable execution and operational history",
    "tests": "Workspace verification status and results",
}


def _identity(required_scope: str) -> Principal:
    token = get_access_token()
    if token is None or required_scope not in token.scopes or token.subject is None:
        raise PermissionDeniedError("mcp_scope_required", f"MCP scope required: {required_scope}")
    claims = token.claims or {}
    return Principal(
        UUID(token.subject),
        str(claims.get("email", "service@agent-factory.invalid")),
        str(claims.get("display_name", "MCP client")),
        bool(claims.get("is_platform_admin", False)),
    )


async def _authorized_session(
    organization_id: str,
    workspace_id: str,
    token_scope: str,
    permission: str,
):
    principal = _identity(token_scope)
    session = get_session_factory()()
    scope = AuthorizationScope(UUID(organization_id), UUID(workspace_id))
    try:
        context = await AuthorizationService(AuthorizationRepository(session)).authorize(
            principal, scope, permission
        )
    except Exception:
        await session.close()
        raise
    return session, context


def create_mcp_server() -> MCPServer:
    """Create an isolated server because its session manager is single-use."""

    server = MCPServer(
        "agent-factory",
        title="Agent Factory",
        description="Tenant-safe Agent Factory control plane",
        version="0.1.0",
        token_verifier=ApiTokenVerifier(settings),
        auth=AuthSettings(
            issuer_url=settings.public_base_url,
            resource_server_url=f"{settings.public_base_url.rstrip('/')}/mcp",
        ),
    )

    for activity, description in ACTIVITIES.items():
        server.resource(f"agent-factory://activities/{activity}", name=f"{activity}-activity")(
            _resource_reader(activity, description)
        )

    @server.tool(name="workspace_list", description="List Workspaces in an organization")
    async def workspace_list(organization_id: str) -> list[dict[str, object]]:
        principal = _identity("workspace:read")
        async with get_session_factory()() as session:
            scope = AuthorizationScope(UUID(organization_id), None)
            await AuthorizationService(AuthorizationRepository(session)).authorize(
                principal, scope, "workspace.read"
            )
            rows = await WorkspaceRepositoryStore(session).list(scope.organization_id)
            return [_model(row) for row in rows]

    @server.tool(name="document_list", description="List Workspace Documents")
    async def document_list(
        organization_id: str, workspace_id: str, document_type: str | None = None
    ) -> list[dict[str, object]]:
        session, context = await _authorized_session(
            organization_id, workspace_id, "document:read", "workspace.read"
        )
        async with session:
            kind = DocumentType(document_type) if document_type else None
            rows = await DocumentRepository(session).list(context.scope.workspace_id, kind)  # type: ignore[arg-type]
            return [_model(row) for row in rows]

    @server.tool(name="agent_list", description="List versioned Agent definitions")
    async def agent_list(organization_id: str, workspace_id: str) -> list[dict[str, object]]:
        session, context = await _authorized_session(
            organization_id, workspace_id, "agent:read", "workspace.read"
        )
        async with session:
            rows = await AgentRepository(session).list_definitions(context.scope.workspace_id)  # type: ignore[arg-type]
            return [_model(row) for row in rows]

    @server.tool(name="schedule_list", description="List Workspace schedules")
    async def schedule_list(organization_id: str, workspace_id: str) -> list[dict[str, object]]:
        session, context = await _authorized_session(
            organization_id, workspace_id, "schedule:read", "workspace.read"
        )
        async with session:
            rows = await ScheduleRepository(session).list_schedules(context.scope.workspace_id)  # type: ignore[arg-type]
            return [_model(row) for row in rows]

    @server.tool(name="integration_list", description="List external integration connections")
    async def integration_list(organization_id: str, workspace_id: str) -> list[dict[str, object]]:
        session, context = await _authorized_session(
            organization_id, workspace_id, "integration:read", "workspace.read"
        )
        async with session:
            rows = await IntegrationRepository(session).list_connections(context.scope.workspace_id)  # type: ignore[arg-type]
            return [_model(row) for row in rows]

    @server.tool(name="log_list", description="List durable Workspace job logs")
    async def log_list(organization_id: str, workspace_id: str) -> list[dict[str, object]]:
        session, context = await _authorized_session(
            organization_id, workspace_id, "logs:read", "workspace.read"
        )
        async with session:
            rows = await ScheduleRepository(session).list_jobs(context.scope.workspace_id)  # type: ignore[arg-type]
            return [_model(row) for row in rows]

    @server.tool(name="test_status", description="Report the Workspace verification interface")
    async def test_status(organization_id: str, workspace_id: str) -> dict[str, object]:
        session, _ = await _authorized_session(
            organization_id, workspace_id, "tests:read", "workspace.read"
        )
        await session.close()
        return {"status": "available", "execution": "asynchronous", "activity": "tests"}

    @server.tool(
        name="agent_run_submit",
        description="Create an idempotent Agent run and return its durable asynchronous Job",
    )
    async def agent_run_submit(
        organization_id: str,
        workspace_id: str,
        agent_definition_id: str,
        idempotency_key: str,
        input_payload: dict[str, object],
        agent_version_id: str | None = None,
    ) -> dict[str, object]:
        session, context = await _authorized_session(
            organization_id, workspace_id, "agent:execute", "agent.execute"
        )
        async with session:
            run = await AgentService(AgentRepository(session)).create_run(
                context,
                UUID(agent_definition_id),
                UUID(agent_version_id) if agent_version_id else None,
                idempotency_key,
                input_payload,
            )
            job = await ScheduleService(
                ScheduleRepository(session), CeleryJobPublisher(), settings
            ).enqueue(
                context,
                "agent.run",
                "agents",
                {"agent_run_id": str(run.id)},
                f"agent-run:{run.id}",
            )
            return {"agent_run_id": str(run.id), "job_id": str(job.id), "status": job.status.value}

    return server


def _resource_reader(activity: str, description: str):
    async def read() -> str:
        return f"{activity}: {description}"

    return read


def _model(record: object) -> dict[str, object]:
    from sqlalchemy import inspect

    mapper = inspect(record).mapper
    result: dict[str, object] = {}
    for column in mapper.columns:
        value = getattr(record, column.key)
        if isinstance(value, UUID):
            value = str(value)
        elif hasattr(value, "isoformat"):
            value = value.isoformat()
        elif hasattr(value, "value"):
            value = value.value
        result[column.key] = value
    return result
