import { apiRequest } from "../../api-client.js";
export interface ReportTask {
  id: string;
  agent_id: string;
  name: string;
  status: string;
  progress: number | null;
  last_report_at: string | null;
  runtime_observation: { fact: string; observed_at: string } | null;
}
export interface ReportingSnapshot {
  agents: {
    id: string;
    parent_id: string | null;
    owner_user_id: string;
    name: string;
    role: string;
    responsibilities: string;
    last_report_at: string | null;
  }[];
  tasks: ReportTask[];
  truncated: boolean;
  server_time: string;
  stale_after_seconds: number;
}
export interface ReportingDetail {
  task: ReportTask & {
    description: string;
    parent_id: string | null;
    plan_item_id: string | null;
    started_at: string | null;
    finished_at: string | null;
  };
  reports: {
    id: string;
    revision: number;
    status: string;
    progress: number | null;
    message: string;
    received_at: string;
  }[];
  results: {
    id: string;
    report_id: string;
    label: string;
    summary: string;
    document_id: string | null;
    url: string | null;
  }[];
  next_before_revision: number | null;
  server_time: string;
  stale_after_seconds: number;
}
const root = (organizationId: string, workspaceId: string) =>
  `/api/organizations/${organizationId}/workspaces/${workspaceId}/reporting`;
export const reportingClient = {
  snapshot: (organizationId: string, workspaceId: string, signal?: AbortSignal) =>
    apiRequest<ReportingSnapshot>(root(organizationId, workspaceId), { signal, cache: "no-store" }),
  detail: (
    organizationId: string,
    workspaceId: string,
    taskId: string,
    signal?: AbortSignal,
    beforeRevision?: number,
  ) =>
    apiRequest<ReportingDetail>(
      `${root(organizationId, workspaceId)}/tasks/${taskId}${beforeRevision ? `?before_revision=${beforeRevision}` : ""}`,
      {
        signal,
        cache: "no-store",
      },
    ),
};
