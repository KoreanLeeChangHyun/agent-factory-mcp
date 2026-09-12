import type { WorkbenchDefinition } from "@agent-factory/contracts";
import type { WorkbenchRegistration } from "./contracts.js";
import { interpretWorkbench } from "./validation.js";

export class WorkbenchRegistry {
  readonly #entries = new Map<string, WorkbenchRegistration>();
  register(definition: unknown, origin: WorkbenchRegistration["origin"], releaseId: string): WorkbenchRegistration {
    const validated = interpretWorkbench(definition);
    const existing = this.#entries.get(validated.descriptor.id);
    if (existing && existing.origin !== origin)
      throw new Error(`Workbench ${validated.descriptor.id} is already registered by ${existing.origin}`);
    const entry = { definition: validated, origin, releaseId } satisfies WorkbenchRegistration;
    this.#entries.set(validated.descriptor.id, entry);
    return entry;
  }
  registerStandard(definition: unknown, releaseId = "standard"): WorkbenchRegistration {
    return this.register(definition, "standard", releaseId);
  }
  registerCustomer(definition: unknown, releaseId: string): WorkbenchRegistration {
    return this.register(definition, "customer", releaseId);
  }
  get(id: string): WorkbenchRegistration | undefined {
    return this.#entries.get(id);
  }
  list(): readonly WorkbenchRegistration[] {
    return [...this.#entries.values()];
  }
}

export type WorkbenchSummary = { id: string; title: string; sidebar: string; panel: string; componentCount: number };
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
export function cloneDefinition(definition: WorkbenchDefinition): WorkbenchDefinition {
  return structuredClone(definition);
}
