import { apiRequest } from "../../api-client.js";
import { apiPath } from "../../api-path.js";
import { csrfToken } from "../../api-client.js";
export interface Provider {
  id: string;
  key: string;
  display_name: string;
  auth_type: string;
  capabilities: string[];
}
export interface ProviderConnection {
  id: string;
  provider_id: string;
  name: string;
  status: string;
  credentials_present: boolean;
  last_error_code: string | null;
}
export interface OAuthStart {
  authorization_url: string;
  expires_at: string;
  requested_scopes: string[];
}
export interface MCPConnection {
  id: string;
  name: string;
  state: string;
  retrievable: boolean;
  expires_at: string | null;
  client_name: string | null;
  reason: string | null;
}
export interface MCPConnectionStatus {
  state: "pending" | "verified" | "reauth_required";
  connections: MCPConnection[];
}
export interface MCPInstructions {
  filename: string;
  instructions: string;
}
export interface ProviderInspection {
  health: string;
  account_id: string | null;
  requested_scopes: string[];
  granted_scopes: string[] | null;
  scope_support: string;
  observed_at: string;
  stale: boolean;
  error_code: string | null;
}
export interface DriveSource {
  source_id: string;
  name: string;
  mime_type: string;
  parent_ids: string[];
  modified_at: string | null;
}
export interface DriveSourcePage {
  items: DriveSource[];
  cursor: string | null;
}
const root = (organizationId: string, workspaceId: string) =>
  `/api/organizations/${organizationId}/workspaces/${workspaceId}`;
export const providerClient = {
  catalog: (organizationId: string, workspaceId: string, signal?: AbortSignal) =>
    apiRequest<Provider[]>(`${root(organizationId, workspaceId)}/providers`, { signal }),
  connections: (organizationId: string, workspaceId: string, signal?: AbortSignal) =>
    apiRequest<ProviderConnection[]>(`${root(organizationId, workspaceId)}/provider-connections`, { signal }),
  setToken: (organizationId: string, workspaceId: string, connectionId: string, token: string) =>
    apiRequest(`${root(organizationId, workspaceId)}/provider-connections/${connectionId}/token`, {
      method: "PUT",
      body: JSON.stringify({ token, approved_scopes: [] }),
    }),
  beginOAuth: (organizationId: string, workspaceId: string, connectionId: string, scopes: string[]) =>
    apiRequest<OAuthStart>(`${root(organizationId, workspaceId)}/provider-connections/${connectionId}/oauth/start`, {
      method: "POST",
      body: JSON.stringify({ scopes }),
    }),
  inspect: (organizationId: string, workspaceId: string, connectionId: string, live = false) =>
    apiRequest<ProviderInspection>(
      `${root(organizationId, workspaceId)}/provider-connections/${connectionId}/inspect?live=${live}`,
    ),
  driveSources: (organizationId: string, workspaceId: string, connectionId: string, folderId: string) =>
    apiRequest<DriveSourcePage>(
      `${root(organizationId, workspaceId)}/provider-connections/${connectionId}/drive-sources?folder_id=${encodeURIComponent(folderId)}`,
    ),
  createReferenceCollection: (
    organizationId: string,
    workspaceId: string,
    connectionId: string,
    name: string,
    folderId: string,
  ) =>
    apiRequest(`${root(organizationId, workspaceId)}/provider-collections`, {
      method: "POST",
      body: JSON.stringify({
        connection_id: connectionId,
        name,
        mode: "reference",
        selection: {
          folder_id: folderId,
          recursive: true,
          max_items: 1000,
          max_pages: 100,
          max_bytes: 50000000,
          attachments: false,
        },
      }),
    }),
  mcpConnections: (organizationId: string, workspaceId: string, signal?: AbortSignal) =>
    apiRequest<MCPConnectionStatus>(`${root(organizationId, workspaceId)}/mcp-connections`, { signal }),
  issueMcp: (organizationId: string, workspaceId: string, name: string) =>
    apiRequest<{ connection: MCPConnection; token: string }>(`${root(organizationId, workspaceId)}/mcp-connections`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  mcpInstructions: (organizationId: string, workspaceId: string, connectionId: string) =>
    apiRequest<MCPInstructions>(`${root(organizationId, workspaceId)}/mcp-connections/${connectionId}/instructions`),
  mcpConfiguration: async (organizationId: string, workspaceId: string, connectionId: string) => {
    const response = await fetch(
      apiPath(`${root(organizationId, workspaceId)}/mcp-connections/${connectionId}/configuration`),
      { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "X-CSRF-Token": csrfToken() } },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.blob();
  },
  revokeMcp: (organizationId: string, workspaceId: string, connectionId: string) =>
    apiRequest<void>(`${root(organizationId, workspaceId)}/mcp-connections/${connectionId}`, { method: "DELETE" }),
  purgeMcp: (organizationId: string, workspaceId: string, connectionId: string) =>
    apiRequest<void>(`${root(organizationId, workspaceId)}/mcp-connections/${connectionId}/purge`, {
      method: "DELETE",
    }),
};
