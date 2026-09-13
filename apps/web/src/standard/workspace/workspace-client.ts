import { apiRequest } from "../../api-client.js";

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

const json = (value: unknown): RequestInit => ({ body: JSON.stringify(value) });
export const workspaceClient = {
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
};
