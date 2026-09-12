import { apiBlob, apiRequest } from "../../api-client.js";

export type DocumentType = "original" | "processed" | "specification";
export interface DocumentRecord {
  id: string;
  workspace_id: string;
  document_type: DocumentType;
  title: string;
  slug: string;
  status: "active" | "archived";
  document_metadata: Record<string, unknown>;
  current_revision_number: number;
  revision: number;
  created_at: string;
  updated_at: string;
}
export interface DocumentRevision {
  id: string;
  document_id: string;
  revision_number: number;
  filename: string;
  media_type: string;
  size_bytes: number;
  sha256: string;
  created_at: string;
}

const base = (organizationId: string, workspaceId: string) =>
  `/api/organizations/${encodeURIComponent(organizationId)}/workspaces/${encodeURIComponent(workspaceId)}/documents`;

export const documentClient = {
  list: (organizationId: string, workspaceId: string, signal?: AbortSignal) =>
    apiRequest<DocumentRecord[]>(base(organizationId, workspaceId), { signal }),
  get: (organizationId: string, workspaceId: string, documentId: string, signal?: AbortSignal) =>
    apiRequest<DocumentRecord>(`${base(organizationId, workspaceId)}/${documentId}`, { signal }),
  create: (
    organizationId: string,
    workspaceId: string,
    value: { title: string; slug: string; document_type: DocumentType; metadata: Record<string, unknown> },
    signal?: AbortSignal,
  ) =>
    apiRequest<DocumentRecord>(base(organizationId, workspaceId), {
      method: "POST",
      body: JSON.stringify(value),
      signal,
    }),
  update: (organizationId: string, workspaceId: string, record: DocumentRecord, title: string, signal?: AbortSignal) =>
    apiRequest<DocumentRecord>(`${base(organizationId, workspaceId)}/${record.id}`, {
      method: "PUT",
      body: JSON.stringify({
        title,
        status: record.status,
        metadata: record.document_metadata,
        revision: record.revision,
      }),
      signal,
    }),
  revisions: (organizationId: string, workspaceId: string, documentId: string, signal?: AbortSignal) =>
    apiRequest<DocumentRevision[]>(`${base(organizationId, workspaceId)}/${documentId}/revisions`, { signal }),
  content: (organizationId: string, workspaceId: string, documentId: string, revision: number, signal?: AbortSignal) =>
    apiBlob(`${base(organizationId, workspaceId)}/${documentId}/revisions/${revision}/content`, signal),
  addTextRevision: (
    organizationId: string,
    workspaceId: string,
    documentId: string,
    filename: string,
    mediaType: string,
    content: string,
    signal?: AbortSignal,
  ) => {
    const form = new FormData();
    form.append("file", new Blob([content], { type: mediaType }), filename);
    return apiRequest<DocumentRevision>(`${base(organizationId, workspaceId)}/${documentId}/revisions`, {
      method: "POST",
      body: form,
      signal,
    });
  },
  packagePreview: (organizationId: string, workspaceId: string, documentId: string, revision: number) =>
    `/api/organizations/${encodeURIComponent(organizationId)}/workspaces/${encodeURIComponent(workspaceId)}/cloud-documents/${documentId}/revisions/${revision}/package/preview`,
};
