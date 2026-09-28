import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { documentsFixture, type WorkbenchDefinition } from "@agent-factory/contracts";
import { ActionDispatcher } from "../../../packages/workbench-runtime/src/actions.js";
import { WorkbenchRegistry } from "../../../packages/workbench-runtime/src/registry.js";
import { WorkbenchRenderer } from "../../../packages/workbench-runtime/src/renderer.js";
import { diagnoseWorkbench, validateParameterValues } from "../../../packages/workbench-runtime/src/validation.js";
import {
  defaultViewState,
  readViewState,
  viewStateKey,
  writeViewState,
} from "../../../packages/workbench-runtime/src/view-state.js";

const scope = { userId: "u", organizationId: "o", workspaceId: "w", workbenchId: "documents", releaseId: "r1" };

describe("runtime contracts", () => {
  it("accepts the shipped resource-header refresh association", () => {
    expect(diagnoseWorkbench(documentsFixture)).toEqual([]);
  });
  it("shares one registry while preventing standard/customer replacement", () => {
    const registry = new WorkbenchRegistry();
    registry.registerStandard(documentsFixture);
    expect(() => registry.registerCustomer(documentsFixture, "release-2")).toThrow(/standard/);
  });

  it("returns visible diagnostics for unknown IDs and unsafe definitions", () => {
    const unknown = structuredClone(documentsFixture) as WorkbenchDefinition;
    unknown.panel.components[0]!.asset = "future-component@1";
    expect(diagnoseWorkbench(unknown)).toContainEqual(expect.objectContaining({ code: "unknown-asset" }));
    const html = renderToStaticMarkup(
      <WorkbenchRenderer
        definition={unknown}
        client={{ execute: async () => ({}) }}
        operations={[]}
        scope={scope}
        state={{}}
      />,
    );
    expect(html).toContain("구성을 표시할 수 없습니다");
    const unsafe = structuredClone(documentsFixture) as WorkbenchDefinition;
    unsafe.panel.components[0]!.props = { content: "https://unsafe.test" };
    expect(diagnoseWorkbench(unsafe)[0]?.code).toBe("schema");
  });

  it("rejects undeclared actions and bounds duplicate submission", async () => {
    const dispatcher = new ActionDispatcher(documentsFixture);
    const environment = {
      scope,
      getScope: () => scope,
      setState: vi.fn(),
      refresh: vi.fn(async () => undefined),
      submit: vi.fn(async () => undefined),
      navigate: vi.fn(),
      dismiss: vi.fn(),
    };
    await expect(dispatcher.dispatch("missing", {}, environment)).rejects.toThrow(/선언되지 않은/);
    await dispatcher.dispatch("select-document", { selectedId: "doc-one" }, environment);
    expect(environment.setState).toHaveBeenCalledWith("selection.documentId", "doc-one");

    const withSubmit = structuredClone(documentsFixture) as WorkbenchDefinition;
    withSubmit.actions.push({ id: "save-document", kind: "submit", payloadBinding: "document" });
    let finish: () => void = () => undefined;
    const submit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = () => resolve();
        }),
    );
    const submitDispatcher = new ActionDispatcher(withSubmit);
    const first = submitDispatcher.dispatch("save-document", { value: "draft" }, { ...environment, submit });
    await expect(
      submitDispatcher.dispatch("save-document", { value: "duplicate" }, { ...environment, submit }),
    ).rejects.toThrow(/이미 처리 중/);
    finish();
    await first;
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("dispatches dismissal and rejects failures or scope changes", async () => {
    const definition = structuredClone(documentsFixture) as WorkbenchDefinition;
    definition.actions.push({ id: "close-preview", kind: "dismiss", target: "previewDialog" });
    const dispatcher = new ActionDispatcher(definition);
    const current = { ...scope };
    const environment = {
      scope,
      getScope: () => current,
      setState: vi.fn(),
      refresh: vi.fn(async () => undefined),
      submit: vi.fn(async () => undefined),
      navigate: vi.fn(),
      dismiss: vi.fn(async () => undefined),
    };
    await dispatcher.dispatch("close-preview", {}, environment);
    expect(environment.dismiss).toHaveBeenCalledWith("previewDialog");
    environment.dismiss.mockRejectedValueOnce(new Error("host rejected dismissal"));
    await expect(dispatcher.dispatch("close-preview", {}, environment)).rejects.toThrow(/host rejected/);
    current.workspaceId = "changed";
    await expect(dispatcher.dispatch("close-preview", {}, environment)).rejects.toThrow(/컨텍스트/);
  });

  it("rejects dismiss definitions without a target at the schema boundary", () => {
    const definition = structuredClone(documentsFixture) as WorkbenchDefinition;
    definition.actions.push({ id: "close-preview", kind: "dismiss" });
    expect(diagnoseWorkbench(definition)[0]?.code).toBe("schema");
  });

  it("composes caller components inside ordered layout slots", () => {
    const html = renderToStaticMarkup(
      <WorkbenchRenderer
        definition={documentsFixture}
        client={{ execute: async () => ({}) }}
        operations={[]}
        scope={scope}
        state={{}}
        selection="overview"
        expanded={[]}
      />,
    );
    expect(html).toMatch(
      /data-layout-id="document@1"[\s\S]*data-slot="header"[\s\S]*data-component-id="document-header"/,
    );
    expect(html).toMatch(
      /data-component-id="document-header"[\s\S]*data-slot="content"[\s\S]*data-component-id="document-content"/,
    );
  });

  it("preserves representative layout semantics and exact nested slots", () => {
    const renderPanel = (
      asset: WorkbenchDefinition["panel"]["asset"],
      components: WorkbenchDefinition["panel"]["components"],
    ) => {
      const definition = structuredClone(documentsFixture) as WorkbenchDefinition;
      definition.panel = { asset, components };
      return renderToStaticMarkup(
        <WorkbenchRenderer
          definition={definition}
          client={{ execute: async () => ({}) }}
          operations={[]}
          scope={scope}
          state={{}}
        />,
      );
    };
    const detail = renderPanel("detail@1", [
      { id: "head", asset: "resource-header@1", slot: "header", state: "ready" },
      { id: "body", asset: "markdown@1", slot: "content", state: "ready" },
    ]);
    expect(detail).toMatch(/af-layout-detail[\s\S]*<header[\s\S]*data-component-id="head"/);
    expect(detail).toContain("적용");
    const listDetail = renderPanel("list-detail@1", [
      { id: "list", asset: "resource-table@1", slot: "list", state: "ready" },
      { id: "detail", asset: "markdown@1", slot: "detail", state: "ready" },
    ]);
    expect(listDetail).toMatch(
      /af-layout-list-detail[\s\S]*<nav[\s\S]*data-component-id="list"[\s\S]*<article[\s\S]*data-component-id="detail"/,
    );
    const split = renderPanel("split@1", [
      { id: "primary", asset: "markdown@1", slot: "primary", state: "ready" },
      { id: "secondary", asset: "json@1", slot: "secondary", state: "ready" },
    ]);
    expect(split).toMatch(/data-component-id="primary"[\s\S]*role="separator"[\s\S]*data-component-id="secondary"/);
    const nested = renderPanel("detail@1", [
      { id: "field", asset: "field@1", slot: "content", state: "ready" },
      { id: "control", asset: "text-input@1", slot: "control", parentId: "field", state: "ready" },
      { id: "tabs", asset: "tabs@1", slot: "content", state: "ready" },
      { id: "tab-content", asset: "markdown@1", slot: "content", parentId: "tabs", state: "ready" },
    ]);
    expect(nested).toMatch(/data-component-id="field"[\s\S]*af-field[\s\S]*data-component-id="control"/);
    expect(nested).toMatch(/data-component-id="tabs"[\s\S]*af-tabs-composition[\s\S]*data-component-id="tab-content"/);
    expect(nested.match(/data-component-id="control"/g)).toHaveLength(1);
    expect(nested.match(/data-component-id="tab-content"/g)).toHaveLength(1);
  });

  it("rejects invalid slots, structural insertion, and cyclic trees", () => {
    const invalid = structuredClone(documentsFixture) as WorkbenchDefinition;
    invalid.panel.components[0]!.slot = "list";
    invalid.panel.components[0]!.asset = "detail@1";
    invalid.panel.components[0]!.parentId = "document-content";
    invalid.panel.components[1]!.parentId = "document-header";
    expect(diagnoseWorkbench(invalid)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "structural-asset" }),
        expect.objectContaining({ code: "component-cycle" }),
      ]),
    );
  });

  it("rejects every unsafe string class inside record-list fields", () => {
    const unsafeValues = [
      "https://attacker.invalid",
      "ftp://attacker.invalid",
      "ws://attacker.invalid",
      "//attacker.invalid",
      "www.attacker.invalid",
      "${globalThis.fetch()}",
      "<script>alert(1)</script>",
      "body{display:none}",
      "<svg onload=alert(1)>",
      "Bearer secret",
      "access_token=secret",
      "Authorization: Bearer secret",
    ];
    const parameter = [
      {
        name: "records",
        type: "record-list" as const,
        required: true,
        items: {
          type: "object" as const,
          additionalProperties: false as const,
          required: ["label"],
          properties: { label: { type: "string" as const, maxLength: 2048 } },
        },
      },
    ];
    for (const value of unsafeValues) {
      expect(validateParameterValues({ records: [{ label: value }] }, parameter)).toContainEqual(
        expect.objectContaining({ code: "unsafe-string" }),
      );
      const definition = structuredClone(documentsFixture) as WorkbenchDefinition;
      definition.panel.components[1]!.props = { content: [{ label: value }] };
      expect(diagnoseWorkbench(definition)[0]?.code).toBe("schema");
    }
  });

  it("recovers malformed and stale persisted IDs and isolates releases", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
    const state = { ...defaultViewState("documents"), selection: "removed", expanded: ["kept", "removed"] };
    writeViewState(storage, scope, state);
    expect(readViewState(storage, scope, new Set(["kept"]))).toMatchObject({ selection: null, expanded: ["kept"] });
    const releaseTwo = { ...scope, releaseId: "r2" };
    expect(viewStateKey(releaseTwo)).not.toBe(viewStateKey(scope));
    for (const name of ["userId", "organizationId", "workspaceId", "workbenchId"] as const)
      expect(viewStateKey({ ...scope, [name]: `${scope[name]}-other` })).not.toBe(viewStateKey(scope));
    values.set(viewStateKey(releaseTwo), "not-json");
    expect(readViewState(storage, releaseTwo, new Set())).toEqual(defaultViewState("documents"));
    const complete = {
      ...defaultViewState("documents"),
      sidebarOpen: false,
      sidebarWidth: 420,
      selection: "kept",
      expanded: ["kept"],
    };
    writeViewState(storage, scope, complete);
    expect(readViewState(storage, scope, new Set(["kept"]))).toEqual(complete);
  });
});
