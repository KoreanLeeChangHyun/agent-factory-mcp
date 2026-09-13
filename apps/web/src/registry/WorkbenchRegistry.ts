import { documentsFixture, type WorkbenchDefinition } from "@agent-factory/contracts";
import { WorkbenchRegistry as RuntimeRegistry, type WorkbenchRegistration } from "@agent-factory/workbench-runtime";
import { apiRequest } from "../api-client.js";

interface PublishedProjection {
  items: {
    descriptor: { id: string; title: string; icon: string };
    release: { id: string; definition: WorkbenchDefinition };
  }[];
}
export type NativeStandard =
  | "organization"
  | "workspaces"
  | "schedule"
  | "agents"
  | "documents"
  | "reporting"
  | "connections"
  | "account"
  | "administration";
export interface RegisteredWorkbench extends Partial<WorkbenchRegistration> {
  id: string;
  title: string;
  icon: string;
  origin: "standard" | "customer";
  releaseId: string;
  native?: NativeStandard;
  definition?: WorkbenchDefinition;
}
export const nativeStandards: readonly RegisteredWorkbench[] = [
  {
    id: "organization",
    title: "조직",
    icon: "database@1",
    origin: "standard",
    releaseId: "standard:organization@1",
    native: "organization",
  },
  {
    id: "workspaces",
    title: "작업공간",
    icon: "workspace@1",
    origin: "standard",
    releaseId: "standard:workspaces@1",
    native: "workspaces",
  },
  {
    id: "schedule",
    title: "일정",
    icon: "calendar@1",
    origin: "standard",
    releaseId: "standard:schedule@1",
    native: "schedule",
  },
  {
    id: "agents",
    title: "에이전트",
    icon: "agents@1",
    origin: "standard",
    releaseId: "standard:agents@1",
    native: "agents",
  },
  {
    id: "documents",
    title: "문서",
    icon: "documents@1",
    origin: "standard",
    releaseId: "standard:documents@1",
    native: "documents",
    definition: documentsFixture,
  },
  {
    id: "reporting",
    title: "보고",
    icon: "logs@1",
    origin: "standard",
    releaseId: "standard:reporting@1",
    native: "reporting",
  },
  {
    id: "connections",
    title: "연동",
    icon: "connections@1",
    origin: "standard",
    releaseId: "standard:connections@1",
    native: "connections",
  },
  {
    id: "account",
    title: "계정",
    icon: "account@1",
    origin: "standard",
    releaseId: "standard:account@1",
    native: "account",
  },
  {
    id: "administration",
    title: "관리자",
    icon: "admin@1",
    origin: "standard",
    releaseId: "standard:administration@1",
    native: "administration",
  },
];
export const reservedStandardIds = new Set(nativeStandards.map((item) => item.id));

export async function loadAuthorizedRegistry(
  organizationId: string,
  workspaceId: string,
  signal: AbortSignal,
  platformAdmin = false,
): Promise<RegisteredWorkbench[]> {
  const registry = new RuntimeRegistry();
  registry.registerStandard(documentsFixture, "standard:documents@1");
  const projection = await apiRequest<PublishedProjection>(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/workbenches/published`,
    { headers: { "X-Organization-ID": organizationId }, signal },
  );
  for (const item of projection.items) {
    if (reservedStandardIds.has(item.descriptor.id) || reservedStandardIds.has(item.release.definition.descriptor.id))
      continue;
    registry.registerCustomer(item.release.definition, item.release.id);
  }
  const customers: RegisteredWorkbench[] = registry
    .list()
    .filter((entry) => entry.origin === "customer")
    .map((entry) => ({
      ...entry,
      id: entry.definition.descriptor.id,
      title: entry.definition.descriptor.title,
      icon: entry.definition.descriptor.icon,
    }));
  return [...nativeStandards.filter((item) => item.native !== "administration" || platformAdmin), ...customers];
}
