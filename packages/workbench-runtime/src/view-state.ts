import { validate, type ViewState } from "@agent-factory/contracts";
import type { RuntimeScope } from "./contracts.js";

export type ViewStateScope = RuntimeScope;
const prefix = "agent-factory.workbench-view-state.v1";
const maxStoredScopes = 32;
export function viewStateKey(scope: ViewStateScope): string {
  return [prefix, scope.userId, scope.organizationId, scope.workspaceId, scope.workbenchId, scope.releaseId]
    .map(encodeURIComponent)
    .join(":");
}
export function defaultViewState(workbenchId: string): ViewState {
  return {
    version: 1,
    selectedWorkbench: workbenchId,
    sidebarOpen: true,
    sidebarWidth: 268,
    selection: null,
    expanded: [],
  };
}
export function readViewState(
  storage: Pick<Storage, "getItem" | "removeItem">,
  scope: ViewStateScope,
  validIds: ReadonlySet<string>,
): ViewState {
  const key = viewStateKey(scope);
  try {
    const raw = storage.getItem(key);
    if (!raw) return defaultViewState(scope.workbenchId);
    const candidate = JSON.parse(raw) as ViewState;
    validate(candidate, "schemas/workbench/v1/view-state.schema.json");
    if (candidate.selectedWorkbench !== scope.workbenchId) throw new Error("wrong Workbench scope");
    candidate.selection = candidate.selection && validIds.has(candidate.selection) ? candidate.selection : null;
    candidate.expanded = candidate.expanded.filter((id) => validIds.has(id));
    return candidate;
  } catch {
    storage.removeItem(key);
    return defaultViewState(scope.workbenchId);
  }
}
export function writeViewState(storage: Pick<Storage, "setItem">, scope: ViewStateScope, state: ViewState): void {
  try {
    validate(state, "schemas/workbench/v1/view-state.schema.json");
    const currentKey = viewStateKey(scope);
    storage.setItem(currentKey, JSON.stringify(state));
    const enumerable = storage as Pick<Storage, "setItem"> & Partial<Pick<Storage, "length" | "key" | "removeItem">>;
    const length = enumerable.length;
    const keyAt = enumerable.key?.bind(enumerable);
    const remove = enumerable.removeItem?.bind(enumerable);
    if (typeof length === "number" && keyAt && remove) {
      const owned: string[] = [];
      for (let index = 0; index < length; index += 1) {
        const key = keyAt(index);
        if (key?.startsWith(`${prefix}:`) && key !== currentKey) owned.push(key);
      }
      for (const key of owned.slice(0, Math.max(0, owned.length - maxStoredScopes + 1))) remove(key);
    }
  } catch {
    // Browser storage is an optimization and never blocks the runtime path.
  }
}
