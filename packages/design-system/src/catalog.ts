import type { AssetDescriptor, AssetKind } from "@agent-factory/contracts";

const states: AssetDescriptor["states"] = [
  "loading",
  "empty",
  "ready",
  "stale",
  "error",
  "permission-denied",
  "disabled",
];
const projectOwned = { source: "Agent Factory stage-1 reviewed catalog", license: "Project-owned" };

function assets(
  kind: AssetKind,
  region: AssetDescriptor["allowedRegions"][number],
  ids: string[],
  actions: AssetDescriptor["actions"],
): AssetDescriptor[] {
  const role = kind === "icon" ? "img" : kind === "sidebar" ? "navigation" : kind === "feedback" ? "status" : "region";
  return ids.map((id) => ({
    id: `${id}@1`,
    kind,
    allowedRegions: [region],
    states,
    actions,
    properties: [{ name: "label", type: "string", required: false, maxLength: 80 }],
    inputs: [],
    outputs: [],
    accessibility: { role, keyboard: "All interactive descendants use native controls and visible focus." },
    provenance: projectOwned,
    example: {},
  }));
}

export const assetCatalog: readonly AssetDescriptor[] = [
  ...assets(
    "icon",
    "task-list",
    ["documents", "workspace", "knowledge", "connections", "jobs", "audit", "calendar", "agents"],
    ["select"],
  ),
  ...assets(
    "sidebar",
    "sidebar",
    ["flat-list", "group-list", "tree", "search-list", "filter-list", "detail-list"],
    ["select", "refresh", "toggle"],
  ),
  ...assets("sidebar", "sidebar", ["resource-tree"], ["select", "refresh", "toggle"]),
  ...assets(
    "panel",
    "panel",
    ["detail", "list-detail", "collection", "settings", "dashboard", "document", "split", "timeline", "kanban"],
    ["select", "refresh", "submit"],
  ),
  ...assets("control", "panel", ["button", "field", "select", "dialog"], ["select", "submit", "dismiss"]),
  ...assets(
    "display",
    "panel",
    ["resource-header", "resource-table", "markdown", "code", "chart-frame"],
    ["select", "refresh"],
  ),
  ...assets("feedback", "panel", ["status", "toast", "empty-state", "error-state"], ["dismiss", "refresh"]),
];

export function catalogHas(id: string): boolean {
  return assetCatalog.some((asset) => asset.id === id);
}
