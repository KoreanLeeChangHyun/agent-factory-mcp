// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { documentsFixture, type WorkbenchDefinition } from "@agent-factory/contracts";
import { WorkbenchRenderer } from "../../../packages/workbench-runtime/src/renderer.js";
import type {
  ActionEnvironment,
  BindingClient,
  BindingOperation,
  RuntimeRecord,
  RuntimeScope,
} from "../../../packages/workbench-runtime/src/index.js";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const scope: RuntimeScope = {
  userId: "user",
  organizationId: "organization",
  workspaceId: "workspace",
  workbenchId: "documents",
  releaseId: "release",
};
const mounted: { root: ReturnType<typeof createRoot>; host: HTMLElement }[] = [];
afterEach(() => {
  for (const view of mounted.splice(0))
    act(() => {
      view.root.unmount();
      view.host.remove();
    });
});
const definitionFor = (asset: WorkbenchDefinition["panel"]["asset"]): WorkbenchDefinition => {
  const definition = structuredClone(documentsFixture) as WorkbenchDefinition;
  definition.sidebar.components[0]!.binding = undefined;
  definition.sidebar.components[0]!.actions = [];
  definition.panel = {
    asset,
    actions: [],
    components:
      asset === "split@1"
        ? [
            { id: "primary", asset: "markdown@1", slot: "primary", state: "ready" },
            { id: "secondary", asset: "json@1", slot: "secondary", state: "ready" },
          ]
        : [{ id: "content", asset: "markdown@1", slot: "content", state: "ready" }],
  };
  definition.bindings = [];
  definition.actions = [];
  return definition;
};
const environment = (overrides: Partial<ActionEnvironment> = {}): ActionEnvironment => ({
  scope,
  getScope: () => scope,
  setState: vi.fn(),
  refresh: vi.fn(async () => undefined),
  submit: vi.fn(async () => undefined),
  navigate: vi.fn(),
  dismiss: vi.fn(),
  ...overrides,
});
const mountRenderer = (
  definition: WorkbenchDefinition,
  actionEnvironment: ActionEnvironment,
  client: BindingClient = { execute: async () => ({}) },
  operations: readonly BindingOperation[] = [],
) => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  mounted.push({ root, host });
  act(() =>
    root.render(
      <WorkbenchRenderer
        definition={definition}
        client={client}
        operations={operations}
        scope={scope}
        state={{}}
        actionEnvironment={actionEnvironment}
      />,
    ),
  );
  return host;
};

describe("renderer actions", () => {
  it.each(["detail@1", "settings@1"] as const)("dispatches %s layout submit", async (asset) => {
    const definition = definitionFor(asset);
    definition.bindings.push({ id: "payload", source: "payload@1", inputMappings: [] });
    definition.actions.push({ id: "save", kind: "submit", payloadBinding: "payload" });
    definition.panel.actions = ["save"];
    const actions = environment();
    const host = mountRenderer(definition, actions);
    const button = Array.from(host.querySelectorAll("button")).find((item) => item.textContent === "적용")!;
    await act(async () => button.click());
    expect(actions.submit).toHaveBeenCalledWith("payload", {});
  });

  it("dispatches split toggle to the declared state target", async () => {
    const definition = definitionFor("split@1");
    definition.actions.push({ id: "resize", kind: "toggle", target: "layout.split" });
    definition.panel.actions = ["resize"];
    const actions = environment();
    const host = mountRenderer(definition, actions);
    const separator = host.querySelector<HTMLElement>(".af-splitter[role='separator']")!;
    await act(async () => separator.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
    expect(actions.setState).toHaveBeenCalledWith("layout.split", 50);
    separator.setPointerCapture = vi.fn();
    separator.parentElement!.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 200,
      height: 100,
      right: 200,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    await act(async () => {
      separator.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 100 }));
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 120 }));
      window.dispatchEvent(new MouseEvent("pointerup"));
    });
    expect(actions.setState).toHaveBeenCalledTimes(2);
    expect(actions.setState).toHaveBeenLastCalledWith("layout.split", 60);
  });

  it("refreshes through BindingRuntime, rejects duplicates, and recovers after failure", async () => {
    const definition = definitionFor("document@1");
    definition.bindings = [{ id: "header", source: "header@1", inputMappings: [], cacheSeconds: 60 }];
    definition.actions = [{ id: "refresh", kind: "refresh", target: "header" }];
    definition.panel.components = [
      { id: "header", asset: "resource-header@1", slot: "header", binding: "header", actions: ["refresh"] },
    ];
    const operation: BindingOperation = {
      id: "header@1",
      inputs: [],
      outputs: [{ name: "title", type: "string", required: true, maxLength: 80 }],
    };
    let calls = 0;
    let resolveRefresh: ((value: RuntimeRecord) => void) | undefined;
    const client: BindingClient = {
      execute: async () => {
        calls += 1;
        if (calls === 1) return { title: "initial" };
        return new Promise<RuntimeRecord>((resolve) => {
          resolveRefresh = resolve;
        });
      },
    };
    const hostActions = environment();
    const host = mountRenderer(definition, hostActions, client, [operation]);
    await act(async () => Promise.resolve());
    const refresh = Array.from(host.querySelectorAll("button")).find((item) => item.textContent === "새로고침")!;
    await act(async () => {
      refresh.click();
      refresh.click();
      await Promise.resolve();
    });
    expect(host.textContent).toContain("이미 처리 중");
    expect(hostActions.refresh).not.toHaveBeenCalled();
    await act(async () => resolveRefresh?.({ title: "refreshed" }));
    expect(host.textContent).toContain("refreshed");
  });

  it("surfaces scope changes and host failures, then permits recovery", async () => {
    const definition = definitionFor("detail@1");
    definition.bindings.push({ id: "payload", source: "payload@1", inputMappings: [] });
    definition.actions.push({ id: "save", kind: "submit", payloadBinding: "payload" });
    definition.panel.actions = ["save"];
    let current = scope;
    let submissions = 0;
    const submit = vi.fn(async () => {
      submissions += 1;
      if (submissions === 1) throw new Error("host failure");
    });
    const actions = environment({ getScope: () => current, submit });
    const host = mountRenderer(definition, actions);
    const button = Array.from(host.querySelectorAll("button")).find((item) => item.textContent === "적용")!;
    await act(async () => button.click());
    expect(host.textContent).toContain("host failure");
    await act(async () => button.click());
    expect(submit).toHaveBeenCalledTimes(2);
    current = { ...scope, workspaceId: "changed" };
    await act(async () => button.click());
    expect(host.textContent).toContain("컨텍스트가 변경");
  });
});
