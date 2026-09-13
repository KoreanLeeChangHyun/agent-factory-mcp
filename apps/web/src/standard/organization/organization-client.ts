import { apiRequest } from "../../api-client.js";
import type { OrganizationSummary } from "./organization-types.js";

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
export const organizationClient = {
  listForAccount: (signal?: AbortSignal) => apiRequest<OrganizationSummary[]>("/api/account/organizations", { signal }),
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
};
