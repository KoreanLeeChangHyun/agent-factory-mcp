import type { WorkbenchDefinition } from "@agent-factory/contracts";

export interface DefinitionRecord {
  id: string;
  key: string;
  title: string;
  state: "draft" | "archived";
  revision: number;
  latestReleaseId: string | null;
  definition: WorkbenchDefinition;
}
export interface ReleaseRecord {
  id: string;
  definitionId: string;
  definitionRevision: number;
  releaseNumber: number;
  definitionDigest: string;
  definition: WorkbenchDefinition;
  publishedAt: string;
}
export interface DefinitionIndex {
  items: Omit<DefinitionRecord, "definition">[];
  permissions: string[];
}

const csrf = () =>
  document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("agent_factory_csrf="))
    ?.split("=")
    .slice(1)
    .join("=") ?? "";

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(options.method && options.method !== "GET" ? { "X-CSRF-Token": decodeURIComponent(csrf()) } : {}),
      ...options.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as { detail?: { code?: string; diagnostics?: string[] } };
  if (!response.ok) {
    const error = new Error(body.detail?.diagnostics?.join("\n") || body.detail?.code || `HTTP ${response.status}`);
    Object.assign(error, { status: response.status, body });
    throw error;
  }
  return body as T;
}

const base = (workspaceId: string) => `/api/workspaces/${encodeURIComponent(workspaceId)}/workbenches`;
const scopeHeaders = (organizationId: string) => ({ "X-Organization-ID": organizationId });
export const workbenchClient = {
  list: (organizationId: string, workspaceId: string, signal?: AbortSignal) =>
    request<DefinitionIndex>(base(workspaceId), { headers: scopeHeaders(organizationId), signal }),
  draft: (organizationId: string, workspaceId: string, definitionId: string, signal?: AbortSignal) =>
    request<DefinitionRecord>(`${base(workspaceId)}/${definitionId}/draft`, {
      headers: scopeHeaders(organizationId),
      signal,
    }),
  save: (
    organizationId: string,
    workspaceId: string,
    record: DefinitionRecord,
    definition: WorkbenchDefinition,
    signal?: AbortSignal,
  ) =>
    request<DefinitionRecord>(`${base(workspaceId)}/${record.id}/draft`, {
      method: "PUT",
      headers: scopeHeaders(organizationId),
      body: JSON.stringify({ title: record.title, expectedRevision: record.revision, definition }),
      signal,
    }),
  publish: (
    organizationId: string,
    workspaceId: string,
    record: DefinitionRecord,
    requestKey: string,
    signal?: AbortSignal,
  ) =>
    request<ReleaseRecord>(`${base(workspaceId)}/${record.id}/publish`, {
      method: "POST",
      headers: scopeHeaders(organizationId),
      body: JSON.stringify({ expectedRevision: record.revision, requestKey }),
      signal,
    }),
  release: (organizationId: string, workspaceId: string, releaseId: string, signal?: AbortSignal) =>
    request<ReleaseRecord>(`${base(workspaceId)}/releases/${releaseId}`, {
      headers: scopeHeaders(organizationId),
      signal,
    }),
};
