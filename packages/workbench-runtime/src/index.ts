import { validate, type WorkbenchDefinition } from "@agent-factory/contracts";
import { catalogHas } from "@agent-factory/design-system";

const structuralAssets = new Set([
  "flat-list@1",
  "group-list@1",
  "tree@1",
  "search-list@1",
  "filter-list@1",
  "detail-list@1",
  "detail@1",
  "list-detail@1",
  "collection@1",
  "settings@1",
  "dashboard@1",
  "document@1",
  "split@1",
  "timeline@1",
  "kanban@1",
]);

export type WorkbenchSummary = { id: string; title: string; sidebar: string; panel: string; componentCount: number };

export function interpretWorkbench(value: unknown): WorkbenchDefinition {
  validate(value);
  const definition = value as WorkbenchDefinition;
  const ids = [
    definition.descriptor.icon,
    ...definition.sidebar.components.map((component) => component.asset),
    ...definition.panel.components.map((component) => component.asset),
  ];
  const unknown = ids.filter((id) => !catalogHas(id));
  if (
    !structuralAssets.has(definition.sidebar.asset) ||
    !structuralAssets.has(definition.panel.asset) ||
    unknown.length
  ) {
    throw new Error(`definition references unregistered assets: ${unknown.join(", ")}`);
  }
  return definition;
}

export function summarizeWorkbench(value: unknown): WorkbenchSummary {
  const definition = interpretWorkbench(value);
  return {
    id: definition.descriptor.id,
    title: definition.descriptor.title,
    sidebar: definition.sidebar.label ?? definition.sidebar.asset,
    panel: definition.panel.label ?? definition.panel.asset,
    componentCount: definition.sidebar.components.length + definition.panel.components.length,
  };
}
