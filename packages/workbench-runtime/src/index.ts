import { catalogHas, instantiateAsset } from "@agent-factory/design-system";

export * from "./actions.js";
export * from "./bindings.js";
export * from "./contracts.js";
export * from "./registry.js";
export * from "./renderer.js";
export * from "./validation.js";
export * from "./view-state.js";

export function renderRegisteredAsset(id: string, properties: Record<string, unknown> = {}) {
  if (!catalogHas(id)) throw new Error(`asset is not declared in the catalog: ${id}`);
  return instantiateAsset(id, properties);
}
