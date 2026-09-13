import { apiBlob, apiRequest } from "../../api-client.js";

export interface WorkspaceRecord {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  status: string;
  revision: number;
  created_at: string;
  updated_at: string;
}
export interface WorkspaceGroup {
  id: string;
  name: string;
  collapsed: boolean;
  revision: number;
  workspace_ids: string[];
}
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
export interface OrganizationMemberRecord {
  user_id: string;
  email: string;
  name: string;
  role_id: string;
  role_name: string;
  status: string;
  joined_at: string;
}
export interface OrganizationTeamRecord {
  id: string;
  name: string;
  description: string;
  members: string[];
  workspaces: { workspace_id: string; role_id: string }[];
}
export interface OrganizationWorkspaceOptionRecord {
  id: string;
  name: string;
  permissions?: string[];
}
export interface OrganizationOverview {
  id: string;
  name: string;
  slug: string;
  revision: number;
  is_personal: boolean;
  is_owner?: boolean;
  permissions: string[];
  [key: string]: unknown;
}

const json = (value: unknown): RequestInit => ({ body: JSON.stringify(value) });
export const managementClient = {
  workspaces: (organizationId: string, signal?: AbortSignal) =>
    apiRequest<WorkspaceRecord[]>(`/api/organizations/${organizationId}/workspaces`, { signal }),
  recent: (organizationId: string, signal?: AbortSignal) =>
    apiRequest<WorkspaceRecord[]>(`/api/organizations/${organizationId}/workspaces/recent`, { signal }),
  createWorkspace: (organizationId: string, input: { name: string; slug: string }, personal: boolean) =>
    apiRequest<WorkspaceRecord>(
      personal ? "/api/account/personal-workspaces" : `/api/organizations/${organizationId}/workspaces`,
      { method: "POST", ...json(input) },
    ),
  updateWorkspace: (organizationId: string, workspaceId: string, input: { name: string; revision: number }) =>
    apiRequest<WorkspaceRecord>(`/api/organizations/${organizationId}/workspaces/${workspaceId}`, {
      method: "PUT",
      ...json(input),
    }),
  deactivateWorkspace: (organizationId: string, workspaceId: string) =>
    apiRequest<void>(`/api/organizations/${organizationId}/workspaces/${workspaceId}`, { method: "DELETE" }),
  visit: (organizationId: string, workspaceId: string) =>
    apiRequest<void>(`/api/organizations/${organizationId}/workspaces/${workspaceId}/visits`, { method: "POST" }),
  groups: (organizationId: string, signal?: AbortSignal) =>
    apiRequest<WorkspaceGroup[]>(`/api/organizations/${organizationId}/workspaces/groups`, { signal }),
  createGroup: (organizationId: string, name: string) =>
    apiRequest<WorkspaceGroup>(`/api/organizations/${organizationId}/workspaces/groups`, {
      method: "POST",
      ...json({ name }),
    }),
  updateGroup: (organizationId: string, group: WorkspaceGroup, update: { name?: string; collapsed?: boolean }) =>
    apiRequest<WorkspaceGroup>(`/api/organizations/${organizationId}/workspaces/groups/${group.id}`, {
      method: "PATCH",
      ...json({ revision: group.revision, ...update }),
    }),
  assignGroup: (organizationId: string, workspaceId: string, groupId: string | null) =>
    apiRequest<void>(
      groupId
        ? `/api/organizations/${organizationId}/workspaces/groups/${groupId}/workspaces/${workspaceId}`
        : `/api/organizations/${organizationId}/workspaces/groups/workspaces/${workspaceId}`,
      { method: groupId ? "PUT" : "DELETE" },
    ),
  workspaceResource: <T>(organizationId: string, workspaceId: string, suffix: string, signal?: AbortSignal) =>
    apiRequest<T>(`/api/organizations/${organizationId}/workspaces/${workspaceId}/${suffix}`, { signal }),
  mutateWorkspaceResource: <T>(
    organizationId: string,
    workspaceId: string,
    suffix: string,
    method: string,
    input?: unknown,
  ) =>
    apiRequest<T>(`/api/organizations/${organizationId}/workspaces/${workspaceId}/${suffix}`, {
      method,
      ...(input === undefined ? {} : json(input)),
    }),
  organization: (organizationId: string, signal?: AbortSignal) =>
    apiRequest<OrganizationOverview>(`/api/organizations/${organizationId}`, { signal }),
  createOrganization: (input: { name: string; slug: string }) =>
    apiRequest<{ id: string; name: string; slug: string }>("/api/organizations", { method: "POST", ...json(input) }),
  organizationResource: <T>(organizationId: string, suffix: string, signal?: AbortSignal) =>
    apiRequest<T>(`/api/organizations/${organizationId}/${suffix}`, { signal }),
  mutateOrganization: <T>(
    organizationId: string,
    suffix: string,
    method: string,
    input?: unknown,
    signal?: AbortSignal,
  ) =>
    apiRequest<T>(`/api/organizations/${organizationId}${suffix ? `/${suffix}` : ""}`, {
      method,
      signal,
      ...(input === undefined ? {} : json(input)),
    }),
  connections: (organizationId: string, workspaceId: string, signal?: AbortSignal) =>
    apiRequest<{ connections?: ConnectionRecord[] } | ConnectionRecord[]>(
      `/api/organizations/${organizationId}/workspaces/${workspaceId}/mcp-connections`,
      { signal },
    ),
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
  sessions: (signal?: AbortSignal) => apiRequest<Record<string, unknown>[]>("/api/auth/sessions", { signal }),
  tokens: (signal?: AbortSignal) => apiRequest<Record<string, unknown>[]>("/api/auth/tokens", { signal }),
  revokeSession: (id: string) => apiRequest<void>(`/api/auth/sessions/${id}`, { method: "DELETE" }),
  revokeToken: (id: string) => apiRequest<void>(`/api/auth/tokens/${id}`, { method: "DELETE" }),
  logout: () => apiRequest<void>("/api/auth/logout", { method: "POST" }),
  admin: <T>(suffix: string, signal?: AbortSignal) => apiRequest<T>(`/api/admin/${suffix}`, { signal }),
  mutateAdmin: <T>(suffix: string, method: string, input?: unknown) =>
    apiRequest<T>(`/api/admin/${suffix}`, { method, ...(input === undefined ? {} : json(input)) }),
  catalog: () => apiBlob("/admin/assets/"),
};
