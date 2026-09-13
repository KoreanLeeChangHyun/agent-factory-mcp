import { apiRequest } from "../../api-client.js";

export interface ConnectionRecord {
  id: string;
  name: string;
  state: string;
  reason?: "revoked" | "expired" | null;
  short_id?: string;
  last_seen_at?: string | null;
  client_name?: string | null;
  expires_at?: string;
  retrievable?: boolean;
}
export interface MCPConnectionStatus {
  state: "pending" | "verified" | "reauth_required";
  connections: ConnectionRecord[];
}

const json = (value: unknown): RequestInit => ({ body: JSON.stringify(value) });
export const mcpConnectionClient = {
  connections: (organizationId: string, workspaceId: string, signal?: AbortSignal) =>
    apiRequest<MCPConnectionStatus>(`/api/organizations/${organizationId}/workspaces/${workspaceId}/mcp-connections`, {
      signal,
    }),
  createConnection: (organizationId: string, workspaceId: string, name: string) =>
    apiRequest<ConnectionRecord & { token: string }>(
      `/api/organizations/${organizationId}/workspaces/${workspaceId}/mcp-connections`,
      { method: "POST", ...json({ name }) },
    ),
  revealConnection: (organizationId: string, workspaceId: string, id: string) =>
    apiRequest<{ token: string }>(
      `/api/organizations/${organizationId}/workspaces/${workspaceId}/mcp-connections/${id}/secret`,
      { method: "POST" },
    ),
  revokeConnection: (organizationId: string, workspaceId: string, id: string, purge = false) =>
    apiRequest<void>(
      `/api/organizations/${organizationId}/workspaces/${workspaceId}/mcp-connections/${id}${purge ? "/purge" : ""}`,
      { method: "DELETE" },
    ),
};
