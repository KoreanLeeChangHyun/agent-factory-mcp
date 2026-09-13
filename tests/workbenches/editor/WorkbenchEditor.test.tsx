// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { documentsFixture } from "@agent-factory/contracts";
import { WorkbenchEditor } from "../../../packages/workbench-editor/src/WorkbenchEditor.js";
import { isInsertableAsset, propertyControlKind } from "../../../packages/workbench-editor/src/WorkbenchEditor.js";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const roots: { root: ReturnType<typeof createRoot>; host: HTMLElement }[] = [];
function setControlValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value")?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}
afterEach(() => {
  for (const view of roots.splice(0))
    act(() => {
      view.root.unmount();
      view.host.remove();
    });
});

describe("Workbench editor", () => {
  it("separates structural layouts from insertable components", () => {
    expect(isInsertableAsset("panel")).toBe(false);
    expect(isInsertableAsset("sidebar")).toBe(false);
    expect(isInsertableAsset("control")).toBe(true);
    expect(isInsertableAsset("display")).toBe(true);
  });

  it("maps every published property constraint class to a typed control", () => {
    const parameter = (
      type: "string" | "number" | "integer" | "boolean" | "string-list" | "record-list",
      extra = {},
    ) => ({ name: "value", type, required: true, ...extra });
    expect(propertyControlKind(parameter("string", { enum: ["a"] }))).toBe("enum");
    expect(propertyControlKind(parameter("boolean"))).toBe("boolean");
    expect(propertyControlKind(parameter("number"))).toBe("number");
    expect(propertyControlKind(parameter("integer"))).toBe("number");
    expect(propertyControlKind(parameter("string-list", { maxItems: 4 }))).toBe("list");
    expect(propertyControlKind(parameter("record-list", { maxItems: 4 }))).toBe("list");
    expect(propertyControlKind(parameter("string", { maxLength: 8 }))).toBe("string");
  });
  it("inserts by keyboard, preserves invalid imports, and round-trips the draft", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    roots.push({ root, host });
    await act(async () => {
      root.render(
        <WorkbenchEditor
          initialDefinition={documentsFixture}
          client={{ execute: async () => ({}) }}
          operations={[]}
          scope={{ userId: "u", organizationId: "o", workspaceId: "w", workbenchId: "documents", releaseId: "preview" }}
        />,
      );
      await Promise.resolve();
    });
    const search = host.querySelector<HTMLInputElement>('input[value=""]')!;
    act(() => {
      setControlValue(search, "button@1");
    });
    const matchingLabels = Array.from(
      host.querySelectorAll<HTMLButtonElement>('.af-authoring-palette-row button[aria-label$="패널에 추가"]'),
    ).map((button) => button.getAttribute("aria-label"));
    expect(matchingLabels).toEqual(expect.arrayContaining(["button@1 패널에 추가", "icon-button@1 패널에 추가"]));
    expect(new Set(matchingLabels).size).toBe(matchingLabels.length);
    const add = host.querySelector<HTMLButtonElement>('button[aria-label="button@1 패널에 추가"]')!;
    await act(async () => {
      add.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await Promise.resolve();
    });
    expect(host.textContent).toContain("button");
    const textarea = host.querySelector<HTMLTextAreaElement>("textarea")!;
    const before = textarea.value;
    act(() => {
      setControlValue(textarea, '{"unsafe":"draft"}');
    });
    const importButton = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
      button.textContent?.includes("가져오기 및 검증"),
    )!;
    await act(async () => {
      importButton.click();
      await Promise.resolve();
    });
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    act(() => {
      setControlValue(textarea, before);
    });
    await act(async () => {
      importButton.click();
      await Promise.resolve();
    });
    expect(host.textContent).toContain("정의가 유효합니다");
  });
});
