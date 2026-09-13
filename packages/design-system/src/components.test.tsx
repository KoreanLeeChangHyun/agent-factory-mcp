// @vitest-environment jsdom
import { act, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import {
  DataTable,
  Dialog,
  Markdown,
  PanelLayout,
  ShellResizeHandle,
  SidebarPattern,
  Tabs,
  Toggle,
  WorkbenchFrame,
  WorkbenchPanel,
  WorkbenchSidebar,
  WorkbenchTaskList,
} from "./components.js";
import { instantiateAsset, type AssetActionEvent } from "./catalog.js";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function NestedDialogs() {
  const [outer, setOuter] = useState(true);
  const [inner, setInner] = useState(false);
  return (
    <Dialog open={outer} title="바깥" onClose={() => setOuter(false)}>
      <button onClick={() => setInner(true)}>안쪽 열기</button>
      <Dialog open={inner} title="안쪽" onClose={() => setInner(false)}>
        <button>안쪽 동작</button>
      </Dialog>
    </Dialog>
  );
}

function mount(node: ReactNode) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(node));
  return {
    host,
    root,
    cleanup: () =>
      act(() => {
        root.unmount();
        host.remove();
      }),
  };
}

function key(target: Element, value: string) {
  act(() => target.dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true })));
}

describe("interactive components", () => {
  it("composes reusable table columns and semantic cell slots", () => {
    const view = mount(
      <DataTable
        rows={[{ id: "1", title: "긴 이름", status: "active", owner: "Kim" }]}
        columns={[
          { id: "title", label: "이름" },
          { id: "owner", label: "소유자", render: (value) => <strong>{String(value)}</strong> },
        ]}
      />,
    );
    expect(Array.from(view.host.querySelectorAll("th")).map((cell) => cell.textContent)).toEqual(["이름", "소유자"]);
    expect(view.host.querySelector("tbody strong")?.textContent).toBe("Kim");
    view.cleanup();
  });
  it("owns the shared three-region shell and clamped keyboard resize", () => {
    const changes: number[] = [];
    const view = mount(
      <WorkbenchFrame sidebarOpen sidebarWidth={180}>
        <WorkbenchTaskList>작업</WorkbenchTaskList>
        <WorkbenchSidebar>탐색</WorkbenchSidebar>
        <ShellResizeHandle width={180} onChange={(width) => changes.push(width)} />
        <WorkbenchPanel>내용</WorkbenchPanel>
      </WorkbenchFrame>,
    );
    expect(view.host.querySelector("main.af-shell")).not.toBeNull();
    const separator = view.host.querySelector<HTMLElement>("[role='separator']")!;
    key(separator, "ArrowLeft");
    key(separator, "ArrowRight");
    expect(changes).toEqual([180, 196]);
    view.cleanup();
  });

  it("moves tab focus and selection with arrow keys", () => {
    const view = mount(<Tabs labels={["개요", "세부"]} />);
    const tabs = view.host.querySelectorAll<HTMLElement>("[role='tab']");
    tabs[0]?.focus();
    key(tabs[0]!, "ArrowRight");
    expect(tabs[1]?.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tabs[1]);
    view.cleanup();
  });

  it("filters a search sidebar and reports its empty state", () => {
    const view = mount(<SidebarPattern variant="search-list" />);
    const input = view.host.querySelector<HTMLInputElement>("input[aria-label='목록 검색']")!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "존재하지 않음");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(view.host.textContent).toContain("항목 없음");
    view.cleanup();
  });

  it("gives tree rows and expansion controls distinct accessible names", () => {
    const view = mount(
      <SidebarPattern
        variant="tree"
        expanded={["parent"]}
        items={[{ id: "parent", label: "부모", children: [{ id: "child", label: "시작 안내" }] }]}
      />,
    );
    expect(view.host.querySelector('button[aria-label="시작 안내 항목"]')).not.toBeNull();
    expect(view.host.querySelector('button[aria-label="부모 펼치기"]')).not.toBeNull();
    view.cleanup();
  });

  it("uses coherent mobile split orientation and keyboard adjustment", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    const onAction = vi.fn();
    const view = mount(
      <PanelLayout
        variant="split"
        onAction={onAction}
        slots={[
          { id: "first", title: "첫 영역" },
          { id: "second", title: "둘째 영역" },
        ]}
      />,
    );
    const separator = view.host.querySelector<HTMLElement>("[role='separator']")!;
    expect(separator.getAttribute("aria-orientation")).toBe("horizontal");
    key(separator, "ArrowDown");
    expect(separator.getAttribute("aria-valuenow")).toBe("50");
    expect(separator.parentElement?.style.getPropertyValue("--af-split")).toBe("50%");
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith("toggle", 50);
    view.cleanup();
  });

  it("emits one clamped split action for each pointer move", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    const onAction = vi.fn();
    const view = mount(
      <PanelLayout
        variant="split"
        onAction={onAction}
        slots={[
          { id: "first", title: "첫 영역" },
          { id: "second", title: "둘째 영역" },
        ]}
      />,
    );
    const separator = view.host.querySelector<HTMLElement>("[role='separator']")!;
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
    act(() => {
      separator.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 90 }));
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 120 }));
      window.dispatchEvent(new MouseEvent("pointerup"));
    });
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith("toggle", 60);
    view.cleanup();
  });

  it("composes distinct panels from caller-provided slots", () => {
    const slots = [
      { id: "alpha", title: "Alpha", content: "First content" },
      { id: "beta", title: "Beta", content: "Second content", meta: "Secondary" },
    ];
    const view = mount(<PanelLayout variant="list-detail" slots={slots} />);
    expect(view.host.querySelector("nav [data-slot='alpha']")?.textContent).toContain("First content");
    expect(view.host.querySelector("article [data-slot='beta']")?.textContent).toContain("Second content");
    act(() => view.root.render(<PanelLayout variant="document" slots={slots} />));
    expect(view.host.querySelector("article [data-slot='alpha'] pre")?.textContent).toContain("First content");
    act(() => view.root.render(<PanelLayout variant="settings" slots={slots} />));
    expect(view.host.querySelectorAll("form input")).toHaveLength(2);
    view.cleanup();
  });

  it("contains dialog focus, restores it on close, and removes on unmount", () => {
    const origin = document.createElement("button");
    document.body.append(origin);
    origin.focus();
    const onClose = () => undefined;
    const view = mount(
      <Dialog open title="확인" onClose={onClose}>
        <button>내부</button>
      </Dialog>,
    );
    expect(document.activeElement?.getAttribute("aria-label")).toBe("대화상자 닫기");
    act(() => view.root.render(<Dialog open={false} title="확인" onClose={onClose} />));
    expect(document.activeElement).toBe(origin);
    view.cleanup();
    expect(document.querySelector("[role='dialog']")).toBeNull();
    origin.remove();
  });

  it("gives nested dialogs unique labels and topmost Escape ownership", () => {
    const origin = document.createElement("button");
    document.body.append(origin);
    origin.focus();
    const view = mount(<NestedDialogs />);
    try {
      const opener = Array.from(view.host.querySelectorAll("button")).find(
        (button) => button.textContent === "안쪽 열기",
      )!;
      opener.focus();
      act(() => opener.click());
      const dialogs = view.host.querySelectorAll<HTMLElement>("[role='dialog']");
      expect(dialogs).toHaveLength(2);
      expect(dialogs[0]?.getAttribute("aria-labelledby")).not.toBe(dialogs[1]?.getAttribute("aria-labelledby"));
      key(document.activeElement!, "Escape");
      expect(view.host.querySelectorAll("[role='dialog']")).toHaveLength(1);
      expect(document.activeElement).toBe(opener);
      key(document.activeElement!, "Escape");
      expect(view.host.querySelector("[role='dialog']")).toBeNull();
      expect(document.activeElement).toBe(origin);
    } finally {
      view.cleanup();
      origin.remove();
    }
  });

  it("restores focus when an open dialog is destroyed", () => {
    const origin = document.createElement("button");
    document.body.append(origin);
    origin.focus();
    const view = mount(<Dialog open title="제거" onClose={() => undefined} />);
    view.cleanup();
    expect(document.activeElement).toBe(origin);
    expect(document.querySelector("[role='dialog']")).toBeNull();
    origin.remove();
  });

  it("renders unsafe Markdown as inert text", () => {
    const view = mount(<Markdown value={"<img src=x onerror=alert(1)> [나쁨](javascript:alert(1))"} />);
    expect(view.host.querySelector("img")).toBeNull();
    expect(view.host.querySelector("a")).toBeNull();
    expect(view.host.textContent).toContain("[나쁨]");
    view.cleanup();
  });

  it("preserves native disabled switch semantics", () => {
    const view = mount(<Toggle label="사용" disabled />);
    expect(view.host.querySelector<HTMLInputElement>("[role='switch']")?.disabled).toBe(true);
    view.cleanup();
  });

  it("dispatches only documented actions with typed outputs", () => {
    const events: AssetActionEvent[] = [];
    const view = mount(
      instantiateAsset(
        "toggle@1",
        { label: "사용" },
        { inputs: { value: false }, onAction: (event) => events.push(event) },
      ),
    );
    const toggle = view.host.querySelector<HTMLInputElement>("[role='switch']")!;
    act(() => toggle.click());
    expect(events).toEqual([{ assetId: "toggle@1", action: "toggle", output: { value: true } }]);
    view.cleanup();
  });

  it("emits an omitted value for an empty optional number and accepts re-entry", () => {
    const events: AssetActionEvent[] = [];
    const view = mount(instantiateAsset("number-input@1", {}, { onAction: (event) => events.push(event) }));
    const input = view.host.querySelector<HTMLInputElement>("input[type='number']")!;
    for (const value of ["3", "", "4"]) {
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }
    expect(events.map((event) => event.output)).toEqual([{ value: 3 }, {}, { value: 4 }]);
    view.cleanup();
  });
});
