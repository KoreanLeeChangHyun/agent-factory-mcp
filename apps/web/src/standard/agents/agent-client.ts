import { apiRequest } from "../../api-client.js";

export interface AgentDefinition {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: string;
  revision: number;
}
export interface AgentRun {
  id: string;
  definition_id: string;
  version_id: string;
  status: string;
  created_at: string | null;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  error_code: string | null;
  error_message: string | null;
}
export interface AgentRunEvidence {
  run: AgentRun;
  events: { id: string; sequence: number; event_type: string; payload: Record<string, unknown>; created_at: string }[];
  tool_calls: { id: string; tool_name: string; status: string; error_message: string | null }[];
  artifacts: { id: string; kind: string; storage_key: string | null; metadata: Record<string, unknown> }[];
  documents: { id: string; document_id: string; relation: string; document_title: string }[];
}
const root = (organizationId: string, workspaceId: string) =>
  `/api/organizations/${organizationId}/workspaces/${workspaceId}`;

export const agentClient = {
  definitions: (organizationId: string, workspaceId: string, signal?: AbortSignal) =>
    apiRequest<AgentDefinition[]>(`${root(organizationId, workspaceId)}/agents`, { signal }),
  runs: (organizationId: string, workspaceId: string, signal?: AbortSignal) =>
    apiRequest<AgentRun[]>(`${root(organizationId, workspaceId)}/agent-runs`, { signal }),
  evidence: (organizationId: string, workspaceId: string, runId: string, signal?: AbortSignal) =>
    apiRequest<AgentRunEvidence>(`${root(organizationId, workspaceId)}/agent-runs/${runId}/evidence`, {
      signal,
      cache: "no-store",
    }),
  cancel: (organizationId: string, workspaceId: string, runId: string) =>
    apiRequest<AgentRun>(`${root(organizationId, workspaceId)}/agent-runs/${runId}/cancel`, { method: "POST" }),
  retry: (organizationId: string, workspaceId: string, runId: string) =>
    apiRequest<AgentRun>(`${root(organizationId, workspaceId)}/agent-runs/${runId}/retry`, { method: "POST" }),
};
