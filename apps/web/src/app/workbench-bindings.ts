import { createDocumentBindingClient, documentOperations } from "../standard/documents/index.js";

export const workbenchOperations = documentOperations;
export function createWorkbenchBindingClient(organizationId: string | null, workspaceId: string | null) {
  return createDocumentBindingClient(organizationId, workspaceId);
}
