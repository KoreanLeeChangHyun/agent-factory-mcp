// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentEditor } from "../../../apps/web/src/standard/documents/DocumentEditor.js";
import { DocumentExplorer } from "../../../apps/web/src/standard/documents/DocumentExplorer.js";
import { DocumentViewer } from "../../../apps/web/src/standard/documents/DocumentViewer.js";
import type { DocumentRecord } from "../../../apps/web/src/standard/documents/document-client.js";
import {
  editorReducer,
  initialEditorState,
  type EditorDocument,
} from "../../../apps/web/src/standard/documents/document-editor-state.js";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const createObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
const revokeObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");

function mount(node: ReactNode) {
  const host = globalThis.document.createElement("div");
  globalThis.document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(node));
  return {
    host,
    render: (next: ReactNode) => act(() => root.render(next)),
    cleanup: () =>
      act(() => {
        root.unmount();
        host.remove();
      }),
  };
}

const response = (content: string, status = 200, mediaType = "text/markdown") =>
  new Response(content, { status, headers: { "Content-Type": mediaType } });

const eventWith = (type: string, values: Record<string, unknown>) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.entries(values).forEach(([key, value]) => Object.defineProperty(event, key, { value }));
  return event;
};

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  if (createObjectUrlDescriptor) Object.defineProperty(URL, "createObjectURL", createObjectUrlDescriptor);
  else Reflect.deleteProperty(URL, "createObjectURL");
  if (revokeObjectUrlDescriptor) Object.defineProperty(URL, "revokeObjectURL", revokeObjectUrlDescriptor);
  else Reflect.deleteProperty(URL, "revokeObjectURL");
});

const document = (id: string, type: DocumentRecord["document_type"] = "processed"): DocumentRecord => ({
  id,
  workspace_id: "workspace",
  document_type: type,
  title: `문서 ${id}`,
  slug: `document-${id}`,
  status: "active",
  document_metadata: { path: `설계/${id}.md` },
  current_revision_number: 1,
  revision: 1,
  created_at: "2026-09-13T00:00:00Z",
  updated_at: "2026-09-13T00:00:00Z",
});

const editorDocument = (id: string): EditorDocument => ({
  id,
  title: `문서 ${id}`,
  path: `설계/${id}.md`,
  mediaType: "text/markdown",
  revision: 1,
  kind: "processed",
});

describe("Documents editor", () => {
  it("reuses previews, pins tabs, creates four-direction splits, and moves tabs", () => {
    let state = initialEditorState();
    state = editorReducer(state, { type: "open", document: editorDocument("one"), preview: true });
    state = editorReducer(state, { type: "open", document: editorDocument("two"), preview: true });
    expect(state.groups["group-1"].tabs.map((tab) => tab.document.id)).toEqual(["two"]);

    const tabId = state.groups["group-1"].tabs[0].id;
    state = editorReducer(state, { type: "pin", groupId: "group-1", tabId });
    state = editorReducer(state, { type: "open", document: editorDocument("three"), preview: true });
    expect(state.groups["group-1"].tabs).toHaveLength(2);
    expect(state.groups["group-1"].tabs[0].pinned).toBe(true);

    state = editorReducer(state, { type: "split", groupId: "group-1", tabId, edge: "left" });
    expect("axis" in state.layout && state.layout.axis).toBe("horizontal");
    const leftGroup = state.activeGroupId;
    state = editorReducer(state, {
      type: "move",
      sourceGroupId: leftGroup,
      tabId: state.groups[leftGroup].tabs[0].id,
      targetGroupId: "group-1",
      index: 1,
      copy: true,
      edge: "bottom",
    });
    expect(Object.keys(state.groups)).toHaveLength(3);
    expect("axis" in state.layout).toBe(true);
  });

  it("protects pinned tabs during ordinary bulk close and supports keyboard resizing state", () => {
    let state = initialEditorState();
    state = editorReducer(state, { type: "open", document: editorDocument("one"), preview: false });
    const tabId = state.groups["group-1"].tabs[0].id;
    state = editorReducer(state, { type: "pin", groupId: "group-1", tabId });
    state = editorReducer(state, { type: "close", groupId: "group-1", tabIds: [tabId] });
    expect(state.groups["group-1"].tabs).toHaveLength(1);
    state = editorReducer(state, { type: "split", groupId: "group-1", tabId, edge: "right" });
    state = editorReducer(state, { type: "resize", path: "", ratio: 0.8 });
    expect("ratio" in state.layout && state.layout.ratio).toBe(0.8);
  });

  it("removes empty groups while preserving the final empty editor group", () => {
    let state = initialEditorState();
    state = editorReducer(state, { type: "open", document: editorDocument("one"), preview: false });
    const tabId = state.groups["group-1"].tabs[0].id;
    state = editorReducer(state, { type: "split", groupId: "group-1", tabId, edge: "right" });
    const second = state.activeGroupId;
    state = editorReducer(state, { type: "closeGroup", groupId: second });
    expect(Object.keys(state.groups)).toEqual(["group-1"]);
    expect(state.layout).toEqual({ groupId: "group-1" });
    state = editorReducer(state, { type: "closeGroup", groupId: "group-1" });
    expect(Object.keys(state.groups)).toEqual(["group-1"]);
    expect(state.groups["group-1"].tabs).toEqual([]);
  });

  it("renders an accessible multi-select explorer and isolated loading viewer", () => {
    const explorer = renderToStaticMarkup(
      <DocumentExplorer
        documents={[document("one"), document("original", "original")]}
        onOpen={() => undefined}
        storageKey="test:documents"
      />,
    );
    expect(explorer).toContain('aria-multiselectable="true"');
    expect(explorer).toContain("원본 문서");
    expect(explorer).toContain("가공 문서");
    expect(explorer).toContain("명세 문서");
    expect(explorer).toContain('aria-label="원본 문서 메타데이터 표"');
    expect(explorer).toContain('aria-label="가공 문서 개요"');

    const viewer = renderToStaticMarkup(
      <DocumentViewer document={document("one")} organizationId="org" workspaceId="workspace" revision={1} />,
    );
    expect(viewer).toContain("문서를 불러오는 중입니다.");
  });

  it("switches between accessible overview and searchable Original metadata-table surfaces", () => {
    const onOpen = vi.fn();
    const active = document("original-active", "original");
    const archived: DocumentRecord = { ...document("original-archived", "original"), status: "archived" };
    const view = mount(
      <DocumentExplorer
        documents={[active, archived, document("processed"), document("specification", "specification")]}
        onOpen={onOpen}
        storageKey="test:document-surfaces"
      />,
    );

    expect(view.host.querySelectorAll(".af-document-explorer__header")).toHaveLength(3);
    act(() => view.host.querySelector<HTMLButtonElement>('button[aria-label="명세 문서 개요"]')?.click());
    expect(view.host.querySelector('[role="region"]')?.getAttribute("aria-label")).toBe("명세 문서 개요");
    act(() => view.host.querySelector<HTMLButtonElement>("button")?.click());
    act(() => view.host.querySelector<HTMLButtonElement>('button[aria-label="원본 문서 메타데이터 표"]')?.click());

    const search = view.host.querySelector<HTMLInputElement>('input[type="search"]')!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(search, "archived");
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(view.host.querySelector("tbody")?.textContent).not.toContain("original-active");
    expect(view.host.querySelector("tbody")?.textContent).toContain("original-archived");
    act(() => view.host.querySelector<HTMLButtonElement>("tbody button")?.click());
    expect(onOpen).toHaveBeenCalledWith("original-archived", true);

    act(() => view.host.querySelector<HTMLButtonElement>("section > header button")?.click());
    act(() => view.host.querySelector<HTMLButtonElement>('button[aria-label="원본 문서 메타데이터 표"]')?.click());
    expect(view.host.querySelector<HTMLInputElement>('input[type="search"]')?.value).toBe("archived");
    view.cleanup();
  });

  it("supports keyboard splitting, pointer resizing, and pointer tab movement", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response("content"));
    const documents = [document("one"), document("two")];
    const view = mount(
      <DocumentEditor
        documents={documents}
        openRequest={{ id: "one", preview: false, serial: 1 }}
        organizationId="org"
        workspaceId="workspace"
      />,
    );
    await act(async () => undefined);
    const editor = view.host.querySelector<HTMLElement>(".af-document-editor")!;
    expect(editor.textContent).toContain("오른쪽 탭 닫기");
    expect(editor.textContent).toContain("모든 탭 닫기");
    expect(editor.textContent).toContain("그룹 닫기");
    expect(editor.textContent).toContain("전체 에디터 닫기");
    act(() => editor.dispatchEvent(new KeyboardEvent("keydown", { key: "\\", ctrlKey: true, bubbles: true })));
    expect(view.host.querySelectorAll(".af-document-editor__group")).toHaveLength(2);

    const separator = view.host.querySelector<HTMLElement>('[role="separator"]')!;
    Object.defineProperty(separator.parentElement, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0, width: 1000, height: 600 }),
    });
    act(() => {
      separator.dispatchEvent(eventWith("pointerdown", { pointerId: 1, clientX: 500, clientY: 0 }));
      separator.dispatchEvent(eventWith("pointermove", { pointerId: 1, clientX: 700, clientY: 0 }));
      separator.dispatchEvent(eventWith("pointerup", { pointerId: 1, clientX: 700, clientY: 0 }));
    });
    expect(separator.getAttribute("aria-valuenow")).toBe("70");

    const groups = view.host.querySelectorAll<HTMLElement>(".af-document-editor__group");
    const tab = groups[0].querySelector<HTMLElement>('[draggable="true"]')!;
    const dataTransfer = { getData: () => "", effectAllowed: "copyMove" };
    act(() => {
      tab.dispatchEvent(eventWith("dragstart", { dataTransfer }));
      groups[1].dispatchEvent(eventWith("drop", { dataTransfer, ctrlKey: false, altKey: false }));
    });
    expect(view.host.querySelectorAll(".af-document-editor__group")).toHaveLength(1);
    view.cleanup();
  });

  it("preserves tabs while the separate Original surface hides the mounted editor", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response("content"));
    const documents = [document("one")];
    const editor = (
      <DocumentEditor
        documents={documents}
        openRequest={{ id: "one", preview: false, serial: 1 }}
        organizationId="org"
        workspaceId="workspace"
      />
    );
    const view = mount(<div className="af-document-editor-host">{editor}</div>);
    await act(async () => undefined);
    expect(view.host.querySelector('[role="tab"]')?.textContent).toContain("one");
    view.render(
      <div className="af-document-editor-host" hidden>
        {editor}
      </div>,
    );
    view.render(<div className="af-document-editor-host">{editor}</div>);
    expect(view.host.querySelector('[role="tab"]')?.textContent).toContain("one");
    view.cleanup();
  });

  it("shows a tab error, retries, and disposes image resources", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response("failure", 500))
      .mockResolvedValueOnce(response("image", 200, "image/png"));
    const createUrl = vi.fn(() => "blob:preview");
    const revokeUrl = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createUrl });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeUrl });
    const view = mount(
      <DocumentViewer document={document("one")} organizationId="org" workspaceId="workspace" revision={1} />,
    );
    await act(async () => undefined);
    expect(view.host.textContent).toContain("불러오지 못했습니다");
    act(() => view.host.querySelector<HTMLButtonElement>("button")?.click());
    await act(async () => undefined);
    expect(view.host.querySelector("img")?.getAttribute("src")).toBe("blob:preview");
    view.cleanup();
    expect(createUrl).toHaveBeenCalledOnce();
    expect(revokeUrl).toHaveBeenCalledWith("blob:preview");
  });

  it("keeps permission failure scoped to its tab and allows retry", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response("forbidden", 403))
      .mockResolvedValueOnce(response("allowed"));
    const view = mount(
      <DocumentViewer document={document("one")} organizationId="org" workspaceId="workspace" revision={1} />,
    );
    await act(async () => undefined);
    expect(view.host.textContent).toContain("접근할 권한이 없습니다");
    act(() => view.host.querySelector<HTMLButtonElement>("button")?.click());
    // Reading the text body finishes on a later task, so flush until the retried content renders.
    for (let task = 0; task < 20 && !view.host.querySelector("pre"); task += 1) {
      await act(() => new Promise((resolve) => setTimeout(resolve, 5)));
    }
    expect(view.host.querySelector("pre")?.textContent).toBe("allowed");
    view.cleanup();
  });

  it("provides an authenticated PDF download action", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response("pdf", 200, "application/pdf"));
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: () => "blob:pdf" });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    const view = mount(
      <DocumentViewer document={document("one")} organizationId="org" workspaceId="workspace" revision={1} />,
    );
    await act(async () => undefined);
    const download = view.host.querySelector<HTMLAnchorElement>("a[download]");
    expect(download?.textContent).toBe("다운로드");
    expect(download?.getAttribute("href")).toBe("blob:pdf");
    view.cleanup();
  });

  it("clears tabs and aborts active content when the Workspace changes at narrow width", async () => {
    let signal: AbortSignal | undefined;
    vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>(() => undefined);
    });
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 640 });
    const documents = [document("one")];
    const view = mount(
      <DocumentEditor
        documents={documents}
        openRequest={{ id: "one", preview: false, serial: 1 }}
        organizationId="org"
        workspaceId="workspace-one"
      />,
    );
    await act(async () => undefined);
    expect(view.host.querySelector('[role="tab"]')).toBeTruthy();
    view.render(<DocumentEditor documents={[]} openRequest={null} organizationId="org" workspaceId="workspace-two" />);
    await act(async () => undefined);
    expect(view.host.querySelector('[role="tab"]')).toBeNull();
    expect(signal?.aborted).toBe(true);
    expect(view.host.scrollWidth).toBeLessThanOrEqual(view.host.clientWidth);
    view.cleanup();
  });
});
