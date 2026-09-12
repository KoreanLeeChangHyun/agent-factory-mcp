const workspaceShell = document.querySelector("[data-workspace-shell]");
const activityBar = document.querySelector(".activity-bar");
const primarySidebar = document.querySelector("[data-sidebar-host]");
const sidebarResizer = document.querySelector("[data-sidebar-resizer]");
const activityButtons = document.querySelectorAll("[data-activity]");
const activityContextMenu = document.querySelector("[data-activity-context-menu]");
const sidebarTitle = document.querySelector("[data-sidebar-title]");
const documentConnectorsButton = document.querySelector("[data-document-connectors]");
const workspaceViews = document.querySelectorAll("[data-workspace-view]");
const documentNavigationItems = document.querySelectorAll("[data-document-target]");
const documentViews = document.querySelectorAll("[data-document-view]");
const sidebarSectionToggles = document.querySelectorAll("[data-sidebar-section-toggle]");
const originalSearchInput = document.querySelector("[data-original-global-search]");
const originalSearchState = document.querySelector("[data-original-search-state]");
const originalSearchFailure = document.querySelector("[data-original-search-failure]");
const originalTableElement = document.querySelector("[data-original-table]");
const originalTableFallback = document.querySelector("[data-original-table-fallback]");
const specificationList = document.querySelector("[data-specification-list]");
const specificationTreeState = document.getElementById("specification-tree-state");
const processedList = document.querySelector("[data-processed-list]");
const processedTreeState = document.getElementById("processed-tree-state");
const organizationSelect = document.querySelector("[data-organization-select]");
const currentUser = document.querySelector("[data-current-user]");
const currentUserEmail = document.querySelector("[data-current-user-email]");
const logoutButton = document.querySelector("[data-logout]");
const profileControl = document.querySelector("[data-profile-control]");
const profileToggle = document.querySelector("[data-profile-toggle]");
const profileMenu = document.querySelector("[data-profile-menu]");
const profileAvatar = document.querySelector("[data-profile-avatar]");
const profileName = document.querySelector("[data-profile-name]");
const accountAvatar = document.querySelector("[data-account-avatar]");
const accountName = document.querySelector("[data-account-name]");
const accountEmail = document.querySelector("[data-account-email]");
const accountOrganization = document.querySelector("[data-account-organization]");
const accountWorkspace = document.querySelector("[data-account-workspace]");
const headerWorkspace = document.querySelector("[data-header-workspace]");
const rootPath = new URL("../", document.baseURI).pathname.replace(/\/$/, "");
const tenant = { organizationId: null, workspaceId: null };
const minimumSidebarWidth = 180;
const maximumSidebarWidth = 520;
const defaultSidebarWidth = Number.parseFloat(
  getComputedStyle(workspaceShell).getPropertyValue("--primary-sidebar-width"),
) || 280;
const activityTitles = {
  organization: "조직",
  workspaces: "작업공간",
  schedule: "일정",
  agents: "에이전트",
  documents: "문서",
  logs: "로그",
  tests: "테스트",
  integrations: "연동",
  database: "DB",
  account: "계정",
  admin: "슈퍼 관리자",
};
const sidebarHost = window.agentFactoryUI.bindSidebarHost(primarySidebar, {
  header: sidebarTitle.closest("header"),
  body: document.querySelector("[data-sidebar-content]"),
  title: sidebarTitle,
  items: Array.from(document.querySelectorAll("[data-sidebar-view]"), (element) => ({
    id: element.dataset.sidebarView,
    title: activityTitles[element.dataset.sidebarView],
    element,
  })),
  defaultTitle: "작업공간",
});
const activityOrderKey = "agentFactoryActivityOrder";
const activityVisibilityKey = "agentFactoryActivityVisibility";
const activityStateVersion = 1;
let activityUserId = "";
const activityPreferenceKey = (key) => `${key}:${activityUserId}:${tenant.organizationId}:${tenant.workspaceId}`;
const activityStateKey = (activity, workspaceScoped) => `agentFactoryActivityState:v${activityStateVersion}:${activityUserId}:${tenant.organizationId}:${workspaceScoped ? tenant.workspaceId : "organization"}:${activity}`;
const activityState = (activity, workspaceScoped = true) => Object.freeze({
  read(fallback = {}) {
    if (!activityUserId || !tenant.organizationId || (workspaceScoped && !tenant.workspaceId) || !Object.hasOwn(activityTitles, activity)) return fallback;
    const value = storedJson(activityStateKey(activity, workspaceScoped), fallback);
    return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
  },
  write(patch) {
    if (!activityUserId || !tenant.organizationId || (workspaceScoped && !tenant.workspaceId) || !Object.hasOwn(activityTitles, activity)) return;
    const current = this.read({});
    try {
      localStorage.setItem(activityStateKey(activity, workspaceScoped), JSON.stringify({ ...current, ...patch }));
    } catch { /* Local UI restoration is best effort. */ }
  },
});
const sidebarState = (activity) => activityState(activity, !["organization", "workspaces"].includes(activity));
const currentSidebarActivity = () => {
  if (workspaceShell.dataset.mode === "organization") return "organization";
  if (workspaceShell.dataset.sidebar === "workspaces") return "workspaces";
  return document.querySelector("[data-activity].is-active")?.dataset.activity || null;
};
const rememberSidebarState = (activity = currentSidebarActivity()) => {
  if (!activity) return;
  const width = Number.parseFloat(getComputedStyle(workspaceShell).getPropertyValue("--primary-sidebar-width"));
  sidebarState(activity).write({
    ...(Number.isFinite(width) ? {sidebarWidth:Math.round(width)} : {}),
    sidebarCollapsed: workspaceShell.dataset.sidebarCollapsed === "true",
  });
};
const restoreSidebarState = (activity, forceOpen = false) => {
  const saved = sidebarState(activity).read({});
  const hasSavedVisibility = typeof saved.sidebarCollapsed === "boolean";
  const expanded = forceOpen || (hasSavedVisibility ? saved.sidebarCollapsed !== true : activity !== "schedule");
  setSidebarWidth(Number.isFinite(saved.sidebarWidth) ? saved.sidebarWidth : defaultSidebarWidth, false);
  setSidebarExpanded(expanded, forceOpen);
};
const defaultActivityOrder = Array.from(activityButtons, (button) => button.dataset.activity);
const selectionStorageKey = () => `agentFactorySelection:${activityUserId}:${tenant.organizationId}`;
const workbenchRollbackKey = (workspaceId) => `agent-factory:workbench-rollback:v1:${activityUserId}:${tenant.organizationId}:${workspaceId}`;
const savedWorkspaceView = () => {
  try { return JSON.parse(localStorage.getItem(selectionStorageKey())) || null; }
  catch { return null; }
};
const rememberWorkspaceView = () => {
  if (!activityUserId || !tenant.organizationId || !tenant.workspaceId) return;
  const view = {
    workspaceId: tenant.workspaceId,
    mode: workspaceShell.dataset.mode,
    activity: document.querySelector("[data-activity].is-active")?.dataset.activity
      || document.querySelector("[data-workspace-view]:not([hidden])")?.dataset.workspaceView || null,
    documentView: document.querySelector("[data-document-view]:not([hidden])")?.dataset.documentView,
    processedId: document.querySelector('[data-processed-link][aria-current="page"]')?.dataset.processedLink,
    specificationId: document.querySelector('[data-specification-link][aria-current="page"]')?.dataset.specificationLink,
  };
  try { localStorage.setItem(selectionStorageKey(), JSON.stringify(view)); } catch { /* Storage may be unavailable. */ }
  if (view.activity === "documents") {
    activityState("documents").write({
      view: view.documentView || null,
      processedId: view.processedId || null,
      specificationId: view.specificationId || null,
    });
  }
};
let platformAdmin = false;
let pendingActivityDrop = null;

const originalSearchFields = [
  "classification",
  "provider",
  "tags",
  "name",
  "extension",
  "modifiedAt",
];

const cookie = (name) => document.cookie
  .split("; ")
  .find((value) => value.startsWith(`${name}=`))
  ?.split("=")
  .slice(1)
  .join("=");

const api = async (path, options = {}) => {
  const csrfToken = cookie("agent_factory_csrf");
  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(csrfToken ? { "X-CSRF-Token": decodeURIComponent(csrfToken) } : {}),
    ...options.headers,
  };
  const response = await fetch(`${rootPath}${path}`, {
    credentials: "same-origin",
    ...options,
    headers,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload.error?.message || payload.message || response.statusText || "요청에 실패했습니다.");
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
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
      if (activityUserId && tenant.organizationId && tenant.workspaceId) {
        activityState("documents").write({originalSearch: originalSearchInput?.value.slice(0, 200) || ""});
      }
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

const createDocumentFileIcon = () => {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const path = document.createElementNS(namespace, "path");
  path.setAttribute("d", "M3.25 1.75h6l3.5 3.5v9H3.25ZM9.25 1.75v3.5h3.5");
  svg.append(path);
  return svg;
};

let documentEditor;
const loadDocuments = async () => {
  const version = ++documentLoadVersion;
  if (!tenant.organizationId || !tenant.workspaceId) return;
  const base = `/api/organizations/${tenant.organizationId}/workspaces/${tenant.workspaceId}/documents`;
  try {
    const documents = await api(base);
    if (version !== documentLoadVersion) return;
    if (!Array.isArray(documents)) throw new TypeError("문서 응답 형식이 올바르지 않습니다.");
    const originalRows = documents.filter((item) => item.document_type === "original").map((item) => {
      const metadata = item.document_metadata || {};
      return {
        classification: metadata.classification || "원본 문서",
        provider: metadata.provider || metadata.source || "—",
        tags: metadata.tags || [],
        name: item.title,
        extension: metadata.extension || "—",
        modifiedAt: new Date(item.updated_at).toLocaleString("ko-KR"),
        sourceUrl: metadata.source_url || "",
        sourceIdentity: item.id,
      };
    });
    window.agentFactoryWorkspace?.originalSearch?.replaceRows(originalRows);
    documentEditor.setDocuments(documents, `${rootPath}${base}`);
  } catch {
    if (version !== documentLoadVersion) return;
    for (const [list, state, label] of [[processedList, processedTreeState, "가공"], [specificationList, specificationTreeState, "명세"]]) {
      list.hidden = true;
      state.hidden = false;
      state.textContent = `${label} 문서를 불러오지 못했습니다.`;
    }
  }
};

const storedJson = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};

const orderedActivityButtons = () => Array.from(activityBar?.querySelectorAll("[data-activity]") || []);

const saveActivityOrder = () => {
  try { localStorage.setItem(activityPreferenceKey(activityOrderKey), JSON.stringify(orderedActivityButtons().map((button) => button.dataset.activity))); }
  catch { /* Local UI restoration is best effort. */ }
};

const applyActivityOrder = () => {
  if (!activityBar) return;
  const candidateOrder = storedJson(activityPreferenceKey(activityOrderKey), []);
  const storedOrder = Array.isArray(candidateOrder) ? candidateOrder : [];
  const buttons = orderedActivityButtons();
  const defaultOrder = defaultActivityOrder;
  const knownActivities = new Set(defaultOrder);
  const mergedOrder = storedOrder.filter((activity, index) =>
    knownActivities.has(activity) && storedOrder.indexOf(activity) === index,
  );
  defaultOrder.forEach((activity, defaultIndex) => {
    if (mergedOrder.includes(activity)) return;
    const nextActivity = defaultOrder.slice(defaultIndex + 1).find((candidate) => mergedOrder.includes(candidate));
    if (nextActivity) mergedOrder.splice(mergedOrder.indexOf(nextActivity), 0, activity);
    else mergedOrder.push(activity);
  });
  const rank = new Map(mergedOrder.map((activity, index) => [activity, index]));
  buttons
    .sort((left, right) => (rank.get(left.dataset.activity) ?? 99) - (rank.get(right.dataset.activity) ?? 99))
    .forEach((button) => activityBar.append(button));
};

const activityVisibility = () => {
  const visibility = storedJson(activityPreferenceKey(activityVisibilityKey), {});
  return visibility && typeof visibility === "object" && !Array.isArray(visibility) ? visibility : {};
};

const applyActivityVisibility = () => {
  const workspaceButton = document.querySelector("[data-workspace-picker-toggle]");
  workspaceButton.hidden = false;
  const organizationButton = document.querySelector("[data-open-organizations]");
  organizationButton.classList.toggle("is-active", workspaceShell.dataset.mode === "organization");
  organizationButton.setAttribute("aria-pressed", String(workspaceShell.dataset.mode === "organization"));
  workspaceButton.classList.toggle("is-active", (workspaceShell.dataset.mode === "picker" || (workspaceShell.dataset.mode === "workspace" && workspaceShell.dataset.sidebar === "workspaces")));
  workspaceButton.setAttribute("aria-pressed", String(workspaceShell.dataset.mode === "picker" || (workspaceShell.dataset.mode === "workspace" && workspaceShell.dataset.sidebar === "workspaces")));
  const visibility = activityVisibility();
  activityButtons.forEach((button) => {
    const activity = button.dataset.activity;
    const permitted = activity !== "admin" || platformAdmin;
    button.hidden = !tenant.workspaceId || !permitted || visibility[activity] === false;
  });
};

const setActivityVisibility = (activity, visible) => {
  if (!tenant.workspaceId) return;
  const visibility = activityVisibility();
  visibility[activity] = visible;
  try { localStorage.setItem(activityPreferenceKey(activityVisibilityKey), JSON.stringify(visibility)); }
  catch { /* Local UI restoration is best effort. */ }
  applyActivityVisibility();
  const active = document.querySelector("[data-activity].is-active");
  if (!active || active.hidden) {
    const fallback = orderedActivityButtons().find((button) => !button.hidden);
    selectActivity(fallback?.dataset.activity || null);
  }
};

let activityMenuCleanup = null, activityMenuOrigin = null;
const closeActivityContextMenu = (restoreFocus = false) => {
  activityMenuCleanup?.(); activityMenuCleanup = null;
  if (activityContextMenu) activityContextMenu.hidden = true;
  if (restoreFocus) {
    const target = activityMenuOrigin?.isConnected && activityMenuOrigin.matches('button,[tabindex]') && activityMenuOrigin.getClientRects().length && !activityMenuOrigin.disabled
      ? activityMenuOrigin : document.querySelector('[data-activity]:not([hidden]):not(:disabled)') || document.querySelector('[data-configure-activities]:not([hidden])');
    target?.focus();
  }
  activityMenuOrigin = null;
};

const openActivityContextMenu = (x, y, origin = activityBar) => {
  if (!tenant.workspaceId || !activityContextMenu) return;
  closeActivityContextMenu();
  activityMenuOrigin = origin;
  const activities = Object.keys(activityTitles).filter((activity) => activity !== "admin" || platformAdmin);
  const visibility = activityVisibility();
  activityContextMenu.replaceChildren(...activities.map((activity) => {
    const checked = visibility[activity] !== false;
    const button = window.agentFactoryUI.button({label:activityTitles[activity]});
    button.setAttribute('role','menuitemcheckbox');button.setAttribute('aria-checked',String(checked));
    button.dataset.activityVisibility = activity;
    const icon = window.agentFactoryUI.icon('check');icon.toggleAttribute('hidden',!checked);
    button.prepend(icon);
    return button;
  }));
  activityContextMenu.hidden = false;
  activityMenuCleanup = window.agentFactoryPositioning.positionMenu(activityContextMenu,{origin,x,y});
  activityContextMenu.querySelector("button")?.focus();
};

const moveActivity = (button, direction) => {
  const buttons = orderedActivityButtons().filter((candidate) => !candidate.hidden);
  const index = buttons.indexOf(button);
  const target = buttons[index + direction];
  if (!target || !activityBar) return;
  if (direction < 0) activityBar.insertBefore(button, target);
  else activityBar.insertBefore(target, button);
  saveActivityOrder();
  button.focus();
};

const clearActivityDropIndicator = () => {
  activityButtons.forEach((button) => button.classList.remove("is-drop-before", "is-drop-after"));
  pendingActivityDrop = null;
};

const showActivityDropIndicator = (target, position) => {
  if (pendingActivityDrop?.target === target && pendingActivityDrop.position === position) return;
  clearActivityDropIndicator();
  target.classList.add(position === "before" ? "is-drop-before" : "is-drop-after");
  pendingActivityDrop = { target, position };
};

const selectActivity = (activity, forceOpen = false) => {
  rememberSidebarState();
  if (activity !== "admin") window.agentFactoryAdmin?.reset();
  if (activity !== null && !Object.hasOwn(activityTitles, activity)) return;
  if (activity !== null && activity !== "workspaces") window.agentFactoryMCPConnection?.dismiss();
  documentEditor?.clearDrag();
  documentEditor?.closeMenu(false);
  workspaceShell.dataset.sidebar = activity === "workspaces" || activity === null ? "workspaces" : "activity";
  workspaceShell.dataset.mode = activity === "organization" ? "organization" : activity === "workspaces" && !tenant.workspaceId ? "picker" : "workspace";
  applyActivityVisibility();
  const hasActivities = orderedActivityButtons().some((button) => !button.hidden);
  document.querySelector("[data-no-activities]").hidden = activity !== null || hasActivities;
  document.querySelector("[data-no-activities] p").textContent = hasActivities
    ? "왼쪽 작업 표시줄에서 사용할 기능을 선택하세요."
    : "표시할 작업 아이콘이 없습니다.";
  document.querySelector("[data-configure-activities]").hidden = hasActivities;
  if (!["account", "admin"].includes(activity) && ["#admin", "#account"].includes(location.hash)) {
    history.replaceState(null, "", location.pathname + location.search);
  }

  activityButtons.forEach((button) => {
    const isActive = button.dataset.activity === activity;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  sidebarHost.select(activity);
  workspaceViews.forEach((view) => {
    view.hidden = view.dataset.workspaceView !== activity;
  });
  document.querySelector("[data-plan-header-actions]").hidden = activity !== "schedule";
  document.querySelector("[data-integration-header-actions]").hidden = activity !== "integrations";
  document.querySelector("[data-workspace-header-actions]").hidden = activity !== "workspaces";
  if (documentConnectorsButton) documentConnectorsButton.hidden = activity !== "documents";
  restoreSidebarState(activity || "workspaces", forceOpen);
  rememberWorkspaceView();
};

const selectDocumentView = (target) => {
  if (["processed-document", "specification-document"].includes(target)) target = "document-editor";
  if (target !== "document-editor") documentEditor?.clearDrag();
  const nextView = Array.from(documentViews).find(
    (view) => view.dataset.documentView === target,
  );
  if (!nextView) return;

  documentNavigationItems.forEach((item) => {
    const isCurrent = item.dataset.documentTarget === target;
    item.classList.toggle("is-selected", isCurrent);
    if (isCurrent) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });
  if (target !== "document-editor") {
    document.querySelectorAll("[data-specification-link]").forEach((item) => {
      item.classList.remove("is-selected");
      item.removeAttribute("aria-current");
    });
  }
  if (target !== "document-editor") {
    document.querySelectorAll("[data-processed-link]").forEach((item) => {
      item.classList.remove("is-selected");
      item.removeAttribute("aria-current");
    });
  }
  documentViews.forEach((view) => {
    view.hidden = view !== nextView;
  });
  if (target === "document-editor") documentEditor?.syncSelection();
  rememberWorkspaceView();
};

const setSidebarWidth = (width, persist = true) => {
  if (!workspaceShell || !sidebarResizer) return;

  if (width < minimumSidebarWidth) {
    setSidebarExpanded(false, persist);
    return;
  }

  const activityBarWidth = Number.parseFloat(
    getComputedStyle(workspaceShell).getPropertyValue("--activity-bar-width"),
  );
  const availableWidth = Math.max(
    minimumSidebarWidth,
    workspaceShell.clientWidth - activityBarWidth - 112,
  );
  const nextWidth = Math.min(
    Math.max(width, minimumSidebarWidth),
    Math.min(maximumSidebarWidth, availableWidth),
  );

  workspaceShell.style.setProperty("--primary-sidebar-width", `${nextWidth}px`);
  if (workspaceShell.dataset.sidebarCollapsed === "true") setSidebarExpanded(true, persist);
  sidebarResizer.setAttribute("aria-valuenow", String(Math.round(nextWidth)));
  if (persist) rememberSidebarState();
};

const setSidebarExpanded = (expanded, persist = true) => {
  if (!workspaceShell || !primarySidebar) return;
  workspaceShell.dataset.sidebarCollapsed = String(!expanded);
  primarySidebar.hidden = !expanded;
  if (sidebarResizer) {
    sidebarResizer.hidden = false;
    const width = Number.parseFloat(
      getComputedStyle(workspaceShell).getPropertyValue("--primary-sidebar-width"),
    );
    sidebarResizer.setAttribute("aria-valuenow", String(expanded && Number.isFinite(width) ? Math.round(width) : 0));
  }
  if (persist) rememberSidebarState();
};

const populateSelect = (select, rows) => {
  if (!select) return;
  select.replaceChildren(...rows.map((row) => {
    const option = document.createElement("option");
    option.value = row.id;
    option.textContent = row.name;
    return option;
  }));
};

let workspaceRows = [];
let recentRows = [];
let workspaceGroupRows = [];
let organizationRows = [];
let workspaceLoadVersion = 0;
let documentLoadVersion = 0;
const listState = document.querySelector("[data-workspace-list-state]");
const createDialog = document.querySelector("[data-create-dialog]");
const createDialogUI = window.agentFactoryUI.bindNativeDialog(createDialog);
const createForm = document.querySelector("[data-create-form]");
const createName = createForm.elements.name;
const createNameLabel = createForm.querySelector('label[for="workspace-name"]');
createNameLabel.replaceWith(window.agentFactoryUI.fieldFor({label:'작업공간 이름',control:createName}).root);

const resetWorkspaceDocuments = () => {
  documentLoadVersion += 1;
  documentEditor?.reset();
  processedList?.replaceChildren();
  specificationList?.replaceChildren();
  window.agentFactoryWorkspace?.originalSearch?.replaceRows([]);
  selectDocumentView("original-overview");
};

const showWorkspaceList = (focus = false) => {
  activityButtons.forEach((button) => {
    button.classList.remove("is-active");
    button.setAttribute("aria-pressed", "false");
  });
  selectActivity("workspaces", focus);
  if (tenant.workspaceId) window.agentFactoryMCPConnection?.show();
  applyActivityVisibility();
  if (!tenant.workspaceId) accountWorkspace.textContent = "—";
  history.replaceState(null, "", location.pathname + location.search);
  closeActivityContextMenu();
  rememberWorkspaceView();
  if (focus) document.querySelector("[data-workspace-list] [role='treeitem'], .workspace-picker-sidebar [data-create-workspace]")?.focus();
};

const renderWorkspaceMetadata = record => {
  const owner = organizationRows.find(row => row.id === record.organization_id);
  const date = value => { const parsed = new Date(value); return value && !Number.isNaN(parsed.valueOf()) ? parsed.toLocaleString() : '—'; };
  const fields = [
    ['이름', record.name], ['소속', owner?.is_personal ? '개인' : owner?.name || '—'],
    ['작업공간 상태', { active: '활성', inactive: '비활성' }[record.status] || record.status || '—'],
    ['식별 이름', record.slug || '—'], ['생성일', date(record.created_at)], ['수정일', date(record.updated_at)],
    ['작업공간 ID', record.id],
  ];
  document.querySelector('[data-workspace-metadata]').replaceChildren(...fields.map(([label, value]) => {
    const item = document.createElement('div');
    const term = document.createElement('dt'); term.textContent = label;
    const description = document.createElement('dd'); description.textContent = value; description.title = value;
    item.append(term, description); return item;
  }));
};

let workspaceRenameMenu = null;
let workspaceRenamePositionCleanup = null, workspaceRenameOrigin = null;
const closeWorkspaceRenameMenu = (restore = false) => {
  workspaceRenamePositionCleanup?.(); workspaceRenamePositionCleanup = null;
  workspaceRenameMenu?.remove(); workspaceRenameMenu = null;
  if (restore && workspaceRenameOrigin?.isConnected) workspaceRenameOrigin.focus();
  workspaceRenameOrigin = null;
};
const openRenameMenu = (event, rename) => {
  event.preventDefault(); event.stopPropagation(); closeWorkspaceRenameMenu();
  const menu = document.createElement('div'); menu.className = 'activity-context-menu af-popover af-kit'; menu.setAttribute('role', 'menu');
  const action = window.agentFactoryUI.button({label:'이름 변경'}); action.setAttribute('role', 'menuitem');
  action.addEventListener('click', rename); menu.append(action);
  workspaceRenameMenu = menu; workspaceRenameOrigin = event.currentTarget;
  document.body.append(menu);
  workspaceRenamePositionCleanup = window.agentFactoryPositioning.positionMenu(menu,{
    origin:workspaceRenameOrigin,x:event.clientX || undefined,y:event.clientY || undefined,
  });
  menu.onkeydown = window.agentFactoryUI.menuKeyboard({items:() => [action],close:() => closeWorkspaceRenameMenu(true)});
  action.focus();
};
const renameWorkspaceGroup = (label, group) => {
  closeWorkspaceRenameMenu();
  if (!label.isConnected) return;
  const origin = label.closest('[role="treeitem"]') || label;
  const form = document.createElement('form'); form.className = 'workspace-rename';
  const input = document.createElement('input'); input.value = group.name; input.maxLength = 60; input.required = true;
  input.setAttribute('aria-label', '그룹 이름 변경');
  const error = document.createElement('span'); error.setAttribute('role', 'alert');
  form.append(input, error); label.replaceWith(form); input.focus(); input.select();
  form.addEventListener('click', event => event.stopPropagation());
  form.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); form.replaceWith(label); origin.focus(); }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault(); event.stopPropagation();
    const name = input.value.trim(); const groups = workspaceGroups();
    if (!name || groups.some(item => item.id !== group.id && item.name === name)) {
      error.textContent = name ? '같은 이름의 그룹이 있습니다.' : '그룹 이름을 입력하세요.'; return;
    }
    input.disabled = true;
    try {
      const updated = await api(`/api/organizations/${tenant.organizationId}/workspaces/groups/${group.id}`, {
        method: 'PATCH', body: JSON.stringify({ name, revision: group.revision }),
      });
      const item = workspaceGroupRows.find(item => item.id === group.id);
      if (!item) return;
      Object.assign(item, updated, { workspace_ids: item.workspace_ids });
      renderWorkspaces();
      document.querySelector(`[data-workspace-group-id="${group.id}"]`)?.focus();
    } catch (failure) {
      error.textContent = failure.status === 409 ? '다른 곳에서 변경되었거나 같은 이름의 그룹이 있습니다.' : '저장하지 못했습니다. 다시 시도하세요.';
      input.disabled = false; input.focus();
    }
  });
};

const renameWorkspace = (button, record) => {
  closeWorkspaceRenameMenu();
  const origin = button.closest('[role="treeitem"]') || button;
  const organizationId = tenant.organizationId;
  const form = document.createElement('form'); form.className = 'workspace-rename';
  const input = document.createElement('input'); input.value = record.name; input.maxLength = 200; input.required = true;
  input.setAttribute('aria-label', '작업공간 이름 변경');
  const error = document.createElement('span'); error.setAttribute('role', 'alert');
  form.append(input, error); button.replaceWith(form); input.focus(); input.select();
  let saving = false;
  const restore = () => { if (form.isConnected) { form.replaceWith(button); origin.focus(); } };
  input.addEventListener('keydown', event => { if (event.key === 'Escape' && !saving) { event.preventDefault(); restore(); } });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (saving) return;
    const name = input.value.trim();
    if (!name) { error.textContent = '이름을 입력하세요.'; return; }
    if (name === record.name) { restore(); return; }
    saving = true; input.disabled = true; error.textContent = '';
    try {
      const updated = await api(`/api/organizations/${organizationId}/workspaces/${record.id}`, { method: 'PUT', body: JSON.stringify({ name, revision: record.revision }) });
      if (tenant.organizationId !== organizationId) return;
      workspaceRows = workspaceRows.map(row => row.id === record.id ? { ...row, ...updated } : row);
      recentRows = recentRows.map(row => row.id === record.id ? { ...row, ...updated } : row);
      if (tenant.workspaceId === record.id) {
        renderWorkspaceMetadata(updated);
        accountWorkspace.textContent = updated.name;
        headerWorkspace.textContent = updated.name; headerWorkspace.title = updated.name;
        window.agentFactoryMCPConnection?.rename(updated.name);
      }
      renderWorkspaces();
      document.querySelector(`[data-workspace-list] [data-workspace-id="${record.id}"]`)?.focus();
    } catch (failure) {
      if (tenant.organizationId !== organizationId) return;
      error.textContent = failure.status === 409 ? '다른 곳에서 변경되었습니다. 새로고침 후 다시 시도하세요.' : failure.status === 403 ? '이름을 변경할 권한이 없습니다.' : '저장하지 못했습니다. 다시 시도하세요.';
      input.disabled = false; input.focus();
    } finally { saving = false; }
  });
};
document.addEventListener('pointerdown', event => { if (workspaceRenameMenu && !workspaceRenameMenu.contains(event.target)) closeWorkspaceRenameMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeWorkspaceRenameMenu(true); });

const workspaceRow = (record, { panel = false } = {}) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = panel ? "ui-button ui-button--link workspace-recent-row" : "app-sidebar__row workspace-row";
  button.dataset.workspaceId = record.id;
  button.title = record.name;
  button.setAttribute("aria-current", String(record.id === tenant.workspaceId));
  button.append(createDocumentFileIcon(), createPlainText(record.name));
  button.addEventListener("click", () => enterWorkspace(record.id));
  button.addEventListener('keydown', event => {
    if (event.key === 'F2') { event.preventDefault(); renameWorkspace(button, record); }
  });
  button.addEventListener('contextmenu', event => openRenameMenu(event, () => renameWorkspace(button, record)));
  return button;
};

// Personal list organization is authoritative server state, scoped by user and organization.
const workspaceGroups = () => workspaceGroupRows;
const moveWorkspaceToGroup = async (id, groupId) => {
  if (!workspaceRows.some(row => row.id === id)) return;
  try {
    const path = groupId
      ? `/api/organizations/${tenant.organizationId}/workspaces/groups/${groupId}/workspaces/${id}`
      : `/api/organizations/${tenant.organizationId}/workspaces/groups/workspaces/${id}`;
    await api(path, { method: groupId ? 'PUT' : 'DELETE' });
    for (const group of workspaceGroupRows) {
      group.workspace_ids = group.workspace_ids.filter(value => value !== id);
      if (group.id === groupId) group.workspace_ids.push(id);
    }
    renderWorkspaces();
  } catch {
    listState.textContent = '그룹 이동을 저장하지 못했습니다.';
  }
};
const groupDropTarget = (element, groupId) => {
  if (!element) return;
  if (element.dataset.workspaceDropBound === 'true') return;
  element.dataset.workspaceDropBound = 'true';
  element.addEventListener("dragover", event => {
    if (!event.dataTransfer.types.includes("application/x-agent-factory-workspace")) return;
    event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = "move";
    element.classList.add("is-drop-target");
  });
  element.addEventListener("dragleave", event => {
    if (!element.contains(event.relatedTarget)) element.classList.remove("is-drop-target");
  });
  element.addEventListener("drop", event => {
    element.classList.remove("is-drop-target");
    const id = event.dataTransfer.getData("application/x-agent-factory-workspace");
    if (!id) return;
    event.preventDefault(); event.stopPropagation(); void moveWorkspaceToGroup(id, groupId);
  });
};
let workspaceExplorer = null;
let workspaceDefaultExpanded = true;
const renderWorkspaces = () => {
  closeWorkspaceRenameMenu();
  workspaceExplorer?.destroy();
  const groups = workspaceGroups();
  const grouped = new Set(groups.flatMap(group => group.workspace_ids));
  const records = new Map(workspaceRows.map(record => [record.id, record]));
  const workspaceItem = record => ({
    id: `workspace:${record.id}`,
    label: record.name,
    selected: record.id === tenant.workspaceId,
  });
  const items = [
    {
      id: 'workspace-group:default',
      label: '기본 그룹',
      selectable: false,
      expanded: workspaceDefaultExpanded,
      children: workspaceRows.filter(record => !grouped.has(record.id)).map(workspaceItem),
    },
    ...groups.map(group => ({
      id: `workspace-group:${group.id}`,
      label: group.name,
      selectable: false,
      expanded: !group.collapsed,
      children: workspaceRows.filter(record => group.workspace_ids.includes(record.id)).map(workspaceItem),
    })),
  ];
  const decorateWorkspaceRow = (element, record) => {
    element.classList.add('workspace-explorer__workspace');
    element.dataset.workspaceId = record.id;
    element.setAttribute('aria-current', String(record.id === tenant.workspaceId));
    element.draggable = true;
    element.addEventListener("dragstart", event => {
      element.classList.add("is-dragging");
      event.dataTransfer.setData("application/x-agent-factory-workspace", record.id);
      event.dataTransfer.effectAllowed = "move";
    });
    element.addEventListener("dragend", () => {
      element.classList.remove("is-dragging");
      document.querySelectorAll(".is-drop-target").forEach(target => target.classList.remove("is-drop-target"));
    });
    const label = element.querySelector(':scope > .af-explorer-line .af-explorer-name');
    element.addEventListener('keydown', event => {
      if (event.key === 'F2') { event.preventDefault(); event.stopPropagation(); renameWorkspace(label, record); }
    });
    element.addEventListener('contextmenu', event => openRenameMenu(event, () => renameWorkspace(label, record)));
  };
  const explorer = window.agentFactoryUI.explorerTree({
    label: '작업공간 탐색기',
    items,
    multiSelect: false,
    renderIcon: () => null,
    onSelect: keys => {
      const key = keys.find(value => value.startsWith('workspace:'));
      if (key) void enterWorkspace(key.slice('workspace:'.length));
    },
    onActivate: key => {
      const id = key.startsWith('workspace:') ? key.slice('workspace:'.length) : '';
      if (id && tenant.workspaceId !== id) void enterWorkspace(id);
    },
    onToggle: async (key, expanded) => {
      if (key === 'workspace-group:default') { workspaceDefaultExpanded = expanded; return; }
      if (!key.startsWith('workspace-group:')) return;
      const group = groups.find(item => item.id === key.slice('workspace-group:'.length));
      if (!group || group.collapsed === !expanded) return;
      const previous = group.collapsed;
      group.collapsed = !expanded;
      try {
        const updated = await api(`/api/organizations/${tenant.organizationId}/workspaces/groups/${group.id}`, {
          method: 'PATCH', body: JSON.stringify({ collapsed: group.collapsed, revision: group.revision }),
        });
        Object.assign(group, updated, { workspace_ids: group.workspace_ids });
      } catch {
        group.collapsed = previous;
        renderWorkspaces();
        listState.textContent = '그룹 상태를 저장하지 못했습니다.';
      }
    },
    onRender: rows => rows.forEach(row => {
      if (row.key.startsWith('workspace:')) {
        const record = records.get(row.key.slice('workspace:'.length));
        if (record) decorateWorkspaceRow(row.element, record);
        return;
      }
      const line = row.element.querySelector(':scope > .af-explorer-line');
      if (row.key === 'workspace-group:default') {
        row.element.classList.add('workspace-ungrouped');
        row.element.dataset.workspaceDefaultGroup = '';
        groupDropTarget(line, '');
        return;
      }
      const group = groups.find(item => `workspace-group:${item.id}` === row.key);
      if (!group) return;
      row.element.classList.add('workspace-group');
      row.element.dataset.workspaceGroupId = group.id;
      const label = line.querySelector('.af-explorer-name');
      row.element.addEventListener('contextmenu', event => openRenameMenu(event, () => renameWorkspaceGroup(label, group)));
      row.element.addEventListener('keydown', event => {
        if (event.key === 'F2') { event.preventDefault(); event.stopPropagation(); renameWorkspaceGroup(label, group); }
      });
      groupDropTarget(line, group.id);
    }),
  });
  document.querySelector("[data-workspace-explorer]").replaceChildren(explorer.root);
  workspaceExplorer = explorer;
  listState.textContent = !workspaceRows.length ? "작업공간이 없습니다. 새로 만들어 시작하세요." : "";
  document.querySelector("[data-recent-workspaces]").replaceChildren(...recentRows.map(record => workspaceRow(record, { panel: true })));
  document.querySelector("[data-recent-state]").hidden = recentRows.length > 0;
};
const groupForm = document.querySelector("[data-workspace-group-form]");
document.querySelector("[data-create-workspace-group]").addEventListener("click", () => {
  groupForm.hidden = false; groupForm.reset(); groupForm.querySelector("p").textContent = "";
  groupForm.querySelector("input").focus();
});
groupForm.addEventListener("keydown", event => {
  if (event.key === "Escape") { event.preventDefault(); groupForm.hidden = true; document.querySelector("[data-create-workspace-group]").focus(); }
});
groupForm.addEventListener("submit", async event => {
  event.preventDefault();
  const name = groupForm.querySelector("input").value.trim();
  const groups = workspaceGroups();
  if (!name || groups.some(group => group.name === name)) {
    groupForm.querySelector("p").textContent = name ? "같은 이름의 그룹이 있습니다." : "그룹 이름을 입력하세요."; return;
  }
  const input = groupForm.querySelector('input'); input.disabled = true;
  try {
    const created = await api(`/api/organizations/${tenant.organizationId}/workspaces/groups`, {
      method: 'POST', body: JSON.stringify({ name }),
    });
    workspaceGroupRows.push(created);
    groupForm.hidden = true; renderWorkspaces();
  } catch (failure) {
    groupForm.querySelector('p').textContent = failure.status === 409 ? '같은 이름의 그룹이 있습니다.' : '그룹을 저장하지 못했습니다.';
  } finally { input.disabled = false; }
});

const enterWorkspace = async (id) => {
  closeWorkspaceRenameMenu();
  const record = workspaceRows.find((row) => row.id === id);
  if (!record) return;
  tenant.workspaceId = id;
  const saved = savedWorkspaceView();
  try {
    const selection = await api(`/api/organizations/${tenant.organizationId}/workspaces/${id}/workbench/selection`);
    const rollbackKey = workbenchRollbackKey(id);
    const legacyOnce = sessionStorage.getItem(rollbackKey) === "legacy-once";
    if (legacyOnce) sessionStorage.removeItem(rollbackKey);
    else if (selection.mode === "react") {
      rememberWorkspaceView();
      const query = new URLSearchParams();
      if (typeof saved?.workbenchTaskId === "string") query.set("task", saved.workbenchTaskId);
      if (typeof saved?.workbenchDocumentId === "string") query.set("document", saved.workbenchDocumentId);
      const suffix = query.size ? `?${query}` : "";
      location.assign(`${rootPath}/workspace/${encodeURIComponent(tenant.organizationId)}/${encodeURIComponent(id)}/entry${suffix}`);
      return;
    }
  } catch {
    // Selection errors retain the fail-safe legacy Workspace.
  }
  resetWorkspaceDocuments();
  const documentPreferences = activityState("documents");
  documentEditor?.setPreferences(documentPreferences);
  if (originalSearchInput) {
    const restoredSearch = documentPreferences.read({}).originalSearch;
    originalSearchInput.value = typeof restoredSearch === "string" ? restoredSearch.slice(0, 200) : "";
    originalSearchInput.dispatchEvent(new Event("input"));
  }
  renderWorkspaceMetadata(record);
  document.querySelectorAll("[data-workspace-id]").forEach(button => button.setAttribute("aria-current", String(button.dataset.workspaceId === id)));
  window.agentFactoryMCPConnection.open({ api, userId: activityUserId, organizationId: tenant.organizationId, workspaceId: id, name: record.name, rootPath });
  window.agentFactoryAdmin?.setPreferences?.(activityState("admin"));
  window.agentFactoryPlanning?.open({
    api, organizationId: tenant.organizationId, workspaceId: id,
    preferences: activityState("schedule"),
  });
  window.agentFactoryIntegrations?.open({
    api, organizationId: tenant.organizationId, workspaceId: id, workspaceName: record.name,
    preferences: activityState("integrations"),
    reloadDocuments: loadDocuments,
    showOriginals: () => { selectActivity("documents", true); selectDocumentView("original-search"); },
  });
  const reportingOrganization = tenant.organizationId;
  window.agentFactoryReporting?.open({
    api, organizationId: reportingOrganization, workspaceId: id,
    preferences: activityState("agents"),
    navigate: async (kind, targetId) => {
      const current = () => tenant.organizationId === reportingOrganization && tenant.workspaceId === id;
      if (!current()) return;
      if (kind === "plan") {
        const opened = await window.agentFactoryPlanning.openItem(targetId);
        if (current() && opened) selectActivity("schedule", true);
      } else {
        await loadDocuments();
        if (!current()) return;
        const record = documentEditor.docs.get(targetId);
        if (record?.href) { selectActivity("documents", true); documentEditor.open(targetId); }
        else {
          // Original Documents use their authenticated immutable content endpoint.
          const doc = await api(`/api/organizations/${reportingOrganization}/workspaces/${id}/documents/${encodeURIComponent(targetId)}`);
          if (!current()) return;
          if (!doc.current_revision_number) throw new Error("문서에 읽을 수 있는 리비전이 없습니다.");
          location.assign(`${rootPath}/api/organizations/${reportingOrganization}/workspaces/${id}/documents/${encodeURIComponent(targetId)}/revisions/${doc.current_revision_number}/content`);
        }
      }
    },
  });
  accountWorkspace.textContent = record.name;
  headerWorkspace.textContent = record.name;
  headerWorkspace.title = record.name;
  headerWorkspace.hidden = false;
  workspaceShell.dataset.mode = "workspace";
  applyActivityOrder();
  applyActivityVisibility();
  selectActivity("workspaces");
  try {
    sidebarSectionToggles.forEach(toggle => {
      const content = document.getElementById(toggle.getAttribute('aria-controls'));
      if (!content) return;
      const expanded = localStorage.getItem(activityPreferenceKey('expanded:' + content.id));
      if (expanded !== null) { toggle.setAttribute('aria-expanded', expanded); content.hidden = expanded !== 'true'; }
    });
  } catch { /* Local UI preferences are optional. */ }
  const organizationId = tenant.organizationId;
  void api(`/api/organizations/${organizationId}/workspaces/${id}/visits`, { method: "POST" }).then(() => {
    if (tenant.organizationId !== organizationId) return;
    recentRows = [record, ...recentRows.filter((row) => row.id !== id)].slice(0, 20);
    renderWorkspaces();
  }).catch(() => {
    document.querySelector("[data-recent-state]").textContent = "최근 사용 기록을 저장하지 못했습니다.";
    document.querySelector("[data-recent-state]").hidden = false;
  });
  await loadDocuments();
};

const loadWorkspaces = async () => {
  closeWorkspaceRenameMenu();
  renderOrganizationIdentity();
  groupForm.hidden = true;
  const saved = savedWorkspaceView();
  const version = ++workspaceLoadVersion;
  tenant.workspaceId = null;
  headerWorkspace.textContent = ""; headerWorkspace.title = ""; headerWorkspace.hidden = true;
  window.agentFactoryMCPConnection.reset();
  window.agentFactoryPlanning?.reset();
  window.agentFactoryIntegrations?.reset();
  window.agentFactoryReporting?.reset();
  resetWorkspaceDocuments();
  showWorkspaceList();
  workspaceRows = [];
  recentRows = [];
  workspaceGroupRows = [];
  workspaceDefaultExpanded = true;
  renderWorkspaces();
  document.querySelector("[data-retry-workspaces]").hidden = true;
  if (!tenant.organizationId) return;
  listState.textContent = "작업공간을 불러오는 중입니다.";
  const base = `/api/organizations/${tenant.organizationId}/workspaces`;
  const [listed, recent, groups] = await Promise.allSettled([
    api(base), api(`${base}/recent`), api(`${base}/groups`),
  ]);
  if (version !== workspaceLoadVersion) return;
  if (listed.status === "rejected") {
    listState.textContent = "작업공간을 불러오지 못했습니다.";
    document.querySelector("[data-retry-workspaces]").hidden = false;
    return;
  }
  workspaceRows = listed.value.filter((row) => row.status !== "inactive");
  recentRows = recent.status === "fulfilled" ? recent.value.filter((row) => workspaceRows.some((item) => item.id === row.id)) : [];
  workspaceGroupRows = groups.status === 'fulfilled' ? groups.value : [];
  renderWorkspaces();
  if (recent.status === "rejected") document.querySelector("[data-recent-state]").textContent = "최근 목록을 불러오지 못했습니다.";
  if (groups.status === 'rejected') listState.textContent = '그룹을 불러오지 못했습니다.';
  if (saved && workspaceRows.some((row) => row.id === saved.workspaceId)) {
    await enterWorkspace(saved.workspaceId);
    if (version !== workspaceLoadVersion || tenant.workspaceId !== saved.workspaceId) return;
    const target = Array.from(activityButtons).find((button) => button.dataset.activity === saved.activity && !button.hidden);
    if (target) {
      selectActivity(target.dataset.activity);
      if (target.dataset.activity === "account") window.agentFactoryAdmin?.profile();
      if (target.dataset.activity === "admin") window.agentFactoryAdmin?.open();
    }
    if (saved.activity === "organization") openOrganizationManagement();
    const documentLink = Array.from(document.querySelectorAll("[data-processed-link], [data-specification-link]"))
      .find((link) => (["processed-document", "document-editor"].includes(saved.documentView) && saved.processedId && link.dataset.processedLink === saved.processedId)
        || (["specification-document", "document-editor"].includes(saved.documentView) && saved.specificationId && link.dataset.specificationLink === saved.specificationId));
    if (saved.activity === "documents" && documentLink && ["processed-document", "specification-document", "document-editor"].includes(saved.documentView)) documentLink.click();
    else if (saved.documentView && !["processed-document", "specification-document"].includes(saved.documentView)) selectDocumentView(saved.documentView);
    if (saved.mode === "picker") showWorkspaceList();
  } else if (saved) {
    try { localStorage.removeItem(selectionStorageKey()); } catch { /* Storage may be unavailable. */ }
  }
};

const renderOrganizationIdentity = () => {
  const row = organizationRows.find(item => item.id === tenant.organizationId);
  const header = document.querySelector("[data-header-organization]");
  header.hidden = !row;
  header.textContent = row ? (row.is_personal ? "개인" : row.name) : "";
  header.title = row ? `${row.name} · ${row.slug}` : "";
  document.querySelector("[data-organization-identity]").hidden = !row;
  document.querySelector("[data-organization-name]").textContent = row?.is_personal ? "개인" : row?.name || "";
  document.querySelector("[data-organization-slug]").textContent = row?.slug ? `@${row.slug}` : "";
  document.querySelector("[data-organization-copy-status]").textContent = "";
};
document.querySelector("[data-copy-organization-slug]").addEventListener("click", async () => {
  const slug = organizationRows.find(item => item.id === tenant.organizationId)?.slug;
  if (!slug) return;
  const status = document.querySelector("[data-organization-copy-status]");
  try {
    await navigator.clipboard.writeText(slug);
    if (slug === organizationRows.find(item => item.id === tenant.organizationId)?.slug) status.textContent = "복사했습니다.";
  } catch {
    if (slug === organizationRows.find(item => item.id === tenant.organizationId)?.slug) status.textContent = "식별자를 선택해 복사해 주세요.";
  }
});

const renderOrganizations = () => {
  const options = organizationRows.map((row) => ({ ...row, name: row.is_personal ? "개인" : row.name }));
  if (!organizationRows.some((row) => row.is_personal)) options.unshift({ id: "", name: "개인" });
  populateSelect(organizationSelect, options);
  organizationSelect.disabled = options.length <= 1;
  organizationSelect.title = "개인 또는 조직 선택";
};

const showCreateWorkspace = () => {
  createForm.reset();
  document.querySelector("[data-create-error]").textContent = "";
  document.querySelector("[data-create-owner]").textContent = organizationSelect.selectedOptions[0]?.textContent || "개인";
  createDialogUI.open({initialFocus:createName});
};

document.querySelectorAll("[data-create-workspace]").forEach((button) => button.addEventListener("click", showCreateWorkspace));
createForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = createForm.elements.name.value.trim();
  if (!name) { document.querySelector("[data-create-error]").textContent = "이름을 입력해 주세요."; return; }
  const submit = createForm.querySelector('[type="submit"]');
  if (submit.disabled) return;
  submit.disabled = true;
  submit.setAttribute("aria-busy", "true");
  const startingOrganization = tenant.organizationId;
  const startingVersion = workspaceLoadVersion;
  try {
    const path = tenant.organizationId ? `/api/organizations/${tenant.organizationId}/workspaces` : "/api/account/personal-workspaces";
    const created = await api(path, { method: "POST", body: JSON.stringify({ name, slug: `workspace-${crypto.randomUUID()}` }) });
    if (startingVersion !== workspaceLoadVersion || tenant.organizationId !== startingOrganization) return;
    if (!startingOrganization) {
      organizationRows = await api("/api/account/organizations");
      if (startingVersion !== workspaceLoadVersion || tenant.organizationId !== startingOrganization) return;
      tenant.organizationId = created.organization_id;
      renderOrganizations();
      organizationSelect.value = tenant.organizationId;
      accountOrganization.textContent = organizationSelect.selectedOptions[0]?.textContent || "개인";
    }
    createDialogUI.close();
    const createdOrganization = tenant.organizationId;
    const expectedVersion = workspaceLoadVersion + 1;
    await loadWorkspaces();
    if (workspaceLoadVersion !== expectedVersion || tenant.organizationId !== createdOrganization) return;
    if (!workspaceRows.some((row) => row.id === created.id)) workspaceRows.push(created);
    renderWorkspaces();
    await enterWorkspace(created.id);
  } catch (error) {
    if (startingVersion !== workspaceLoadVersion || tenant.organizationId !== startingOrganization) return;
    document.querySelector("[data-create-error]").textContent = error.status === 403 ? "이 공간에 작업공간을 만들 권한이 없습니다." : "작업공간을 만들지 못했습니다. 다시 시도해 주세요.";
  } finally { submit.disabled = false; submit.removeAttribute("aria-busy"); }
});
const openOrganizationManagement = (view = "overview", forceOpen = false) => {
  selectActivity("organization", forceOpen);
  const preferences = activityState("organization", false);
  const restoredView = view === "overview" ? preferences?.read({}).view || view : view;
  window.agentFactoryOrganizations?.open({ api, organizationId: tenant.organizationId, userId: activityUserId,
    preferences,
    openWorkspace: enterWorkspace,
    createWorkspace: showCreateWorkspace,
    changed: async (id) => {
      organizationRows = await api("/api/account/organizations");
      renderOrganizations();
      tenant.organizationId = organizationRows.some(row => row.id === id) ? id
        : organizationRows.find(row => row.is_personal)?.id || organizationRows[0]?.id || null;
      organizationSelect.value = tenant.organizationId || "";
      accountOrganization.textContent = organizationSelect.selectedOptions[0]?.textContent || "—";
      if (tenant.organizationId) localStorage.setItem(`agentFactoryOrganizationId:${activityUserId}`, tenant.organizationId);
      else localStorage.removeItem(`agentFactoryOrganizationId:${activityUserId}`);
      await loadWorkspaces();
      openOrganizationManagement(view);
    },
  }, restoredView);
};
document.querySelector("[data-open-organizations]").addEventListener("click", () => {
  openOrganizationManagement("overview", true);
  organizationSelect.focus();
});
document.querySelectorAll("[data-open-workspaces]").forEach((button) => button.addEventListener("click", () => showWorkspaceList(true)));
document.querySelector("[data-retry-workspaces]").addEventListener("click", () => bootAuthentication());
createDialog.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => createDialogUI.close()));


const openWorkspace = async (session) => {
  activityUserId = session.user.id;
  const initialHash = location.hash;
  const invitationOrganization = new URLSearchParams(location.search).get("organization_invite");
  const invitationToken = new URLSearchParams(initialHash.slice(1)).get("invitation");
  if (invitationOrganization && invitationToken) {
    // Save across a login redirect without leaving the capability in the address bar.
    sessionStorage.setItem("agentFactoryPendingInvitation", JSON.stringify({organizationId:invitationOrganization, token:invitationToken}));
    history.replaceState(null, "", location.pathname);
  }
  let pendingInvitation;
  try { pendingInvitation = JSON.parse(sessionStorage.getItem("agentFactoryPendingInvitation") || "null"); } catch { /* Ignore invalid browser storage. */ }
  if (pendingInvitation) {
    try {
      await api(`/api/organizations/${encodeURIComponent(pendingInvitation.organizationId)}/accept-invitation`, {method:"POST", body:JSON.stringify({token:pendingInvitation.token})});
      localStorage.setItem(`agentFactoryOrganizationId:${activityUserId}`, pendingInvitation.organizationId);
      sessionStorage.removeItem("agentFactoryPendingInvitation");
    } catch (error) {
      if (error.status === 409) sessionStorage.removeItem("agentFactoryPendingInvitation");
      window.alert(error.message);
    }
  }
  if (currentUser) currentUser.textContent = session.user.display_name;
  if (currentUserEmail) currentUserEmail.textContent = session.user.email;
  if (profileName) profileName.textContent = session.user.display_name;
  if (profileAvatar) profileAvatar.textContent = session.user.display_name.trim().slice(0, 1).toUpperCase();
  if (accountAvatar) accountAvatar.textContent = session.user.display_name.trim().slice(0, 1).toUpperCase();
  if (accountName) accountName.textContent = session.user.display_name;
  if (accountEmail) accountEmail.textContent = session.user.email;
  if (profileControl) profileControl.hidden = false;
  platformAdmin = session.user.is_platform_admin;
  applyActivityVisibility();

  const organizations = await api("/api/account/organizations");
  organizationRows = organizations;
  renderOrganizations();
  document.querySelectorAll("[data-create-workspace]").forEach((button) => { button.disabled = false; });
  let savedOrganization = null;
  try { savedOrganization = localStorage.getItem(`agentFactoryOrganizationId:${activityUserId}`); }
  catch { /* Organization restoration is optional. */ }
  tenant.organizationId = organizations.some((item) => item.id === savedOrganization)
    ? savedOrganization
    : organizations.find((row) => row.is_personal)?.id || organizations[0]?.id || null;
  if (organizationSelect) organizationSelect.value = tenant.organizationId || "";
  if (accountOrganization) accountOrganization.textContent = organizationSelect?.selectedOptions[0]?.textContent || "—";
  await loadWorkspaces();
  if (session.user.is_platform_admin && initialHash === "#admin") {
    workspaceShell.dataset.mode = "workspace";
    selectActivity("admin");
    window.agentFactoryAdmin?.open();
  } else if (initialHash === "#account") {
    workspaceShell.dataset.mode = "workspace";
    selectActivity("account");
    window.agentFactoryAdmin?.profile();
  }
};

const bootAuthentication = async () => {
  try {
    const session = await api("/api/auth/me");
    await openWorkspace(session);
  } catch (error) {
    if (error.status === 401) window.location.replace(`${rootPath}/login/`);
    else { listState.textContent = "계정 정보를 불러오지 못했습니다."; document.querySelector("[data-retry-workspaces]").hidden = false; }
  }
};

if (workspaceShell) {
  workspaceShell.dataset.ready = "true";
}

documentEditor = new window.AgentFactoryDocumentEditor({
  host: document.querySelector("#document-editor"),
  rootPath,
  reveal: () => {
    if (document.querySelector('[data-activity="documents"]')?.getAttribute("aria-pressed") !== "true") selectActivity("documents", true);
    selectDocumentView("document-editor");
  },
  onSelection: () => rememberWorkspaceView(),
});

applyActivityOrder();
applyActivityVisibility();
document.querySelector("[data-configure-activities]").addEventListener("click", (event) => {
  event.stopPropagation();
  const bounds = activityBar.getBoundingClientRect();
  openActivityContextMenu(bounds.right, bounds.top, event.currentTarget);
});

documentConnectorsButton?.addEventListener("click", () => {
  setActivityVisibility("integrations", true);
  selectActivity("integrations", true);
  document.querySelector('[data-activity="integrations"]')?.focus();
});

activityButtons.forEach((button) => {
  button.draggable = true;
  button.addEventListener("click", () => {
    const activity = button.dataset.activity;
    const forceOpen = activity !== "schedule" || button.getAttribute("aria-pressed") === "true";
    selectActivity(activity, forceOpen);
    if (button.dataset.activity === "account") window.agentFactoryAdmin?.profile();
    if (button.dataset.activity === "admin") window.agentFactoryAdmin?.open();
  });
  button.addEventListener("dragstart", (event) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", button.dataset.activity);
    button.classList.add("is-dragging");
  });
  button.addEventListener("dragend", () => {
    button.classList.remove("is-dragging");
    clearActivityDropIndicator();
  });
  button.addEventListener("keydown", (event) => {
    if (!event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    moveActivity(button, event.key === "ArrowUp" ? -1 : 1);
  });
});

activityBar?.addEventListener("dragover", (event) => {
  const dragging = activityBar.querySelector(".is-dragging");
  const target = event.target.closest("[data-activity]");
  if (!dragging) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  if (!target || dragging === target) {
    clearActivityDropIndicator();
    return;
  }
  const before = event.clientY < target.getBoundingClientRect().top + target.offsetHeight / 2;
  showActivityDropIndicator(target, before ? "before" : "after");
});

activityBar?.addEventListener("dragleave", (event) => {
  if (!activityBar.contains(event.relatedTarget)) clearActivityDropIndicator();
});

activityBar?.addEventListener("drop", (event) => {
  const dragging = activityBar.querySelector(".is-dragging");
  if (!dragging || !pendingActivityDrop) return;
  event.preventDefault();
  const { target, position } = pendingActivityDrop;
  activityBar.insertBefore(dragging, position === "before" ? target : target.nextSibling);
  saveActivityOrder();
  clearActivityDropIndicator();
  dragging.focus();
});

activityBar?.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  openActivityContextMenu(event.clientX, event.clientY, event.target.closest('button') || activityBar);
});

activityContextMenu?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-activity-visibility]");
  if (!button) return;
  event.stopPropagation();
  const activity = button.dataset.activityVisibility;
  setActivityVisibility(activity, button.getAttribute("aria-checked") !== "true");
  const checked = activityVisibility()[activity] !== false;
  button.setAttribute('aria-checked',String(checked));
  button.querySelector('svg').toggleAttribute('hidden',!checked);
});

activityContextMenu?.addEventListener('keydown', window.agentFactoryUI.menuKeyboard({
  items:() => [...activityContextMenu.querySelectorAll('[role="menuitemcheckbox"]')],close:closeActivityContextMenu,
}));
window.addEventListener('pagehide', () => closeActivityContextMenu());

let profilePositionCleanup = null;
function closeProfileMenu(restoreFocus = false) {
  profilePositionCleanup?.(); profilePositionCleanup = null;
  profileToggle?.setAttribute('aria-expanded','false');
  if (profileMenu) profileMenu.hidden = true;
  if (restoreFocus) profileToggle?.focus();
}
function openProfileMenu() {
  if (!profileMenu || !profileToggle) return;
  closeProfileMenu();
  profileMenu.hidden = false;
  profileToggle.setAttribute('aria-expanded','true');
  profilePositionCleanup = window.agentFactoryPositioning.positionMenu(profileMenu,{origin:profileToggle});
  profileMenu.querySelector('[role="menuitem"]:not(:disabled)')?.focus();
}
profileToggle?.addEventListener('click', () => {
  if (profileMenu?.hidden) openProfileMenu(); else closeProfileMenu(true);
});
profileToggle?.addEventListener('keydown', event => {
  if (['ArrowDown','ArrowUp'].includes(event.key)) {event.preventDefault();openProfileMenu();}
});
profileMenu?.addEventListener('keydown', window.agentFactoryUI.menuKeyboard({
  items:() => [...profileMenu.querySelectorAll('[role="menuitem"]')], close:closeProfileMenu,
}));
window.addEventListener('pagehide', () => closeProfileMenu());

document.addEventListener("click", (event) => {
  if (!profileControl?.contains(event.target)) {
    closeProfileMenu();
  }
  if (!activityContextMenu?.contains(event.target)) closeActivityContextMenu();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (profileMenu && !profileMenu.hidden) {
    closeProfileMenu(true);
  }
  closeActivityContextMenu();
});

documentNavigationItems.forEach((item) => {
  item.addEventListener("click", (event) => {
    event.preventDefault();
    selectActivity("documents", true);
    selectDocumentView(item.dataset.documentTarget);
  });
});

sidebarSectionToggles.forEach((toggle) => {
  toggle.addEventListener("click", () => {
    const content = document.getElementById(toggle.getAttribute("aria-controls"));
    if (!content) return;
    const isExpanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!isExpanded));
    content.hidden = isExpanded;
    try { localStorage.setItem(activityPreferenceKey("expanded:" + content.id), String(!isExpanded)); } catch {}
  });
});

selectDocumentView("original-overview");
initializeOriginalSearch();
bootAuthentication();

logoutButton?.addEventListener("click", async () => {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } finally {
    window.location.assign(`${rootPath}/login/`);
  }
});

organizationSelect?.addEventListener("change", async () => {
  const wasOrganization = workspaceShell.dataset.mode === "organization";
  window.agentFactoryOrganizations?.reset();
  tenant.organizationId = organizationSelect.value || null;
  if (tenant.organizationId) {
    try { localStorage.setItem(`agentFactoryOrganizationId:${activityUserId}`, tenant.organizationId); }
    catch { /* Organization restoration is optional. */ }
  }
  if (accountOrganization) accountOrganization.textContent = organizationSelect.selectedOptions[0]?.textContent || "—";
  await loadWorkspaces();
  if (wasOrganization) openOrganizationManagement();
});

document.addEventListener("keydown", (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== "b") return;
  if (event.target.closest?.("input, textarea, select, [contenteditable='true']")) return;
  event.preventDefault();
  setSidebarExpanded(workspaceShell?.dataset.sidebarCollapsed === "true");
});



if (sidebarResizer) {
  const sidebarResize = window.agentFactoryUI.bindResizeHandle(sidebarResizer,{
    getValue:() => workspaceShell.dataset.sidebarCollapsed === 'true'
      ? minimumSidebarWidth
      : Number.parseFloat(getComputedStyle(workspaceShell).getPropertyValue('--primary-sidebar-width')),
    onChange:setSidebarWidth,
    onDragging:dragging => document.body.classList.toggle('is-resizing-sidebar',dragging),
    step:16,
  });
  window.addEventListener('pagehide', () => sidebarResize.cancel());
}
