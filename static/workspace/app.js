const workspaceShell = document.querySelector("[data-workspace-shell]");
const sidebarResizer = document.querySelector("[data-sidebar-resizer]");
const activityButtons = document.querySelectorAll("[data-activity]");
const externalIntegrationState = document.querySelector("[data-external-integration-state]");
const externalIntegrationList = document.querySelector("[data-external-integration-list]");
const sidebarTitle = document.querySelector("[data-sidebar-title]");
const sidebarViews = document.querySelectorAll("[data-sidebar-view]");
const workspaceViews = document.querySelectorAll("[data-workspace-view]");
const documentNavigationItems = document.querySelectorAll("[data-document-target]");
const documentViews = document.querySelectorAll("[data-document-view]");
const documentWorkspace = document.querySelector(".document-workspace");
const documentGroupToggles = document.querySelectorAll("[data-document-group-toggle]");
const documentTreeToggles = document.querySelectorAll("[data-document-tree-toggle]");
const originalSearchInput = document.querySelector("[data-original-global-search]");
const originalSearchState = document.querySelector("[data-original-search-state]");
const originalSearchFailure = document.querySelector("[data-original-search-failure]");
const originalTableElement = document.querySelector("[data-original-table]");
const originalTableFallback = document.querySelector("[data-original-table-fallback]");
const specificationList = document.querySelector("[data-specification-list]");
const specificationTreeState = document.getElementById("specification-tree-state");
const processedDocumentList = document.querySelector("[data-processed-document-list]");
const processedTreeState = document.getElementById("processed-tree-state");
const processedDocumentFrame = document.querySelector("[data-processed-document-frame]");
const processedDocumentTitle = document.querySelector("[data-processed-document-title]");
const specificationEditorLayout = document.querySelector("[data-specification-editor-layout]");
const specificationEditorEmpty = document.querySelector("[data-specification-editor-empty]");
const specificationGroupTemplate = document.querySelector("[data-specification-group-template]");
const specificationItems = new Map();
const specificationDragType = "application/x-agent-factory-specification";
const specificationTabDragType = "application/x-agent-factory-specification-tab";
const specificationIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
let activeSpecificationGroup = null;
let nextSpecificationGroupId = 1;
let draggedSpecificationId = null;
let draggedSpecificationTab = null;
const minimumSidebarWidth = 180;
const maximumSidebarWidth = 520;
const activityTitles = {
  schedule: "일정",
  agents: "에이전트",
  documents: "문서",
  "external-integrations": "외부연동",
  logs: "로그",
  tests: "테스트",
};

const compactDocumentTitle = (value, fallback = "문서") => {
  const normalized = String(value || fallback).trim().replace(/\s+/g, " ");
  const withoutRepeatedSuffix = normalized.replace(/\s+(?:명세\s*문서|가공\s*문서|문서|명세)$/u, "");
  const concise = withoutRepeatedSuffix || normalized || fallback;
  return concise.length > 24 ? `${concise.slice(0, 23).trimEnd()}…` : concise;
};

const originalSearchFields = [
  "classification",
  "provider",
  "tags",
  "name",
  "extension",
  "modifiedAt",
];

const externalIntegrationFields = ["provider", "account", "method", "status"];

const normalizeExternalIntegration = (item) => {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    throw new TypeError("외부연동 항목은 객체여야 합니다.");
  }
  if (item.integrationIdentity == null || String(item.integrationIdentity).trim() === "") {
    throw new TypeError("외부연동 항목에는 stable integrationIdentity가 필요합니다.");
  }
  const normalized = { integrationIdentity: String(item.integrationIdentity) };
  externalIntegrationFields.forEach((field) => {
    normalized[field] = item[field] == null ? "" : String(item[field]);
  });
  return normalized;
};

const replaceExternalIntegrations = (items) => {
  if (!Array.isArray(items)) throw new TypeError("외부연동 항목 목록은 배열이어야 합니다.");
  if (!externalIntegrationList || !externalIntegrationState) return Promise.resolve();
  const normalizedItems = items.map(normalizeExternalIntegration);
  const identities = new Set(normalizedItems.map((item) => item.integrationIdentity));
  if (identities.size !== normalizedItems.length) {
    throw new TypeError("외부연동 integrationIdentity는 항목마다 고유해야 합니다.");
  }

  externalIntegrationList.replaceChildren();
  normalizedItems.forEach((item) => {
    const row = document.createElement("li");
    row.className = "external-integration-item";
    row.dataset.integrationIdentity = item.integrationIdentity;
    const provider = createPlainText(item.provider || "이름 없음", "external-integration-item__provider");
    const metadata = createPlainText(
      [item.account, item.method, item.status].filter(Boolean).join(" · ") || "상태 정보 없음",
      "external-integration-item__metadata",
    );
    row.append(provider, metadata);
    externalIntegrationList.append(row);
  });

  externalIntegrationList.hidden = normalizedItems.length === 0;
  externalIntegrationState.hidden = normalizedItems.length > 0;
  externalIntegrationState.textContent = "외부연동 상태 연결 대기";
  return Promise.resolve();
};

const createPlainText = (value, className) => {
  const element = document.createElement("span");
  if (className) element.className = className;
  element.textContent = value == null ? "" : String(value);
  return element;
};

const plainTextFormatter = (cell) => createPlainText(cell.getValue());

const createProviderIcon = () => {
  const namespace = "http://www.w3.org/2000/svg";
  const icon = document.createElementNS(namespace, "svg");
  icon.setAttribute("viewBox", "0 0 16 16");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");
  const path = document.createElementNS(namespace, "path");
  path.setAttribute("d", "M2.5 4.75h3l1.25-2h2.5l1.25 2h3v8.5h-11zm3 3.5h5m-5 2.5h3.5");
  icon.append(path);
  return icon;
};

const createSpecificationDocumentIcon = () => {
  const namespace = "http://www.w3.org/2000/svg";
  const icon = document.createElementNS(namespace, "svg");
  icon.classList.add("document-tree__item-icon");
  icon.setAttribute("viewBox", "0 0 16 16");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");
  const outline = document.createElementNS(namespace, "path");
  outline.setAttribute("d", "M4.25 2.5h5l2.5 2.5v8.5h-7.5z");
  const detail = document.createElementNS(namespace, "path");
  detail.setAttribute("d", "M9.25 2.5V5h2.5M6.25 8h3.5M6.25 10.5h3.5");
  icon.append(outline, detail);
  return icon;
};

const createSpecificationTabCloseIcon = () => {
  const namespace = "http://www.w3.org/2000/svg";
  const icon = document.createElementNS(namespace, "svg");
  icon.setAttribute("viewBox", "0 0 16 16");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");
  const path = document.createElementNS(namespace, "path");
  path.setAttribute("d", "M4 4l8 8m0-8-8 8");
  icon.append(path);
  return icon;
};

const providerFormatter = (cell) => {
  const provider = document.createElement("span");
  provider.className = "original-provider";
  provider.append(createProviderIcon(), createPlainText(cell.getValue(), "original-provider__text"));
  return provider;
};

const safeSourceUrl = (value) => {
  if (typeof value !== "string" || value.trim() === "") return null;
  try {
    const resolved = new URL(value.trim(), window.location.href);
    return resolved.protocol === "http:" || resolved.protocol === "https:" ? resolved : null;
  } catch {
    return null;
  }
};

const preserveSourceIdentity = (element, rowData) => {
  if (rowData.sourceIdentity == null || rowData.sourceIdentity === "") return;
  element.dataset.sourceIdentity = String(rowData.sourceIdentity);
};

const documentNameFormatter = (cell) => {
  const rowData = cell.getRow().getData();
  const name = cell.getValue() == null ? "" : String(cell.getValue());
  const url = safeSourceUrl(rowData.sourceUrl);
  if (!url) {
    const text = createPlainText(name, "original-document-name");
    preserveSourceIdentity(text, rowData);
    return text;
  }

  const link = document.createElement("a");
  link.className = "original-document-link";
  link.href = url.href;
  link.textContent = name;
  preserveSourceIdentity(link, rowData);
  if (url.origin !== window.location.origin) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }
  return link;
};

const normalizeOriginalRow = (row) => {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw new TypeError("원본 문서 행은 객체여야 합니다.");
  }
  if (row.sourceIdentity == null || String(row.sourceIdentity).trim() === "") {
    throw new TypeError("원본 문서 행에는 stable sourceIdentity가 필요합니다.");
  }
  const normalized = {};
  originalSearchFields.forEach((field) => {
    const value = row[field];
    normalized[field] = field === "tags" && Array.isArray(value)
      ? value.map((tag) => String(tag)).join(", ")
      : value == null ? "" : String(value);
  });
  normalized.sourceUrl = row.sourceUrl == null ? "" : String(row.sourceUrl);
  normalized.sourceIdentity = String(row.sourceIdentity);
  return normalized;
};

const setOriginalSearchState = (message) => {
  if (originalSearchState) originalSearchState.textContent = message;
};

const initializeOriginalSearch = () => {
  if (!originalTableElement) return;
  if (typeof window.Tabulator !== "function") {
    if (originalSearchFailure) originalSearchFailure.hidden = false;
    setOriginalSearchState("표 구성요소 초기화 실패");
    return;
  }

  try {
    originalTableElement.hidden = false;
    const listFilter = {
      headerFilter: "list",
      headerFilterParams: { valuesLookup: true, clearable: true },
      headerFilterPlaceholder: "필터",
    };
    const textFilter = {
      headerFilter: "input",
      headerFilterPlaceholder: "필터",
    };
    const table = new window.Tabulator(originalTableElement, {
      data: [],
      index: "sourceIdentity",
      layout: "fitColumns",
      movableColumns: true,
      placeholder: "데이터 연결 대기",
      columnDefaults: {
        headerSort: true,
        resizable: true,
      },
      columns: [
        { title: "문서 분류", field: "classification", minWidth: 128, widthGrow: 1, formatter: plainTextFormatter, ...listFilter },
        { title: "출처", field: "provider", minWidth: 140, widthGrow: 1, formatter: providerFormatter, ...listFilter },
        { title: "태그", field: "tags", minWidth: 160, widthGrow: 1.25, formatter: plainTextFormatter, ...textFilter },
        { title: "문서 이름", field: "name", minWidth: 220, widthGrow: 2, formatter: documentNameFormatter, ...textFilter },
        { title: "확장자", field: "extension", minWidth: 96, widthGrow: 0.75, formatter: plainTextFormatter, ...listFilter },
        { title: "수정 일자", field: "modifiedAt", minWidth: 150, widthGrow: 1.25, formatter: plainTextFormatter, ...textFilter },
      ],
    });

    const applyGlobalSearch = () => {
      const query = originalSearchInput?.value.trim().toLocaleLowerCase("ko") || "";
      if (!query) {
        table.clearFilter(false);
        return;
      }
      table.setFilter((row) => originalSearchFields.some((field) =>
        String(row[field] ?? "").toLocaleLowerCase("ko").includes(query),
      ));
    };

    originalSearchInput?.addEventListener("input", applyGlobalSearch);
    table.on("tableBuilt", () => {
      originalTableElement.hidden = false;
      if (originalTableFallback) originalTableFallback.hidden = true;
      if (originalSearchInput) originalSearchInput.disabled = false;
      setOriginalSearchState("데이터 연결 대기");
    });

    // Read-only browser adapter. A future owner-backed source may call
    // window.agentFactoryWorkspace.originalSearch.replaceRows(rows). Each row uses
    // classification, provider, tags, name, extension, modifiedAt, sourceUrl,
    // and sourceIdentity; this boundary performs no synchronization or editing.
    const workspaceAdapter = window.agentFactoryWorkspace || {};
    workspaceAdapter.originalSearch = Object.freeze({
      replaceRows(rows) {
        if (!Array.isArray(rows)) throw new TypeError("원본 문서 행 목록은 배열이어야 합니다.");
        const normalizedRows = rows.map(normalizeOriginalRow);
        const sourceIdentities = new Set(normalizedRows.map((row) => row.sourceIdentity));
        if (sourceIdentities.size !== normalizedRows.length) {
          throw new TypeError("원본 문서 sourceIdentity는 행마다 고유해야 합니다.");
        }
        return table.replaceData(normalizedRows).then(() => {
          applyGlobalSearch();
          setOriginalSearchState(normalizedRows.length ? `원본 문서 메타데이터 ${normalizedRows.length}건 표시` : "데이터 연결 대기");
        });
      },
    });
    window.agentFactoryWorkspace = workspaceAdapter;
  } catch {
    originalTableElement.hidden = true;
    if (originalTableFallback) originalTableFallback.hidden = false;
    if (originalSearchInput) originalSearchInput.disabled = true;
    if (originalSearchFailure) originalSearchFailure.hidden = false;
    setOriginalSearchState("표 구성요소 초기화 실패");
  }
};

const specificationStatusLabel = (status) => {
  if (status === "missing-human") return "사람용 명세 문서 없음";
  return "바인딩 불일치";
};

const safeSpecificationHref = (value, expectedId = null) => {
  if (typeof value !== "string" || value.trim() === "") return null;
  try {
    const resolved = new URL(value.trim(), window.location.href);
    const pathMatch = resolved.pathname.match(/^\/planning\/([a-z0-9]+(?:-[a-z0-9]+)*)\/index\.html$/);
    if (
      resolved.origin !== window.location.origin
      || resolved.username
      || resolved.password
      || resolved.search
      || resolved.hash
      || !pathMatch
      || (expectedId !== null && pathMatch[1] !== expectedId)
    ) return null;
    return resolved;
  } catch {
    return null;
  }
};

const safeProcessedDocumentHref = (value, expectedId = null) => {
  if (typeof value !== "string" || value.trim() === "") return null;
  try {
    const resolved = new URL(value.trim(), window.location.href);
    const pathMatch = resolved.pathname.match(/^\/processed\/([a-z0-9]+(?:-[a-z0-9]+)*)\/index\.html$/);
    if (
      resolved.origin !== window.location.origin
      || resolved.username
      || resolved.password
      || resolved.search
      || resolved.hash
      || !pathMatch
      || (expectedId !== null && pathMatch[1] !== expectedId)
    ) return null;
    return resolved;
  } catch {
    return null;
  }
};

const selectSpecificationLinkById = (id) => {
  document.querySelectorAll("[data-specification-link]").forEach((candidate) => {
    const isCurrent = candidate.dataset.specificationLink === id;
    candidate.classList.toggle("is-selected", isCurrent);
    if (isCurrent) candidate.setAttribute("aria-current", "page");
    else candidate.removeAttribute("aria-current");
  });
};

const setActiveSpecificationGroup = (group) => {
  document.querySelectorAll("[data-specification-group]").forEach((candidate) => {
    candidate.classList.toggle("is-active", candidate === group);
  });
  group?.classList.add("is-active");
  activeSpecificationGroup = group;
  selectSpecificationLinkById(group?.dataset.activeSpecificationId || "");
};

const activateSpecificationTabLocally = (group, specificationId, focusTab = false) => {
  if (!group) return false;
  const tabs = Array.from(group.querySelectorAll("[data-specification-tab]"));
  const panels = Array.from(group.querySelectorAll("[data-specification-panel]"));
  const activeTab = tabs.find((tab) => tab.dataset.specificationTab === specificationId);
  if (!activeTab) return false;

  tabs.forEach((tab) => {
    const isActive = tab === activeTab;
    tab.setAttribute("aria-selected", String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
    tab.classList.toggle("is-active", isActive);
    tab.closest(".specification-tab")?.classList.toggle("is-active", isActive);
  });
  panels.forEach((panel) => {
    panel.hidden = panel.dataset.specificationPanel !== specificationId;
  });
  group.dataset.activeSpecificationId = specificationId;
  if (focusTab) activeTab.focus();
  return true;
};

const activateSpecificationTab = (group, specificationId, focusTab = false) => {
  if (!activateSpecificationTabLocally(group, specificationId, focusTab)) return false;
  setActiveSpecificationGroup(group);
  return true;
};

const handleSpecificationTabKeydown = (group, event) => {
  const tabs = Array.from(group.querySelectorAll("[data-specification-tab]"));
  const currentIndex = tabs.indexOf(event.currentTarget);
  if (currentIndex < 0) return;
  let nextIndex = currentIndex;
  if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  else if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
  else if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = tabs.length - 1;
  else if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  activateSpecificationTab(group, tabs[nextIndex].dataset.specificationTab, true);
};

const updateSpecificationGroupEmptyState = (group) => {
  const emptyState = group?.querySelector("[data-specification-group-empty]");
  if (emptyState) emptyState.hidden = Boolean(group.querySelector("[data-specification-tab]"));
};

const applySpecificationFrameProjection = (frame) => {
  try {
    if (
      frame.contentWindow?.location.origin !== window.location.origin
      || !frame.contentDocument?.documentElement
    ) return;
    const frameDocument = frame.contentDocument;
    frameDocument.documentElement.dataset.agentFactoryWorkspaceEmbedded = "true";
    if (!frameDocument.getElementById("agent-factory-workspace-scrollbars")) {
      const scrollbarStyle = frameDocument.createElement("style");
      scrollbarStyle.id = "agent-factory-workspace-scrollbars";
      scrollbarStyle.textContent = `
        * { scrollbar-color: #4a4a4a transparent; scrollbar-width: thin; }
        *::-webkit-scrollbar { width: 6px; height: 6px; }
        *::-webkit-scrollbar-track { background: transparent; }
        *::-webkit-scrollbar-thumb { border-radius: 3px; background: #4a4a4a; }
        *::-webkit-scrollbar-thumb:hover { background: #5a5a5a; }
      `;
      frameDocument.head?.append(scrollbarStyle);
    }
  } catch {
    // The read-only frame keeps its standalone presentation if access is unavailable.
  }
};

const specificationGroupAtSubtreeEdge = (root, edge) => {
  if (!(root instanceof Element)) return null;
  if (root.matches("[data-specification-group]")) return root;
  const groups = Array.from(root.querySelectorAll("[data-specification-group]"));
  return edge === "last" ? groups.at(-1) || null : groups[0] || null;
};

const normalizeSpecificationSplitTree = () => {
  if (!specificationEditorLayout) return;
  let changed = true;
  while (changed) {
    changed = false;
    const splits = Array.from(
      specificationEditorLayout.querySelectorAll(".specification-split"),
    ).reverse();
    splits.forEach((split) => {
      const children = Array.from(split.children).filter((child) => (
        child.matches(".specification-split, [data-specification-group]")
      ));
      if (children.length === 0) {
        split.remove();
        changed = true;
      } else if (children.length === 1) {
        split.replaceWith(children[0]);
        changed = true;
      }
    });
  }
};

const removeEmptySpecificationGroup = (group) => {
  const parentSplit = group.parentElement?.matches(".specification-split")
    ? group.parentElement
    : null;
  if (!parentSplit) return null;
  const siblings = Array.from(parentSplit.children).filter((child) => child !== group);
  const groupWasFirst = parentSplit.firstElementChild === group;
  const survivorRoot = groupWasFirst ? siblings[0] : siblings.at(-1);
  const survivorGroup = specificationGroupAtSubtreeEdge(
    survivorRoot,
    groupWasFirst ? "first" : "last",
  );
  group.remove();
  normalizeSpecificationSplitTree();
  return survivorGroup;
};

const activateSurvivingSpecificationGroup = (group) => {
  if (!group) return false;
  const activeId = group.dataset.activeSpecificationId;
  const activeTab = activeId
    ? group.querySelector(`[data-specification-tab="${activeId}"]`)
    : null;
  const targetTab = activeTab || group.querySelector("[data-specification-tab]");
  if (!targetTab) {
    setActiveSpecificationGroup(group);
    return false;
  }
  return activateSpecificationTab(group, targetTab.dataset.specificationTab, true);
};

const closeSpecificationTab = (group, specificationId) => {
  if (!group) return false;
  const previouslyActiveGroup = activeSpecificationGroup;
  const targetGroupWasActive = previouslyActiveGroup === group;
  const tabs = Array.from(group.querySelectorAll("[data-specification-tab]"));
  const closingTab = tabs.find((tab) => tab.dataset.specificationTab === specificationId);
  if (!closingTab) return false;
  const closingIndex = tabs.indexOf(closingTab);
  const wasActive = group.dataset.activeSpecificationId === specificationId;
  const panel = group.querySelector(`[data-specification-panel="${specificationId}"]`);
  closingTab.closest(".specification-tab")?.remove();
  panel?.remove();

  if (!wasActive) {
    updateSpecificationGroupEmptyState(group);
    return true;
  }

  const remainingTabs = Array.from(group.querySelectorAll("[data-specification-tab]"));
  if (remainingTabs.length > 0) {
    const nextTab = remainingTabs[Math.min(closingIndex, remainingTabs.length - 1)];
    if (targetGroupWasActive) {
      return activateSpecificationTab(group, nextTab.dataset.specificationTab, true);
    }
    return activateSpecificationTabLocally(group, nextTab.dataset.specificationTab);
  }

  delete group.dataset.activeSpecificationId;
  resetSpecificationDragState();
  const survivingGroups = specificationEditorLayout
    ? Array.from(
      specificationEditorLayout.querySelectorAll("[data-specification-group]"),
    ).filter((candidate) => candidate !== group)
    : [];
  if (survivingGroups.length > 0) {
    const closestSurvivor = removeEmptySpecificationGroup(group);
    if (targetGroupWasActive) activateSurvivingSpecificationGroup(closestSurvivor);
    else if (activeSpecificationGroup !== previouslyActiveGroup) {
      setActiveSpecificationGroup(previouslyActiveGroup);
    }
    return true;
  }

  updateSpecificationGroupEmptyState(group);
  if (targetGroupWasActive) setActiveSpecificationGroup(group);
  else if (activeSpecificationGroup !== previouslyActiveGroup) {
    setActiveSpecificationGroup(previouslyActiveGroup);
  }
  return true;
};

const openSpecificationTab = (group, item) => {
  const href = safeSpecificationHref(item.href, item.id);
  const tabList = group?.querySelector("[data-specification-tab-list]");
  const panels = group?.querySelector("[data-specification-tab-panels]");
  if (!href || !tabList || !panels) return false;
  if (activateSpecificationTab(group, item.id)) return true;

  const displayName = item.name || item.id;
  const groupId = group.dataset.specificationGroupId;
  const tabId = `specification-group-${groupId}-tab-${item.id}`;
  const panelId = `specification-group-${groupId}-panel-${item.id}`;
  const tabChrome = document.createElement("div");
  tabChrome.className = "specification-tab";
  tabChrome.draggable = true;
  tabChrome.dataset.specificationTabChrome = item.id;
  const tab = document.createElement("button");
  tab.className = "specification-tab__activation";
  tab.type = "button";
  tab.id = tabId;
  tab.title = displayName;
  tab.setAttribute("role", "tab");
  tab.setAttribute("aria-label", displayName);
  tab.setAttribute("aria-selected", "false");
  tab.setAttribute("aria-controls", panelId);
  tab.tabIndex = -1;
  tab.dataset.specificationTab = item.id;
  tab.append(createSpecificationDocumentIcon());
  tab.append(createPlainText(displayName, "specification-tab__label"));
  const closeButton = document.createElement("button");
  closeButton.className = "specification-tab__close";
  closeButton.type = "button";
  closeButton.title = `${displayName} 닫기`;
  closeButton.setAttribute("aria-label", `${displayName} 닫기`);
  closeButton.dataset.specificationTabClose = item.id;
  closeButton.append(createSpecificationTabCloseIcon());
  tabChrome.append(tab, closeButton);
  tabChrome.addEventListener("dragstart", (event) => {
    if (event.target.closest("[data-specification-tab-close]")) {
      event.preventDefault();
      return;
    }
    resetSpecificationDragState();
    draggedSpecificationId = item.id;
    draggedSpecificationTab = { group, specificationId: item.id };
    tabChrome.classList.add("is-dragging");
    document.body.classList.add("is-dragging-specification");
    event.dataTransfer?.setData(specificationDragType, item.id);
    event.dataTransfer?.setData(specificationTabDragType, groupId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  });
  tabChrome.addEventListener("dragend", resetSpecificationDragState);

  const panel = document.createElement("section");
  panel.className = "specification-tab-panel";
  panel.id = panelId;
  panel.setAttribute("role", "tabpanel");
  panel.setAttribute("aria-labelledby", tabId);
  panel.dataset.specificationPanel = item.id;
  panel.hidden = true;
  const frame = document.createElement("iframe");
  frame.className = "specification-document-frame";
  frame.src = href.href;
  frame.title = `${displayName} 명세 문서`;
  frame.dataset.specificationFrame = item.id;
  frame.addEventListener("load", () => applySpecificationFrameProjection(frame));
  panel.append(frame);

  tab.addEventListener("click", () => activateSpecificationTab(group, item.id));
  tab.addEventListener("keydown", (event) => handleSpecificationTabKeydown(group, event));
  closeButton.addEventListener("pointerdown", (event) => event.stopPropagation());
  closeButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeSpecificationTab(group, item.id);
  });
  tabList.append(tabChrome);
  panels.append(panel);
  updateSpecificationGroupEmptyState(group);
  return activateSpecificationTab(group, item.id);
};

const specificationDropZone = (group, event) => {
  const bounds = group.getBoundingClientRect();
  const horizontal = (event.clientX - bounds.left) / Math.max(bounds.width, 1);
  const vertical = (event.clientY - bounds.top) / Math.max(bounds.height, 1);
  const edges = [
    ["left", horizontal],
    ["right", 1 - horizontal],
    ["top", vertical],
    ["bottom", 1 - vertical],
  ].filter(([, distance]) => distance < 0.25);
  edges.sort((a, b) => a[1] - b[1]);
  return edges[0]?.[0] || "center";
};

const clearSpecificationDropIndicators = () => {
  specificationEditorLayout?.classList.remove("is-drop-target");
  document.querySelectorAll("[data-specification-group][data-drop-zone]").forEach((group) => {
    delete group.dataset.dropZone;
  });
};

const resetSpecificationDragState = () => {
  draggedSpecificationId = null;
  draggedSpecificationTab = null;
  document.querySelectorAll(".specification-tab.is-dragging").forEach((tab) => {
    tab.classList.remove("is-dragging");
  });
  document.body.classList.remove("is-dragging-specification");
  clearSpecificationDropIndicators();
};

const draggedSpecification = (event) => {
  const id = event.dataTransfer?.getData(specificationDragType) || draggedSpecificationId;
  return id ? specificationItems.get(id) : null;
};

const reorderSpecificationTab = (group, specificationId, event) => {
  const tabList = group?.querySelector("[data-specification-tab-list]");
  const tab = group?.querySelector(
    `[data-specification-tab="${specificationId}"]`,
  )?.closest(".specification-tab");
  const target = event.target.closest(".specification-tab");
  if (!tabList || !tab || !target || target === tab || target.parentElement !== tabList) {
    return activateSpecificationTab(group, specificationId);
  }
  const bounds = target.getBoundingClientRect();
  const insertBeforeTarget = event.clientX < bounds.left + bounds.width / 2;
  tabList.insertBefore(tab, insertBeforeTarget ? target : target.nextSibling);
  return activateSpecificationTab(group, specificationId);
};

const moveSpecificationTab = (source, targetGroup, item, zone, event) => {
  const sourceGroup = source?.group;
  if (!sourceGroup?.isConnected || !sourceGroup.querySelector(
    `[data-specification-tab="${item.id}"]`,
  )) {
    placeSpecificationGroup(targetGroup, item, zone === "tabs" ? "center" : zone);
    return;
  }
  if (sourceGroup === targetGroup && zone === "tabs") {
    reorderSpecificationTab(sourceGroup, item.id, event);
    return;
  }
  if (sourceGroup === targetGroup && zone === "center") {
    activateSpecificationTab(sourceGroup, item.id);
    return;
  }
  placeSpecificationGroup(targetGroup, item, zone === "tabs" ? "center" : zone);
  const destinationGroup = activeSpecificationGroup;
  closeSpecificationTab(sourceGroup, item.id);
  if (destinationGroup?.isConnected) {
    activateSpecificationTab(destinationGroup, item.id);
  }
};

const createSpecificationGroup = (item) => {
  const group = specificationGroupTemplate?.content.firstElementChild?.cloneNode(true);
  if (!(group instanceof HTMLElement)) return null;
  group.dataset.specificationGroupId = String(nextSpecificationGroupId);
  nextSpecificationGroupId += 1;

  group.addEventListener("pointerdown", () => setActiveSpecificationGroup(group));
  group.addEventListener("focusin", (event) => {
    if (event.target.closest("[data-specification-tab-close]")) return;
    setActiveSpecificationGroup(group);
  });
  group.addEventListener("dragover", (event) => {
    if (!draggedSpecification(event)) return;
    event.preventDefault();
    event.stopPropagation();
    clearSpecificationDropIndicators();
    group.dataset.dropZone = event.target.closest("[data-specification-tab-list]")
      ? "tabs"
      : specificationDropZone(group, event);
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = draggedSpecificationTab ? "move" : "copy";
    }
  });
  group.addEventListener("dragleave", (event) => {
    if (!group.contains(event.relatedTarget)) delete group.dataset.dropZone;
  });
  group.addEventListener("drop", (event) => {
    const droppedItem = draggedSpecification(event);
    if (!droppedItem) {
      resetSpecificationDragState();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const zone = group.dataset.dropZone || specificationDropZone(group, event);
    const tabSource = draggedSpecificationTab;
    resetSpecificationDragState();
    if (tabSource) moveSpecificationTab(tabSource, group, droppedItem, zone, event);
    else placeSpecificationGroup(group, droppedItem, zone);
  });
  if (!openSpecificationTab(group, item)) return null;
  return group;
};

const placeSpecificationGroup = (targetGroup, item, zone = "center") => {
  if (!targetGroup || zone === "center") {
    const group = targetGroup || createSpecificationGroup(item);
    if (!group) return;
    if (!targetGroup) specificationEditorLayout?.append(group);
    else openSpecificationTab(group, item);
    if (specificationEditorEmpty) specificationEditorEmpty.hidden = true;
    return;
  }

  const newGroup = createSpecificationGroup(item);
  if (!newGroup) return;
  const split = document.createElement("div");
  const horizontal = zone === "left" || zone === "right";
  split.className = `specification-split specification-split--${horizontal ? "horizontal" : "vertical"}`;
  targetGroup.replaceWith(split);
  if (zone === "left" || zone === "top") split.append(newGroup, targetGroup);
  else split.append(targetGroup, newGroup);
  setActiveSpecificationGroup(newGroup);
};

const openSpecification = (item) => {
  const href = safeSpecificationHref(item.href, item.id);
  if (!href || !specificationEditorLayout) return;
  const targetGroup = activeSpecificationGroup
    || specificationEditorLayout.querySelector("[data-specification-group]");
  placeSpecificationGroup(targetGroup, item, "center");
  selectActivity("documents");
  selectDocumentView("specification-document");
};

const loadProcessedDocuments = async () => {
  if (!processedDocumentList || !processedTreeState) return;
  try {
    const response = await fetch("/api/processed-documents", {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!payload || !Array.isArray(payload.processedDocuments)) {
      throw new TypeError("가공 문서 응답 형식이 올바르지 않습니다.");
    }

    processedDocumentList.replaceChildren();
    payload.processedDocuments.forEach((rawItem) => {
      const item = {
        id: rawItem?.id == null ? "" : String(rawItem.id),
        name: rawItem?.name == null ? "" : String(rawItem.name),
        fullName: rawItem?.fullName == null ? "" : String(rawItem.fullName),
        href: rawItem?.href,
        status: rawItem?.status == null ? "missing-entry" : String(rawItem.status),
      };
      const fullName = item.fullName || item.name || item.id;
      const displayName = compactDocumentTitle(item.name || item.id, "가공 문서");
      const treeItem = document.createElement("li");
      treeItem.className = "document-tree__item";
      treeItem.setAttribute("role", "treeitem");
      treeItem.setAttribute("aria-level", "1");
      const href = item.status === "ready" && specificationIdPattern.test(item.id)
        ? safeProcessedDocumentHref(item.href, item.id)
        : null;
      if (href) {
        const link = document.createElement("a");
        link.className = "document-navigation__item";
        link.href = href.href;
        link.title = fullName;
        link.append(
          createSpecificationDocumentIcon(),
          createPlainText(displayName, "document-navigation__label"),
        );
        link.dataset.processedDocumentLink = item.id;
        link.addEventListener("click", (event) => {
          event.preventDefault();
          document.querySelectorAll("[data-processed-document-link]").forEach((candidate) => {
            const isCurrent = candidate === link;
            candidate.classList.toggle("is-selected", isCurrent);
            if (isCurrent) candidate.setAttribute("aria-current", "page");
            else candidate.removeAttribute("aria-current");
          });
          if (processedDocumentTitle) processedDocumentTitle.textContent = displayName;
          if (processedDocumentFrame) {
            processedDocumentFrame.title = fullName;
            processedDocumentFrame.src = href.href;
          }
          selectActivity("documents");
          selectDocumentView("processed-document");
        });
        treeItem.append(link);
      } else {
        const row = document.createElement("span");
        row.className = "document-navigation__item document-navigation__item--unavailable";
        row.title = `${fullName} · 브라우저 문서 없음`;
        row.append(
          createSpecificationDocumentIcon(),
          createPlainText(displayName, "document-navigation__label"),
        );
        treeItem.append(row);
      }
      processedDocumentList.append(treeItem);
    });

    if (payload.processedDocuments.length === 0) {
      processedTreeState.textContent = "가공 문서가 없습니다.";
      processedTreeState.hidden = false;
      processedDocumentList.hidden = true;
      return;
    }
    processedTreeState.hidden = true;
    processedDocumentList.hidden = false;
  } catch {
    processedDocumentList.hidden = true;
    processedTreeState.hidden = false;
    processedTreeState.textContent = "가공 문서를 불러오지 못했습니다.";
  }
};

const loadSpecifications = async () => {
  if (!specificationList || !specificationTreeState) return;
  try {
    const response = await fetch("/api/specifications", {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!payload || !Array.isArray(payload.specifications)) {
      throw new TypeError("명세 문서 응답 형식이 올바르지 않습니다.");
    }

    specificationList.replaceChildren();
    specificationItems.clear();
    payload.specifications.forEach((rawItem) => {
      const item = {
        id: rawItem?.id == null ? "" : String(rawItem.id),
        name: rawItem?.name == null ? "" : String(rawItem.name),
        href: rawItem?.href,
        status: rawItem?.status == null ? "misaligned" : String(rawItem.status),
      };
      const treeItem = document.createElement("li");
      treeItem.className = "document-tree__item";
      treeItem.setAttribute("role", "treeitem");
      treeItem.setAttribute("aria-level", "1");
      const href = item.status === "paired" && specificationIdPattern.test(item.id)
        ? safeSpecificationHref(item.href, item.id)
        : null;
      if (href) {
        specificationItems.set(item.id, item);
        const fullName = item.name || item.id;
        const displayName = compactDocumentTitle(fullName, "명세 문서");
        const link = document.createElement("a");
        link.className = "document-navigation__item";
        link.href = href.href;
        link.title = fullName;
        link.append(
          createSpecificationDocumentIcon(),
          createPlainText(displayName, "document-navigation__label"),
        );
        link.dataset.specificationLink = item.id;
        link.draggable = true;
        link.addEventListener("dragstart", (event) => {
          resetSpecificationDragState();
          draggedSpecificationId = item.id;
          draggedSpecificationTab = null;
          document.body.classList.add("is-dragging-specification");
          event.dataTransfer?.setData(specificationDragType, item.id);
          if (event.dataTransfer) event.dataTransfer.effectAllowed = "copy";
        });
        link.addEventListener("dragend", resetSpecificationDragState);
        link.addEventListener("click", (event) => {
          event.preventDefault();
          openSpecification(item);
        });
        treeItem.append(link);
        specificationList.append(treeItem);
        return;
      }
      const state = document.createElement("span");
      state.className = "document-tree__item-status";
      const fullName = item.name || item.id;
      state.textContent = compactDocumentTitle(fullName, "명세 문서");
      state.title = `${fullName} · ${specificationStatusLabel(item.status)}`;
      treeItem.append(state);
      specificationList.append(treeItem);
    });

    if (payload.specifications.length === 0) {
      specificationTreeState.textContent = "연결된 명세 문서가 없습니다.";
      specificationTreeState.hidden = false;
      specificationList.hidden = true;
      return;
    }
    specificationTreeState.textContent = `명세 문서 ${payload.specifications.length}개`;
    specificationTreeState.hidden = true;
    specificationList.hidden = false;
  } catch {
    specificationList.hidden = true;
    specificationTreeState.hidden = false;
    specificationTreeState.textContent = "명세 문서를 불러오지 못했습니다.";
  }
};

documentWorkspace?.addEventListener("dragover", (event) => {
  if (!draggedSpecification(event)) return;
  selectActivity("documents");
  selectDocumentView("specification-document");
});

specificationEditorLayout?.addEventListener("dragover", (event) => {
  if (event.target.closest("[data-specification-group]") || !draggedSpecification(event)) return;
  event.preventDefault();
  specificationEditorLayout.classList.add("is-drop-target");
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
});

specificationEditorLayout?.addEventListener("dragleave", (event) => {
  if (!specificationEditorLayout.contains(event.relatedTarget)) {
    specificationEditorLayout.classList.remove("is-drop-target");
  }
});

specificationEditorLayout?.addEventListener("drop", (event) => {
  if (event.target.closest("[data-specification-group]")) return;
  const item = draggedSpecification(event);
  if (!item) {
    resetSpecificationDragState();
    return;
  }
  event.preventDefault();
  const tabSource = draggedSpecificationTab;
  resetSpecificationDragState();
  if (tabSource) moveSpecificationTab(tabSource, null, item, "center", event);
  else placeSpecificationGroup(null, item, "center");
  selectActivity("documents");
  selectDocumentView("specification-document");
});

const selectActivity = (activity) => {
  if (!Object.hasOwn(activityTitles, activity)) return;
  if (activity !== "documents") resetSpecificationDragState();

  activityButtons.forEach((button) => {
    const isActive = button.dataset.activity === activity;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  sidebarViews.forEach((view) => {
    view.hidden = view.dataset.sidebarView !== activity;
  });
  workspaceViews.forEach((view) => {
    view.hidden = view.dataset.workspaceView !== activity;
  });
  if (sidebarTitle) sidebarTitle.textContent = activityTitles[activity];
};

const selectDocumentView = (target) => {
  const nextView = Array.from(documentViews).find(
    (view) => view.dataset.documentView === target,
  );
  if (!nextView) return;
  if (target !== "specification-document") resetSpecificationDragState();

  documentNavigationItems.forEach((item) => {
    const isCurrent = item.dataset.documentTarget === target;
    item.classList.toggle("is-selected", isCurrent);
    if (isCurrent) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });
  if (target !== "specification-document") {
    document.querySelectorAll("[data-specification-link]").forEach((item) => {
      item.classList.remove("is-selected");
      item.removeAttribute("aria-current");
    });
  }
  if (target !== "processed-document") {
    document.querySelectorAll("[data-processed-document-link]").forEach((item) => {
      item.classList.remove("is-selected");
      item.removeAttribute("aria-current");
    });
  }
  documentViews.forEach((view) => {
    view.hidden = view !== nextView;
  });
};

const setSidebarWidth = (width) => {
  if (!workspaceShell || !sidebarResizer) return;

  const activityBarWidth = Number.parseFloat(
    getComputedStyle(workspaceShell).getPropertyValue("--activity-bar-width"),
  );
  const availableWidth = Math.max(
    minimumSidebarWidth,
    workspaceShell.clientWidth - activityBarWidth - 96,
  );
  const nextWidth = Math.min(
    Math.max(width, minimumSidebarWidth),
    Math.min(maximumSidebarWidth, availableWidth),
  );

  workspaceShell.style.setProperty("--primary-sidebar-width", `${nextWidth}px`);
  sidebarResizer.setAttribute("aria-valuenow", String(Math.round(nextWidth)));
};

if (workspaceShell) {
  workspaceShell.dataset.ready = "true";
}

const externalIntegrationAdapter = window.agentFactoryWorkspace || {};
externalIntegrationAdapter.externalIntegrations = Object.freeze({
  replaceItems: replaceExternalIntegrations,
});
window.agentFactoryWorkspace = externalIntegrationAdapter;

activityButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectActivity(button.dataset.activity);
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && draggedSpecificationId) {
    event.preventDefault();
    resetSpecificationDragState();
  }
});

document.addEventListener("dragend", resetSpecificationDragState);
document.addEventListener("drop", resetSpecificationDragState);
window.addEventListener("blur", resetSpecificationDragState);

documentNavigationItems.forEach((item) => {
  item.addEventListener("click", (event) => {
    event.preventDefault();
    selectActivity("documents");
    selectDocumentView(item.dataset.documentTarget);
  });
});

documentGroupToggles.forEach((toggle) => {
  toggle.addEventListener("click", () => {
    const content = document.getElementById(toggle.getAttribute("aria-controls"));
    if (!content) return;
    const isExpanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!isExpanded));
    content.hidden = isExpanded;
  });
});

documentTreeToggles.forEach((toggle) => {
  toggle.addEventListener("click", () => {
    const content = document.getElementById(toggle.getAttribute("aria-controls"));
    if (!content) return;
    const isExpanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!isExpanded));
    content.hidden = isExpanded;
  });
});

selectDocumentView("specification-document");
initializeOriginalSearch();
loadSpecifications();
loadProcessedDocuments();

if (sidebarResizer) {
  sidebarResizer.addEventListener("pointerdown", (event) => {
    const startX = event.clientX;
    const initialWidth = Number.parseFloat(
      getComputedStyle(workspaceShell).getPropertyValue("--primary-sidebar-width"),
    );

    sidebarResizer.setPointerCapture(event.pointerId);
    sidebarResizer.classList.add("is-dragging");
    document.body.classList.add("is-resizing-sidebar");

    const resize = (moveEvent) => {
      setSidebarWidth(initialWidth + moveEvent.clientX - startX);
    };

    const stopResize = () => {
      sidebarResizer.classList.remove("is-dragging");
      document.body.classList.remove("is-resizing-sidebar");
      sidebarResizer.removeEventListener("pointermove", resize);
      sidebarResizer.removeEventListener("pointerup", stopResize);
      sidebarResizer.removeEventListener("pointercancel", stopResize);
    };

    sidebarResizer.addEventListener("pointermove", resize);
    sidebarResizer.addEventListener("pointerup", stopResize);
    sidebarResizer.addEventListener("pointercancel", stopResize);
  });

  sidebarResizer.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    event.preventDefault();
    const currentWidth = Number(sidebarResizer.getAttribute("aria-valuenow"));
    setSidebarWidth(currentWidth + (event.key === "ArrowLeft" ? -16 : 16));
  });
}
