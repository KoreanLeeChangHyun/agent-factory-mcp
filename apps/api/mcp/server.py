"""Authenticated Agent Factory MCP resources and tools."""

import json
from functools import wraps
from typing import Annotated
from uuid import UUID

from api.composition.workbenches import build_workbench_service
from api.composition.workspaces import workspace_use_cases
from api.http.routes.workbenches import present_definition, present_release
from agent_factory_core import (
    WorkbenchActor,
    WorkbenchConflictError,
    WorkbenchError,
    WorkbenchIdempotencyError,
    WorkbenchNotFoundError,
    WorkbenchPermissionError,
    WorkbenchValidationError,
)
from mcp.server import MCPServer
from mcp.server.auth.middleware.auth_context import get_access_token
from mcp.server.auth.settings import AuthSettings
from mcp_types import CallToolResult, TextContent
from pydantic import Field

from agent_factory_core.shared.errors import PermissionDeniedError
from api.settings import settings
from agent_factory_adapters.postgres.database.session import get_session_factory
from agent_factory_adapters.postgres.database.tenant import TenantContext, install_tenant_context
from api.mcp.auth import ApiTokenVerifier
from api.composition.identity import compose_authorization
from api.composition.queries import document_queries, agent_queries, schedule_queries, connection_queries
from agent_factory_core.identity.authorization import AuthorizationScope, AuthorizedContext
from agent_factory_core.identity import Principal
from agent_factory_core.organizations.permissions import token_permissions

ACTIVITIES = {
    "schedule": "Schedules and durable background jobs",
    "agents": "External-agent configuration, task reports and results; legacy execution tools are separate",
    "documents": "Original, Processed, and Specification Documents",
    "integrations": "External provider connections and synchronization",
    "logs": "Durable execution and operational history",
    "tests": "Workspace verification status and results",
}

WorkbenchIdentifier = Annotated[
    str,
    Field(
        pattern=(
            r"^(?:[0-9a-fA-F]{32}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-"
            r"[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$"
        )
    ),
]
WorkbenchKey = Annotated[str, Field(pattern=r"^[a-z][a-z0-9-]{0,63}$")]
WorkbenchTitle = Annotated[str, Field(min_length=1, max_length=200)]
WorkbenchRevision = Annotated[int, Field(ge=1, le=2_147_483_646)]
WorkbenchRequestKey = Annotated[str, Field(min_length=1, max_length=160)]


def _workbench_error_result(error: Exception) -> CallToolResult:
    """Translate Workbench failures into stable MCP error results."""

    if isinstance(error, WorkbenchValidationError):
        payload: dict[str, object] = {
            "code": error.code,
            "diagnostics": list(error.diagnostics),
        }
    elif isinstance(error, WorkbenchConflictError):
        payload = {"code": error.code, "currentRevision": error.current_revision}
    elif isinstance(error, WorkbenchIdempotencyError):
        payload = {"code": error.code, "requestKey": error.request_key}
    elif isinstance(
        error,
        (PermissionDeniedError, WorkbenchPermissionError, WorkbenchNotFoundError, WorkbenchError),
    ):
        payload = {"code": error.code}
    else:
        payload = {"code": "invalid_workbench_input"}
    return CallToolResult(
        content=[TextContent(text=json.dumps(payload, ensure_ascii=False))],
        structured_content=None,
        is_error=True,
    )


def _map_workbench_errors(function):
    """Preserve the tool's closed SDK schema while mapping adapter/domain failures."""

    @wraps(function)
    async def mapped(*args, **kwargs):
        try:
            return await function(*args, **kwargs)
        except (ValueError, TypeError, PermissionDeniedError, WorkbenchError) as error:
            return _workbench_error_result(error)

    return mapped


def _close_workbench_input_schemas(server: MCPServer) -> None:
    """Make Workbench argument models reject fields not declared by their tools."""

    manager = server._tool_manager
    for name in (
        "workbench_archive",
        "workbench_create",
        "workbench_draft_read",
        "workbench_draft_save",
        "workbench_list",
        "workbench_publish",
        "workbench_release_list",
        "workbench_release_read",
        "workbench_restore",
    ):
        tool = manager.get_tool(name)
        if tool is None:  # pragma: no cover - registration is local and unconditional
            raise RuntimeError(f"Workbench tool was not registered: {name}")
        argument_model = tool.fn_metadata.arg_model
        model_config = dict(argument_model.model_config)
        model_config["extra"] = "forbid"
        strict_model = type(
            f"Strict{argument_model.__name__}",
            (argument_model,),
            {"model_config": model_config},
        )
        tool.fn_metadata.arg_model = strict_model
        tool.parameters = strict_model.model_json_schema(by_alias=True)


def _identity(required_scope: str) -> Principal:
    token = get_access_token()
    if (
        token is None
        or (
            required_scope not in token.scopes
            and required_scope.replace(":", ".") not in token_permissions(token.scopes)
        )
        or token.subject is None
    ):
        raise PermissionDeniedError("mcp_scope_required", f"MCP scope required: {required_scope}")
    claims = token.claims or {}
    return Principal(
        UUID(token.subject),
        str(claims.get("email", "service@agent-factory.invalid")),
        str(claims.get("display_name", "MCP client")),
        bool(claims.get("is_platform_admin", False)),
    )


def _same_identifier(value: str, bound: object) -> bool:
    """Compare UUID text forms (hex or dashed, any case) instead of raw strings."""

    try:
        return UUID(value) == UUID(str(bound))
    except ValueError:
        return False


def _resolve_scope(organization_id: str | None, workspace_id: str | None):
    token = get_access_token()
    claims = token.claims if token else {}
    claims = claims or {}
    bound_workspace = claims.get("workspace_id")
    bound_organization = claims.get("organization_id")
    if bound_workspace:
        if (workspace_id is not None and not _same_identifier(workspace_id, bound_workspace)) or (
            organization_id is not None
            and not _same_identifier(organization_id, bound_organization)
        ):
            raise PermissionDeniedError(
                "workspace_token_mismatch", "Token belongs to another Workspace"
            )
        return bound_organization, bound_workspace
    if not organization_id:
        raise PermissionDeniedError("workspace_scope_required", "Workspace scope is required")
    return organization_id, workspace_id


async def _authorized_session(
    organization_id: str,
    workspace_id: str,
    token_scope: str,
    permission: str,
):
    organization_id, workspace_id = _resolve_scope(organization_id, workspace_id)
    if not workspace_id:
        raise PermissionDeniedError("workspace_scope_required", "Workspace scope is required")
    principal = _identity(permission.replace(".", ":"))
    session = get_session_factory()()
    scope = AuthorizationScope(UUID(organization_id), UUID(workspace_id))
    try:
        context = await compose_authorization(session).authorize(
            principal, scope, permission
        )
        permitted = context.permissions & token_permissions(get_access_token().scopes)
        if permission not in permitted:
            raise PermissionDeniedError("mcp_scope_required", f"MCP scope required: {permission}")
        context = AuthorizedContext(principal, scope, permitted)
        install_tenant_context(
            session,
            TenantContext(
                context.principal.user_id,
                context.scope.organization_id,
                context.scope.workspace_id,
                context.principal.is_platform_admin,
            ),
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
    async def workspace_list(organization_id: str | None = None) -> list[dict[str, object]]:
        organization_id, bound_workspace = _resolve_scope(organization_id, None)
        principal = _identity("workspace:read")
        async with get_session_factory()() as session:
            scope = AuthorizationScope(
                UUID(organization_id), UUID(bound_workspace) if bound_workspace else None
            )
            context = await compose_authorization(session).authorize(
                principal, scope, "workspace.read" if bound_workspace else "organization.read"
            )
            service = workspace_use_cases(session)
            rows = [await service.get(context)] if bound_workspace else await service.list(context)
            return [_model(row) for row in rows]

    @server.tool(name="document_list", description="List Workspace Documents")
    async def document_list(
        organization_id: str | None = None,
        workspace_id: str | None = None,
        document_type: str | None = None,
    ) -> list[dict[str, object]]:
        session, context = await _authorized_session(
            organization_id, workspace_id, "document:read", "document.read"
        )
        async with session:
            rows = await document_queries(session).list(context, document_type)
            return [_model(row) for row in rows]

    @server.tool(name="agent_list", description="List versioned Agent definitions")
    async def agent_list(
        organization_id: str | None = None, workspace_id: str | None = None
    ) -> list[dict[str, object]]:
        session, context = await _authorized_session(
            organization_id, workspace_id, "agent:read", "agent.read"
        )
        async with session:
            rows = await agent_queries(session).list(context)
            return [_model(row) for row in rows]

    @server.tool(name="schedule_list", description="List Workspace schedules")
    async def schedule_list(
        organization_id: str | None = None, workspace_id: str | None = None
    ) -> list[dict[str, object]]:
        session, context = await _authorized_session(
            organization_id, workspace_id, "schedule:read", "schedule.read"
        )
        async with session:
            rows = await schedule_queries(session).list(context)
            return [_model(row) for row in rows]

    @server.tool(name="integration_list", description="List external integration connections")
    async def integration_list(
        organization_id: str | None = None, workspace_id: str | None = None
    ) -> list[dict[str, object]]:
        session, context = await _authorized_session(
            organization_id, workspace_id, "integration:read", "integration.read"
        )
        async with session:
            rows = await connection_queries(session).list(context)
            return [_model(row) for row in rows]

    @server.tool(name="log_list", description="List durable Workspace job logs")
    async def log_list(
        organization_id: str | None = None, workspace_id: str | None = None
    ) -> list[dict[str, object]]:
        session, context = await _authorized_session(
            organization_id, workspace_id, "logs:read", "audit.read"
        )
        async with session:
            rows = await schedule_queries(session).logs(context)
            return [_model(row) for row in rows]

    @server.tool(name="test_status", description="Report the Workspace verification interface")
    async def test_status(
        organization_id: str | None = None, workspace_id: str | None = None
    ) -> dict[str, object]:
        session, _ = await _authorized_session(
            organization_id, workspace_id, "tests:read", "test.read"
        )
        await session.close()
        return {"status": "unavailable", "execution": "not_implemented", "activity": "tests"}

    @server.tool(
        name="workbench_list",
        description="List customer Workbench definitions without draft content",
    )
    @_map_workbench_errors
    async def workbench_list(
        organization_id: WorkbenchIdentifier | None = None,
        workspace_id: WorkbenchIdentifier | None = None,
        include_archived: bool = False,
    ) -> dict[str, object]:
        session, context = await _authorized_session(
            organization_id, workspace_id, "workbench:read", "workbench.read"
        )
        async with session:
            actor = WorkbenchActor(
                context.principal.user_id,
                context.scope.organization_id,
                context.scope.workspace_id,
                context.permissions,
            )  # type: ignore[arg-type]
            service = build_workbench_service(session, source="mcp")
            rows = await service.list_definitions.execute(actor, include_archived=include_archived)
            return {"items": [present_definition(row) for row in rows]}

    @server.tool(
        name="workbench_draft_read",
        description="Read a validated unpublished Workbench draft with preview authority",
    )
    @_map_workbench_errors
    async def workbench_draft_read(
        definition_id: WorkbenchIdentifier,
        organization_id: WorkbenchIdentifier | None = None,
        workspace_id: WorkbenchIdentifier | None = None,
    ) -> dict[str, object]:
        session, context = await _authorized_session(
            organization_id, workspace_id, "workbench:preview", "workbench.preview"
        )
        async with session:
            actor = WorkbenchActor(
                context.principal.user_id,
                context.scope.organization_id,
                context.scope.workspace_id,
                context.permissions,
            )  # type: ignore[arg-type]
            row = await build_workbench_service(session, source="mcp").get_definition.execute(
                actor, UUID(definition_id), preview=True
            )
            return present_definition(row, include_draft=True)

    @server.tool(name="workbench_create", description="Create a validated customer Workbench draft")
    @_map_workbench_errors
    async def workbench_create(
        key: WorkbenchKey,
        title: WorkbenchTitle,
        definition: dict[str, object],
        organization_id: WorkbenchIdentifier | None = None,
        workspace_id: WorkbenchIdentifier | None = None,
    ) -> dict[str, object]:
        session, context = await _authorized_session(
            organization_id, workspace_id, "workbench:edit", "workbench.create"
        )
        async with session:
            actor = WorkbenchActor(
                context.principal.user_id,
                context.scope.organization_id,
                context.scope.workspace_id,
                context.permissions,
            )  # type: ignore[arg-type]
            row = await build_workbench_service(session, source="mcp").create.execute(
                actor, key=key, title=title, definition=definition
            )
            return present_definition(row, include_draft=True)

    @server.tool(
        name="workbench_draft_save",
        description="Save a Workbench draft using optimistic revision control",
    )
    @_map_workbench_errors
    async def workbench_draft_save(
        definition_id: WorkbenchIdentifier,
        title: WorkbenchTitle,
        definition: dict[str, object],
        expected_revision: WorkbenchRevision,
        organization_id: WorkbenchIdentifier | None = None,
        workspace_id: WorkbenchIdentifier | None = None,
    ) -> dict[str, object]:
        session, context = await _authorized_session(
            organization_id, workspace_id, "workbench:edit", "workbench.update"
        )
        async with session:
            actor = WorkbenchActor(
                context.principal.user_id,
                context.scope.organization_id,
                context.scope.workspace_id,
                context.permissions,
            )  # type: ignore[arg-type]
            row = await build_workbench_service(session, source="mcp").update.execute(
                actor,
                UUID(definition_id),
                title=title,
                definition=definition,
                expected_revision=expected_revision,
            )
            return present_definition(row, include_draft=True)

    @server.tool(
        name="workbench_publish",
        description="Publish an immutable validated Workbench release idempotently",
    )
    @_map_workbench_errors
    async def workbench_publish(
        definition_id: WorkbenchIdentifier,
        expected_revision: WorkbenchRevision,
        request_key: WorkbenchRequestKey,
        organization_id: WorkbenchIdentifier | None = None,
        workspace_id: WorkbenchIdentifier | None = None,
    ) -> dict[str, object]:
        session, context = await _authorized_session(
            organization_id, workspace_id, "workbench:publish", "workbench.publish"
        )
        async with session:
            actor = WorkbenchActor(
                context.principal.user_id,
                context.scope.organization_id,
                context.scope.workspace_id,
                context.permissions,
            )  # type: ignore[arg-type]
            release = await build_workbench_service(session, source="mcp").publish.execute(
                actor,
                UUID(definition_id),
                expected_revision=expected_revision,
                request_key=request_key,
            )
            return present_release(release)

    @server.tool(
        name="workbench_archive",
        description="Archive a retained Workbench definition using optimistic revision control",
    )
    @_map_workbench_errors
    async def workbench_archive(
        definition_id: WorkbenchIdentifier,
        expected_revision: WorkbenchRevision,
        organization_id: WorkbenchIdentifier | None = None,
        workspace_id: WorkbenchIdentifier | None = None,
    ) -> dict[str, object]:
        session, context = await _authorized_session(
            organization_id, workspace_id, "workbench:edit", "workbench.archive"
        )
        async with session:
            actor = WorkbenchActor(
                context.principal.user_id,
                context.scope.organization_id,
                context.scope.workspace_id,
                context.permissions,
            )  # type: ignore[arg-type]
            row = await build_workbench_service(session, source="mcp").archive.execute(
                actor, UUID(definition_id), archived=True, expected_revision=expected_revision
            )
            return present_definition(row)

    @server.tool(
        name="workbench_restore",
        description="Restore an archived Workbench definition using optimistic revision control",
    )
    @_map_workbench_errors
    async def workbench_restore(
        definition_id: WorkbenchIdentifier,
        expected_revision: WorkbenchRevision,
        organization_id: WorkbenchIdentifier | None = None,
        workspace_id: WorkbenchIdentifier | None = None,
    ) -> dict[str, object]:
        session, context = await _authorized_session(
            organization_id, workspace_id, "workbench:edit", "workbench.restore"
        )
        async with session:
            actor = WorkbenchActor(
                context.principal.user_id,
                context.scope.organization_id,
                context.scope.workspace_id,
                context.permissions,
            )  # type: ignore[arg-type]
            row = await build_workbench_service(session, source="mcp").archive.execute(
                actor, UUID(definition_id), archived=False, expected_revision=expected_revision
            )
            return present_definition(row)

    @server.tool(
        name="workbench_release_list",
        description="List immutable releases for a Workbench definition",
    )
    @_map_workbench_errors
    async def workbench_release_list(
        definition_id: WorkbenchIdentifier,
        organization_id: WorkbenchIdentifier | None = None,
        workspace_id: WorkbenchIdentifier | None = None,
    ) -> dict[str, object]:
        session, context = await _authorized_session(
            organization_id, workspace_id, "workbench:read", "workbench.read"
        )
        async with session:
            actor = WorkbenchActor(
                context.principal.user_id,
                context.scope.organization_id,
                context.scope.workspace_id,
                context.permissions,
            )  # type: ignore[arg-type]
            releases = await build_workbench_service(session, source="mcp").list_releases.execute(
                actor, UUID(definition_id)
            )
            return {"items": [present_release(row) for row in releases]}

    @server.tool(
        name="workbench_release_read", description="Read one immutable published Workbench release"
    )
    @_map_workbench_errors
    async def workbench_release_read(
        release_id: WorkbenchIdentifier,
        organization_id: WorkbenchIdentifier | None = None,
        workspace_id: WorkbenchIdentifier | None = None,
    ) -> dict[str, object]:
        session, context = await _authorized_session(
            organization_id, workspace_id, "workbench:read", "workbench.read"
        )
        async with session:
            actor = WorkbenchActor(
                context.principal.user_id,
                context.scope.organization_id,
                context.scope.workspace_id,
                context.permissions,
            )  # type: ignore[arg-type]
            release = await build_workbench_service(session, source="mcp").get_release.execute(
                actor, UUID(release_id)
            )
            return present_release(release)

    @server.tool(
        name="agent_run_submit",
        description="Create an idempotent Agent run and return its durable asynchronous Job",
    )
    async def agent_run_submit(
        agent_definition_id: str,
        idempotency_key: str,
        input_payload: dict[str, object],
        agent_version_id: str | None = None,
        organization_id: str | None = None,
        workspace_id: str | None = None,
    ) -> dict[str, object]:
        session, context = await _authorized_session(
            organization_id, workspace_id, "agent:execute", "agent.execute"
        )
        async with session:
            from api.composition.agent_execution import executable_agents

            run = await executable_agents(session).submit(
                context,
                UUID(agent_definition_id),
                version_id=UUID(agent_version_id) if agent_version_id else None,
                idempotency_key=idempotency_key,
                input_payload=input_payload,
            )
            job = await schedule_queries(session).agent_job(context, run.id)
            if job is None:
                raise RuntimeError("Agent run Job was not staged")
            return {
                "agent_run_id": str(run.id),
                "job_id": str(job["id"]),
                "status": job["status"],
            }

    from api.mcp.documents import install_documents
    from api.mcp.integrations import install_integrations
    from api.mcp.planning import install_planning
    from api.mcp.reporting import install_reporting

    install_documents(server, _authorized_session)
    install_integrations(server, _authorized_session)
    install_planning(server, _authorized_session)
    install_reporting(server, _authorized_session)
    _close_workbench_input_schemas(server)
    return server


def _resource_reader(activity: str, description: str):
    async def read() -> str:
        return f"{activity}: {description}"

    return read


def _model(record: object) -> dict[str, object]:
    from dataclasses import fields, is_dataclass
    from typing import Any, cast

    from collections.abc import Iterable, Mapping

    values: Iterable[tuple[str, Any]]
    if isinstance(record, Mapping):
        values = record.items()
    elif is_dataclass(record):
        values = ((field.name, getattr(record, field.name)) for field in fields(cast(Any, record)))
    else:
        raise TypeError("MCP presenters require a domain value or explicit read projection")
    result: dict[str, object] = {}
    for key, value in values:
        if isinstance(value, UUID):
            value = str(value)
        elif hasattr(value, "isoformat"):
            value = value.isoformat()
        elif hasattr(value, "value"):
            value = value.value
        result[key] = value
    return result
