"""Install bounded cloud gathering tools into the authenticated MCP server."""

import json
from typing import Annotated
from uuid import UUID

from mcp_types import CallToolResult, TextContent
from pydantic import ValidationError

from app.common.errors import ApplicationError
from app.modules.integration.cloud_factory import cloud_services
from app.modules.integration.cloud_guide import GUIDE
from app.modules.integration.cloud_http import ProviderError
from app.modules.integration.cloud_schemas import CollectionCreate


def result(payload, error=False):
    return CallToolResult(content=[TextContent(text=json.dumps(payload))],
                          structured_content=None if error else payload, is_error=error)


def install_integrations(server, authorize):
    async def invoke(organization_id, workspace_id, write, operation, permission=None):
        try:
            session, context = await authorize(organization_id, workspace_id,
                                                'integration:manage' if write else 'integration:read',
                                                permission or ('integration.use' if write else 'integration.read'))
            async with session:
                async with cloud_services(session, context) as service:
                    return result(await operation(service))
        except ApplicationError as exc:
            return result({'code': exc.code, 'message': exc.message}, True)
        except ProviderError as exc:
            return result({'code': exc.code, 'retryable': exc.retryable, 'retry_after': exc.retry_after}, True)
        except (ValueError, ValidationError):
            return result({'code': 'invalid_integration_input'}, True)
        except Exception:
            # Never return provider bodies, signed URLs, request headers, or secrets.
            return result({'code': 'integration_operation_failed'}, True)

    @server.resource('agent-factory://integrations/guide', name='cloud-integrations-guide')
    async def guide() -> str:
        return GUIDE

    @server.tool(name='integration_inspect', description='Inspect cloud connection metadata. live=true calls provider health API; no collection is executed.')
    async def inspect(connection_id: str, live: bool = False, organization_id: str | None = None,
                      workspace_id: str | None = None) -> Annotated[CallToolResult, dict]:
        return await invoke(organization_id, workspace_id, live,
                            lambda service: service.connections.inspect(UUID(connection_id), live=live))

    @server.tool(name='integration_token_set', description='Encrypt an explicitly approved Slack, Notion, or Discord API token server-side. Never verifies live access. Use a trusted secret entry surface; tool arguments may be logged by clients.')
    async def token_set(connection_id: str, token: str, approved_scopes: list[str],
                        organization_id: str | None = None, workspace_id: str | None = None) -> Annotated[CallToolResult, dict]:
        return await invoke(organization_id, workspace_id, True,
                            lambda service: service.connections.set_token(UUID(connection_id), token, approved_scopes), permission="integration.update")

    @server.tool(name='integration_oauth_begin', description='Prepare provider web OAuth consent URL for an existing connection and exactly approved scopes. Cloud callback and client secrets must be configured server-side.')
    async def oauth_begin(connection_id: str, scopes: list[str], organization_id: str | None = None,
                          workspace_id: str | None = None) -> Annotated[CallToolResult, dict]:
        return await invoke(organization_id, workspace_id, True,
                            lambda service: service.connections.begin(UUID(connection_id), scopes), permission="integration.update")

    @server.tool(name='integration_oauth_complete', description='Exchange a provider authorization code for encrypted server-side credentials. Requires the same authenticated workspace user who began consent; state is single-use.')
    async def oauth_complete(state: str, code: str, organization_id: str | None = None,
                             workspace_id: str | None = None) -> Annotated[CallToolResult, dict]:
        return await invoke(organization_id, workspace_id, True,
                            lambda service: service.connections.complete(state, code), permission="integration.update")

    @server.tool(name='collection_list', description='List bounded cloud collection configurations in the authorized workspace.')
    async def collection_list(organization_id: str | None = None, workspace_id: str | None = None) -> Annotated[CallToolResult, dict]:
        return await invoke(organization_id, workspace_id, False, lambda service: service.list())

    @server.tool(name='collection_create', description='Create an immutable provider selection separate from its connection, resolving output to workspace Original Documents. Does not authorize or sync externally.')
    async def collection_create(request: CollectionCreate, organization_id: str | None = None,
                                workspace_id: str | None = None) -> Annotated[CallToolResult, dict]:
        return await invoke(organization_id, workspace_id, True, lambda service: service.create(request))

    @server.tool(name='collection_start', description='Enqueue an explicitly authorized bounded collection. Reuse request_key for retry idempotency; a new key starts a fresh bounded refresh without deleting Originals.')
    async def collection_start(collection_id: str, request_key: str, organization_id: str | None = None,
                               workspace_id: str | None = None) -> Annotated[CallToolResult, dict]:
        return await invoke(organization_id, workspace_id, True,
                            lambda service: service.start(UUID(collection_id), request_key))

    @server.tool(name='collection_status', description='Read durable collection run progress without exposing provider cursors or credentials.')
    async def collection_status(run_id: str, organization_id: str | None = None,
                                workspace_id: str | None = None) -> Annotated[CallToolResult, dict]:
        return await invoke(organization_id, workspace_id, False, lambda service: service.status(UUID(run_id)))

    @server.tool(name='collection_results', description='Read persisted Original Document IDs, revisions, hashes, and collection limitations.')
    async def collection_results(run_id: str, organization_id: str | None = None,
                                 workspace_id: str | None = None) -> Annotated[CallToolResult, dict]:
        return await invoke(organization_id, workspace_id, False,
                            lambda service: service.status(UUID(run_id), results=True))

    @server.tool(name='collection_cancel', description='Request cooperative cancellation between requests/chunks/persisted source units. Already gathered Originals are retained.')
    async def collection_cancel(run_id: str, organization_id: str | None = None,
                                workspace_id: str | None = None) -> Annotated[CallToolResult, dict]:
        return await invoke(organization_id, workspace_id, True, lambda service: service.cancel(UUID(run_id)))
