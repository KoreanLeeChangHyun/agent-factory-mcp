import type { Action, WorkbenchDefinition } from "@agent-factory/contracts";
import type { RuntimeRecord, RuntimeScope, RuntimeValue } from "./contracts.js";

export interface ActionEnvironment {
  scope: RuntimeScope;
  getScope(): RuntimeScope;
  setState(path: string, value: RuntimeValue): void;
  refresh(bindingId: string): Promise<void>;
  submit(bindingId: string, payload: RuntimeRecord): Promise<void>;
  navigate(destinationId: string): void;
  dismiss(destinationId: string): void | Promise<void>;
}

export class ActionRegistry {
  readonly #actions: Map<string, Action>;
  readonly #pending = new Set<string>();
  constructor(definition: WorkbenchDefinition) {
    this.#actions = new Map(definition.actions.map((action) => [action.id, action]));
  }
  #scopeChanged(environment: ActionEnvironment): boolean {
    const currentScope = environment.getScope();
    return Object.keys(environment.scope).some(
      (name) => currentScope[name as keyof RuntimeScope] !== environment.scope[name as keyof RuntimeScope],
    );
  }
  async dispatch(actionId: string, output: RuntimeRecord, environment: ActionEnvironment): Promise<void> {
    const action = this.#actions.get(actionId);
    if (!action) throw new Error(`선언되지 않은 action ${actionId}입니다.`);
    if (this.#pending.has(actionId)) throw new Error(`${actionId} 동작이 이미 처리 중입니다.`);
    if (this.#scopeChanged(environment)) throw new Error("Workbench 컨텍스트가 변경되었습니다.");
    this.#pending.add(actionId);
    try {
      if (action.kind === "select" || action.kind === "toggle") {
        if (!action.target) throw new Error(`${action.kind} action에 상태 대상이 없습니다.`);
        const value = output.selectedId ?? output.value;
        if (value === undefined) throw new Error("선택 값이 없습니다.");
        environment.setState(action.target, value);
      } else if (action.kind === "refresh") {
        if (!action.target) throw new Error("refresh action에 binding 대상이 없습니다.");
        await environment.refresh(action.target);
      } else if (action.kind === "submit") {
        if (!action.payloadBinding) throw new Error("submit action에 payload binding이 없습니다.");
        await environment.submit(action.payloadBinding, output);
      } else if (action.kind === "navigate-internal") {
        if (!action.target || !/^[a-z][a-zA-Z0-9.]{0,127}$/.test(action.target))
          throw new Error("내부 destination ID가 유효하지 않습니다.");
        environment.navigate(action.target);
      } else if (action.kind === "dismiss") {
        if (!action.target) throw new Error("dismiss action에 대상이 없습니다.");
        await environment.dismiss(action.target);
      }
      if (this.#scopeChanged(environment)) throw new Error("동작 중 Workbench 컨텍스트가 변경되었습니다.");
    } finally {
      this.#pending.delete(actionId);
    }
  }
}

export { ActionRegistry as ActionDispatcher };
