import { apiRequest } from "../../api-client.js";

export type PlanKind = "domain" | "feature" | "issue";
export type PlanStatus = "pending" | "active" | "done";
export interface PlanItem {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  kind: PlanKind;
  name: string;
  description: string;
  acceptance: string;
  assignee: string;
  status: PlanStatus;
  blocked_reason: string;
  start_date: string | null;
  target_date: string | null;
  revision: number;
  period_conflict?: boolean;
}
export interface PlanningDashboard {
  items: PlanItem[];
  can_edit: boolean;
  calendar: { country: "KR"; holidays: Record<string, string> };
  settings: { launch_date: string | null; revision: number };
}
export type PlanWrite = Omit<PlanItem, "id" | "workspace_id" | "revision" | "period_conflict"> & {
  expected_revision?: number;
};

const base = (organizationId: string, workspaceId: string) =>
  `/api/organizations/${encodeURIComponent(organizationId)}/workspaces/${encodeURIComponent(workspaceId)}/plan`;

export const scheduleClient = {
  read: (organizationId: string, workspaceId: string, signal?: AbortSignal) =>
    apiRequest<PlanningDashboard>(base(organizationId, workspaceId), { signal }),
  create: (organizationId: string, workspaceId: string, item: PlanWrite, signal?: AbortSignal) =>
    apiRequest<PlanItem>(`${base(organizationId, workspaceId)}/items`, {
      method: "POST",
      body: JSON.stringify(item),
      signal,
    }),
  update: (
    organizationId: string,
    workspaceId: string,
    item: PlanItem,
    patch: Partial<PlanWrite>,
    signal?: AbortSignal,
  ) =>
    apiRequest<PlanItem>(`${base(organizationId, workspaceId)}/items/${item.id}`, {
      method: "PUT",
      body: JSON.stringify({
        ...item,
        ...patch,
        id: undefined,
        workspace_id: undefined,
        period_conflict: undefined,
        revision: undefined,
        expected_revision: item.revision,
      }),
      signal,
    }),
  remove: (organizationId: string, workspaceId: string, item: PlanItem, signal?: AbortSignal) =>
    apiRequest<void>(`${base(organizationId, workspaceId)}/items/${item.id}?revision=${item.revision}`, {
      method: "DELETE",
      signal,
    }),
};
