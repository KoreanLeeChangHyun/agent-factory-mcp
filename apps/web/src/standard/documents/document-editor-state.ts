export type SplitAxis = "horizontal" | "vertical";
export type SplitEdge = "left" | "right" | "top" | "bottom";

export interface EditorDocument {
  id: string;
  title: string;
  path: string;
  mediaType: string;
  revision: number;
  kind: "processed" | "specification";
}

export interface EditorTab {
  id: string;
  document: EditorDocument;
  pinned: boolean;
  preview: boolean;
}

export interface EditorGroup {
  id: string;
  tabs: EditorTab[];
  activeId: string | null;
}

export type EditorLayout =
  | { groupId: string }
  | { axis: SplitAxis; ratio: number; first: EditorLayout; second: EditorLayout };

export interface EditorState {
  groups: Record<string, EditorGroup>;
  layout: EditorLayout;
  activeGroupId: string;
  maximizedGroupId: string | null;
  serial: number;
}

export type EditorAction =
  | { type: "open"; document: EditorDocument; groupId?: string; preview?: boolean; edge?: SplitEdge }
  | { type: "pin"; groupId: string; tabId: string }
  | { type: "activate"; groupId: string; tabId: string }
  | { type: "close"; groupId: string; tabIds: string[]; includePinned?: boolean }
  | { type: "split"; groupId: string; tabId: string; edge: SplitEdge }
  | {
      type: "move";
      sourceGroupId: string;
      tabId: string;
      targetGroupId: string;
      index: number;
      copy: boolean;
      edge?: SplitEdge;
    }
  | { type: "resize"; path: string; ratio: number }
  | { type: "maximize"; groupId: string | null }
  | { type: "closeGroup"; groupId: string }
  | { type: "closeEditor" }
  | { type: "reset" };

export function initialEditorState(): EditorState {
  return {
    groups: { "group-1": { id: "group-1", tabs: [], activeId: null } },
    layout: { groupId: "group-1" },
    activeGroupId: "group-1",
    maximizedGroupId: null,
    serial: 1,
  };
}

function replaceLeaf(layout: EditorLayout, groupId: string, replacement: EditorLayout): EditorLayout {
  if ("groupId" in layout) return layout.groupId === groupId ? replacement : layout;
  return {
    ...layout,
    first: replaceLeaf(layout.first, groupId, replacement),
    second: replaceLeaf(layout.second, groupId, replacement),
  };
}

function openTab(state: EditorState, document: EditorDocument, groupId: string, preview: boolean) {
  const group = state.groups[groupId];
  const existing = group.tabs.find((tab) => tab.document.id === document.id);
  if (existing) {
    if (!preview) existing.preview = false;
    group.activeId = existing.id;
    return;
  }
  if (preview) {
    const previous = group.tabs.find((tab) => tab.preview && !tab.pinned);
    if (previous) group.tabs = group.tabs.filter((tab) => tab !== previous);
  }
  state.serial += 1;
  const tab = { id: `tab-${state.serial}`, document, pinned: false, preview };
  group.tabs.push(tab);
  group.activeId = tab.id;
}

function splitGroup(state: EditorState, groupId: string, edge: SplitEdge): EditorGroup {
  state.serial += 1;
  const group = { id: `group-${state.serial}`, tabs: [], activeId: null } satisfies EditorGroup;
  state.groups[group.id] = group;
  const before = edge === "left" || edge === "top";
  const leaf = { groupId };
  const next = { groupId: group.id };
  state.layout = replaceLeaf(state.layout, groupId, {
    axis: edge === "left" || edge === "right" ? "horizontal" : "vertical",
    ratio: 0.5,
    first: before ? next : leaf,
    second: before ? leaf : next,
  });
  return group;
}

function clone(state: EditorState): EditorState {
  const cloneLayout = (layout: EditorLayout): EditorLayout =>
    "groupId" in layout
      ? { ...layout }
      : {
          ...layout,
          first: cloneLayout(layout.first),
          second: cloneLayout(layout.second),
        };
  return {
    ...state,
    layout: cloneLayout(state.layout),
    groups: Object.fromEntries(
      Object.entries(state.groups).map(([id, group]) => [
        id,
        { ...group, tabs: group.tabs.map((tab) => ({ ...tab })) },
      ]),
    ),
  };
}

function leafOrder(layout: EditorLayout): string[] {
  return "groupId" in layout ? [layout.groupId] : [...leafOrder(layout.first), ...leafOrder(layout.second)];
}

function normalize(state: EditorState): void {
  const order = leafOrder(state.layout);
  const previousActiveIndex = order.indexOf(state.activeGroupId);
  const nonempty = order.filter((id) => state.groups[id]?.tabs.length);
  const retained = new Set(nonempty.length ? nonempty : [state.activeGroupId]);
  const prune = (layout: EditorLayout): EditorLayout | null => {
    if ("groupId" in layout) return retained.has(layout.groupId) ? layout : null;
    const first = prune(layout.first);
    const second = prune(layout.second);
    if (first && second) return { ...layout, first, second };
    return first ?? second;
  };
  state.layout = prune(state.layout) ?? { groupId: state.activeGroupId };
  state.groups = Object.fromEntries(Object.entries(state.groups).filter(([id]) => retained.has(id)));
  if (!state.groups[state.activeGroupId]) {
    state.activeGroupId =
      order.slice(previousActiveIndex + 1).find((id) => retained.has(id)) ??
      order
        .slice(0, previousActiveIndex)
        .reverse()
        .find((id) => retained.has(id)) ??
      leafOrder(state.layout)[0];
  }
  if (state.maximizedGroupId && !state.groups[state.maximizedGroupId]) {
    state.maximizedGroupId = null;
  }
}

export function editorReducer(current: EditorState, action: EditorAction): EditorState {
  if (action.type === "reset" || action.type === "closeEditor") return initialEditorState();
  const state = clone(current);
  if (action.type === "open") {
    let groupId = action.groupId ?? state.activeGroupId;
    if (action.edge) groupId = splitGroup(state, groupId, action.edge).id;
    openTab(state, action.document, groupId, action.preview ?? true);
    state.activeGroupId = groupId;
  } else if (action.type === "activate") {
    state.groups[action.groupId].activeId = action.tabId;
    state.activeGroupId = action.groupId;
  } else if (action.type === "pin") {
    const group = state.groups[action.groupId];
    const tab = group.tabs.find((item) => item.id === action.tabId);
    if (tab) {
      tab.pinned = !tab.pinned;
      tab.preview = false;
      group.tabs.sort((left, right) => Number(right.pinned) - Number(left.pinned));
    }
  } else if (action.type === "close") {
    const group = state.groups[action.groupId];
    const closing = new Set(action.tabIds);
    const index = group.tabs.findIndex((tab) => tab.id === group.activeId);
    group.tabs = group.tabs.filter((tab) => !closing.has(tab.id) || (tab.pinned && !action.includePinned));
    if (!group.tabs.some((tab) => tab.id === group.activeId)) {
      group.activeId = group.tabs[Math.min(index, group.tabs.length - 1)]?.id ?? null;
    }
    normalize(state);
  } else if (action.type === "closeGroup") {
    state.groups[action.groupId].tabs = [];
    state.groups[action.groupId].activeId = null;
    normalize(state);
  } else if (action.type === "split") {
    const source = state.groups[action.groupId].tabs.find((tab) => tab.id === action.tabId);
    if (source) {
      const group = splitGroup(state, action.groupId, action.edge);
      openTab(state, source.document, group.id, false);
      state.activeGroupId = group.id;
    }
  } else if (action.type === "move") {
    const source = state.groups[action.sourceGroupId];
    const sourceIndex = source.tabs.findIndex((tab) => tab.id === action.tabId);
    const tab = source.tabs[sourceIndex];
    if (!tab) return current;
    const target = action.edge
      ? splitGroup(state, action.targetGroupId, action.edge)
      : state.groups[action.targetGroupId];
    const moving = action.copy ? { ...tab, id: `tab-${++state.serial}`, pinned: false, preview: false } : tab;
    if (!action.copy) source.tabs.splice(sourceIndex, 1);
    const duplicate = target.tabs.find((item) => item.document.id === moving.document.id);
    if (duplicate) target.activeId = duplicate.id;
    else {
      target.tabs.splice(Math.max(0, Math.min(action.index, target.tabs.length)), 0, moving);
      target.activeId = moving.id;
    }
    if (!source.tabs.some((item) => item.id === source.activeId)) {
      source.activeId = source.tabs[Math.min(sourceIndex, source.tabs.length - 1)]?.id ?? null;
    }
    state.activeGroupId = target.id;
    normalize(state);
  } else if (action.type === "maximize") state.maximizedGroupId = action.groupId;
  else if (action.type === "resize") {
    const indexes = action.path ? action.path.split(".").map(Number) : [];
    let branch = state.layout;
    for (const index of indexes) {
      if ("groupId" in branch) return current;
      branch = index === 0 ? branch.first : branch.second;
    }
    if (!("groupId" in branch)) branch.ratio = Math.max(0.2, Math.min(0.8, action.ratio));
  }
  return state;
}

export function selectDocumentIds(
  ordered: string[],
  selected: ReadonlySet<string>,
  anchor: string | null,
  id: string,
  options: { toggle?: boolean; range?: boolean },
): { selected: Set<string>; anchor: string } {
  if (options.range && anchor && ordered.includes(anchor)) {
    const start = ordered.indexOf(anchor);
    const end = ordered.indexOf(id);
    return { selected: new Set(ordered.slice(Math.min(start, end), Math.max(start, end) + 1)), anchor };
  }
  if (options.toggle) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return { selected: next, anchor: id };
  }
  return { selected: new Set([id]), anchor: id };
}
