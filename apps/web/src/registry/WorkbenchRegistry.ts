import { documentsFixture, type WorkbenchDefinition } from "@agent-factory/contracts";
import { WorkbenchRegistry as RuntimeRegistry, type WorkbenchRegistration } from "@agent-factory/workbench-runtime";
import { apiRequest } from "../api-client.js";

interface PublishedProjection {
  items: {
    descriptor: { id: string; title: string; icon: string };
    release: { id: string; definition: WorkbenchDefinition };
  }[];
}

export interface RegisteredWorkbench extends WorkbenchRegistration {
  id: string;
  title: string;
  icon: string;
}

export async function loadAuthorizedRegistry(
  organizationId: string,
  workspaceId: string,
  signal: AbortSignal,
): Promise<RegisteredWorkbench[]> {
  const registry = new RuntimeRegistry();
  registry.registerStandard(documentsFixture, "standard:documents@1");
  const standardIds = new Set(registry.list().map((entry) => entry.definition.descriptor.id));
  const projection = await apiRequest<PublishedProjection>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/workbenches/published`,
    { headers: { "X-Organization-ID": organizationId }, signal },
  );
  for (const item of projection.items) {
    if (standardIds.has(item.descriptor.id) || standardIds.has(item.release.definition.descriptor.id)) continue;
    registry.registerCustomer(item.release.definition, item.release.id);
  }
  return registry.list().map((entry) => ({
    ...entry,
    id: entry.definition.descriptor.id,
    title: entry.definition.descriptor.title,
    icon: entry.definition.descriptor.icon,
  }));
}
