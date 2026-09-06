const workspaceShell = document.querySelector("[data-workspace-shell]");
const activityBar = document.querySelector(".activity-bar");
const sidebarResizer = document.querySelector("[data-sidebar-resizer]");
const activityButtons = document.querySelectorAll("[data-activity]");
const activityContextMenu = document.querySelector("[data-activity-context-menu]");
const sidebarTitle = document.querySelector("[data-sidebar-title]");
const documentConnectorsButton = document.querySelector("[data-document-connectors]");
const sidebarViews = document.querySelectorAll("[data-sidebar-view]");
const workspaceViews = document.querySelectorAll("[data-workspace-view]");
const documentNavigationItems = document.querySelectorAll("[data-document-target]");
const documentViews = document.querySelectorAll("[data-document-view]");
const documentGroupToggles = document.querySelectorAll("[data-document-group-toggle]");
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
const activityTitles = {
  schedule: "일정",
  agents: "에이전트",
  documents: "문서",
  logs: "로그",
  tests: "테스트",
  integrations: "연동",
  database: "DB",
  account: "계정",
  admin: "관리자",
};
const activityOrderKey = "agentFactoryActivityOrder";
const activityVisibilityKey = "agentFactoryActivityVisibility";
let activityUserId = "";
const activityPreferenceKey = (key) => `${key}:${activityUserId}:${tenant.organizationId}:${tenant.workspaceId}`;
const defaultActivityOrder = Array.from(activityButtons, (button) => button.dataset.activity);
const selectionStorageKey = () => `agentFactorySelection:${activityUserId}:${tenant.organizationId}`;
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
  localStorage.setItem(activityPreferenceKey(activityOrderKey), JSON.stringify(orderedActivityButtons().map((button) => button.dataset.activity)));
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
  localStorage.setItem(activityPreferenceKey(activityVisibilityKey), JSON.stringify(visibility));
  applyActivityVisibility();
  const active = document.querySelector("[data-activity].is-active");
  if (!active || active.hidden) {
    const fallback = orderedActivityButtons().find((button) => !button.hidden);
    selectActivity(fallback?.dataset.activity || null);
  }
};

const closeActivityContextMenu = () => {
  if (activityContextMenu) activityContextMenu.hidden = true;
};

const openActivityContextMenu = (x, y) => {
  if (!tenant.workspaceId) return;
  if (!activityContextMenu) return;
  const activities = Object.keys(activityTitles).filter((activity) => activity !== "admin" || platformAdmin);
  const visibility = activityVisibility();
  activityContextMenu.innerHTML = activities.map((activity) => {
    const checked = visibility[activity] !== false;
    return `<button type="button" role="menuitemcheckbox" aria-checked="${checked}" data-activity-visibility="${activity}"><svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"${checked ? "" : " hidden"}><path d="m3.5 8 3 3 6-6"/></svg><span>${activityTitles[activity]}</span></button>`;
  }).join("");
  activityContextMenu.hidden = false;
  const width = activityContextMenu.offsetWidth;
  const height = activityContextMenu.offsetHeight;
  activityContextMenu.style.left = `${Math.max(6, Math.min(x, window.innerWidth - width - 6))}px`;
  activityContextMenu.style.top = `${Math.max(6, Math.min(y, window.innerHeight - height - 6))}px`;
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
  activityButtons.forEach((button) => {
    button.classList.remove("is-drop-before", "is-drop-after");
  });
  pendingActivityDrop = null;
};

const showActivityDropIndicator = (target, position) => {
  if (pendingActivityDrop?.target === target && pendingActivityDrop.position === position) return;
  clearActivityDropIndicator();
  target.classList.add(position === "before" ? "is-drop-before" : "is-drop-after");
  pendingActivityDrop = { target, position };
};

const selectActivity = (activity) => {
  if (activity !== null && !Object.hasOwn(activityTitles, activity)) return;
  if (activity !== null) window.agentFactoryMCPConnection?.dismiss();
  documentEditor?.clearDrag();
  documentEditor?.closeMenu(false);
  workspaceShell.dataset.sidebar = activity === null ? "workspaces" : "activity";
  if (tenant.workspaceId) {
    workspaceShell.dataset.mode = "workspace";
    applyActivityVisibility();
  }
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
  sidebarViews.forEach((view) => {
    view.hidden = view.dataset.sidebarView !== activity;
  });
  workspaceViews.forEach((view) => {
    view.hidden = view.dataset.workspaceView !== activity;
  });
  if (sidebarTitle) sidebarTitle.textContent = activityTitles[activity] || "작업공간";
  document.querySelector("[data-plan-header-actions]").hidden = activity !== "schedule";
  if (documentConnectorsButton) documentConnectorsButton.hidden = activity !== "documents";
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

const setSidebarWidth = (width) => {
  if (!workspaceShell || !sidebarResizer) return;

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
  sidebarResizer.setAttribute("aria-valuenow", String(Math.round(nextWidth)));
  try { localStorage.setItem(activityPreferenceKey("sidebarWidth"), String(nextWidth)); } catch {}
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
let organizationRows = [];
let workspaceLoadVersion = 0;
let documentLoadVersion = 0;
const listState = document.querySelector("[data-workspace-list-state]");
const createDialog = document.querySelector("[data-create-dialog]");
const createForm = document.querySelector("[data-create-form]");

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
  workspaceShell.dataset.mode = "picker";
  applyActivityVisibility();
  if (!tenant.workspaceId) accountWorkspace.textContent = "—";
  history.replaceState(null, "", location.pathname + location.search);
  closeActivityContextMenu();
  rememberWorkspaceView();
  if (focus) document.querySelector("[data-workspace-list] button, .workspace-picker-sidebar [data-create-workspace]")?.focus();
};

const workspaceRow = (record) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "workspace-row";
  button.dataset.workspaceId = record.id;
  button.title = record.name;
  button.setAttribute("aria-current", String(record.id === tenant.workspaceId));
  button.append(createDocumentFileIcon(), createPlainText(record.name));
  button.addEventListener("click", () => enterWorkspace(record.id));
  return button;
};

// Personal list organization is a browser preference, scoped by account and owner.
const workspaceGroupsKey = () => `agentFactoryWorkspaceGroups:${activityUserId}:${tenant.organizationId || "personal"}`;
const workspaceGroups = () => {
  const groups = storedJson(workspaceGroupsKey(), []);
  return Array.isArray(groups) ? groups.filter(group => group && typeof group.id === "string"
    && typeof group.name === "string" && Array.isArray(group.workspaceIds)) : [];
};
const saveWorkspaceGroups = groups => {
  try { localStorage.setItem(workspaceGroupsKey(), JSON.stringify(groups)); }
  catch { listState.textContent = "그룹을 저장하지 못했습니다."; return false; }
  return true;
};
const moveWorkspaceToGroup = (id, groupId) => {
  if (!workspaceRows.some(row => row.id === id)) return;
  const groups = workspaceGroups();
  for (const group of groups) {
    group.workspaceIds = group.workspaceIds.filter(value => value !== id);
    if (group.id === groupId) group.workspaceIds.push(id);
  }
  if (saveWorkspaceGroups(groups)) renderWorkspaces();
};
const groupDropTarget = (element, groupId) => {
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
    event.preventDefault(); event.stopPropagation(); moveWorkspaceToGroup(id, groupId);
  });
};
const renderWorkspaces = () => {
  const list = document.querySelector("[data-workspace-list]");
  const groups = workspaceGroups();
  const grouped = new Set(groups.flatMap(group => group.workspaceIds));
  const rowWithGroup = record => {
    const row = document.createElement("div"); row.className = "workspace-group-row";
    const button = workspaceRow(record);
    button.draggable = true;
    button.addEventListener("dragstart", event => {
      button.classList.add("is-dragging");
      event.dataTransfer.setData("application/x-agent-factory-workspace", record.id);
      event.dataTransfer.effectAllowed = "move";
    });
    button.addEventListener("dragend", () => {
      button.classList.remove("is-dragging");
      document.querySelectorAll(".is-drop-target").forEach(target => target.classList.remove("is-drop-target"));
    });
    row.append(button);
    return row;
  };
  list.replaceChildren();
  groups.forEach(group => {
    const section = document.createElement("details"); section.className = "workspace-group";
    section.open = !group.collapsed;
    const heading = document.createElement("summary"); heading.textContent = group.name;
    section.append(heading, ...workspaceRows.filter(row => group.workspaceIds.includes(row.id)).map(rowWithGroup));
    section.addEventListener("toggle", () => {
      if (!section.isConnected) return;
      const current = workspaceGroups();
      const item = current.find(item => item.id === group.id);
      if (item && item.collapsed !== !section.open) { item.collapsed = !section.open; saveWorkspaceGroups(current); }
    });
    groupDropTarget(section, group.id); list.append(section);
  });
  const ungrouped = document.createElement("div"); ungrouped.className = "workspace-ungrouped";
  if (groups.length) { const label = document.createElement("p"); label.textContent = "그룹 없음"; ungrouped.append(label); }
  ungrouped.append(...workspaceRows.filter(row => !grouped.has(row.id)).map(rowWithGroup));
  groupDropTarget(ungrouped, ""); list.append(ungrouped);
  listState.textContent = !workspaceRows.length ? "작업공간이 없습니다. 새로 만들어 시작하세요." : "";
  document.querySelector("[data-recent-workspaces]").replaceChildren(...recentRows.map(workspaceRow));
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
groupForm.addEventListener("submit", event => {
  event.preventDefault();
  const name = groupForm.querySelector("input").value.trim();
  const groups = workspaceGroups();
  if (!name || groups.some(group => group.name === name)) {
    groupForm.querySelector("p").textContent = name ? "같은 이름의 그룹이 있습니다." : "그룹 이름을 입력하세요."; return;
  }
  groups.push({ id: crypto.randomUUID(), name, workspaceIds: [], collapsed: false });
  if (saveWorkspaceGroups(groups)) { groupForm.hidden = true; renderWorkspaces(); }
});

const enterWorkspace = async (id) => {
  const record = workspaceRows.find((row) => row.id === id);
  if (!record) return;
  resetWorkspaceDocuments();
  tenant.workspaceId = id;
  document.querySelectorAll(".workspace-row[data-workspace-id]").forEach(button => button.setAttribute("aria-current", String(button.dataset.workspaceId === id)));
  window.agentFactoryMCPConnection.open({ api, userId: activityUserId, organizationId: tenant.organizationId, workspaceId: id, name: record.name, rootPath });
  window.agentFactoryPlanning?.open({ api, organizationId: tenant.organizationId, workspaceId: id });
  const reportingOrganization = tenant.organizationId;
  window.agentFactoryReporting?.open({ api, organizationId: reportingOrganization, workspaceId: id,
    navigate: async (kind, targetId) => {
      const current = () => tenant.organizationId === reportingOrganization && tenant.workspaceId === id;
      if (!current()) return;
      if (kind === "plan") {
        const opened = await window.agentFactoryPlanning.openItem(targetId);
        if (current() && opened) selectActivity("schedule");
      } else {
        await loadDocuments();
        if (!current()) return;
        const record = documentEditor.docs.get(targetId);
        if (record?.href) { selectActivity("documents"); documentEditor.open(targetId); }
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
  selectActivity(null);
  try {
    const width = Number(localStorage.getItem(activityPreferenceKey("sidebarWidth")));
    setSidebarWidth(width > 0 ? width : 268);
    documentGroupToggles.forEach(toggle => {
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
  renderOrganizationIdentity();
  groupForm.hidden = true;
  const saved = savedWorkspaceView();
  const version = ++workspaceLoadVersion;
  tenant.workspaceId = null;
  headerWorkspace.textContent = ""; headerWorkspace.title = ""; headerWorkspace.hidden = true;
  window.agentFactoryMCPConnection.reset();
  window.agentFactoryPlanning?.reset();
  window.agentFactoryReporting?.reset();
  resetWorkspaceDocuments();
  showWorkspaceList();
  workspaceRows = [];
  recentRows = [];
  renderWorkspaces();
  document.querySelector("[data-retry-workspaces]").hidden = true;
  if (!tenant.organizationId) return;
  listState.textContent = "작업공간을 불러오는 중입니다.";
  const base = `/api/organizations/${tenant.organizationId}/workspaces`;
  const [listed, recent] = await Promise.allSettled([api(base), api(`${base}/recent`)]);
  if (version !== workspaceLoadVersion) return;
  if (listed.status === "rejected") {
    listState.textContent = "작업공간을 불러오지 못했습니다.";
    document.querySelector("[data-retry-workspaces]").hidden = false;
    return;
  }
  workspaceRows = listed.value.filter((row) => row.status !== "inactive");
  recentRows = recent.status === "fulfilled" ? recent.value.filter((row) => workspaceRows.some((item) => item.id === row.id)) : [];
  renderWorkspaces();
  if (recent.status === "rejected") document.querySelector("[data-recent-state]").textContent = "최근 목록을 불러오지 못했습니다.";
  if (saved && workspaceRows.some((row) => row.id === saved.workspaceId)) {
    await enterWorkspace(saved.workspaceId);
    if (version !== workspaceLoadVersion || tenant.workspaceId !== saved.workspaceId) return;
    const target = Array.from(activityButtons).find((button) => button.dataset.activity === saved.activity && !button.hidden);
    if (target) {
      selectActivity(target.dataset.activity);
      if (target.dataset.activity === "account") window.agentFactoryAdmin?.profile();
      if (target.dataset.activity === "admin") window.agentFactoryAdmin?.open("dashboard");
    }
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
  header.title = row ? `${row.name} · 조직 코드: ${row.id}` : "";
  document.querySelector("[data-organization-identity]").hidden = !row;
  document.querySelector("[data-organization-code]").textContent = row?.id || "";
  document.querySelector("[data-organization-copy-status]").textContent = "";
};
document.querySelector("[data-copy-organization-code]").addEventListener("click", async () => {
  const id = tenant.organizationId;
  if (!id) return;
  const status = document.querySelector("[data-organization-copy-status]");
  try {
    await navigator.clipboard.writeText(id);
    if (id === tenant.organizationId) status.textContent = "복사했습니다.";
  } catch {
    if (id === tenant.organizationId) status.textContent = "코드를 선택해 복사해 주세요.";
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
  createDialog.showModal();
};

document.querySelectorAll("[data-create-workspace]").forEach((button) => button.addEventListener("click", showCreateWorkspace));
createForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = createForm.elements.name.value.trim();
  if (!name) { document.querySelector("[data-create-error]").textContent = "이름을 입력해 주세요."; return; }
  const submit = createForm.querySelector('[type="submit"]');
  if (submit.disabled) return;
  submit.disabled = true;
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
    createDialog.close();
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
  } finally { submit.disabled = false; }
});
const openOrganizationManagement = (view = "members") => {
  workspaceShell.dataset.mode = "organization";
  applyActivityVisibility();
  window.agentFactoryOrganizations?.open({ api, organizationId: tenant.organizationId, userId: activityUserId,
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
  }, view);
};
document.querySelector("[data-open-organizations]").addEventListener("click", () => {
  workspaceShell.dataset.mode = "organization";
  activityButtons.forEach(button => { button.classList.remove("is-active"); button.setAttribute("aria-pressed", "false"); });
  applyActivityVisibility();
  openOrganizationManagement();
  organizationSelect.focus();
});
document.querySelectorAll("[data-open-workspaces]").forEach((button) => button.addEventListener("click", () => showWorkspaceList(true)));
document.querySelector("[data-retry-workspaces]").addEventListener("click", () => bootAuthentication());
document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));


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
  const savedOrganization = localStorage.getItem(`agentFactoryOrganizationId:${activityUserId}`);
  tenant.organizationId = organizations.some((item) => item.id === savedOrganization)
    ? savedOrganization
    : organizations.find((row) => row.is_personal)?.id || organizations[0]?.id || null;
  if (organizationSelect) organizationSelect.value = tenant.organizationId || "";
  if (accountOrganization) accountOrganization.textContent = organizationSelect?.selectedOptions[0]?.textContent || "—";
  await loadWorkspaces();
  if (session.user.is_platform_admin && initialHash === "#admin") {
    workspaceShell.dataset.mode = "workspace";
    selectActivity("admin");
    window.agentFactoryAdmin?.open("dashboard");
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
    if (document.querySelector('[data-activity="documents"]')?.getAttribute("aria-pressed") !== "true") selectActivity("documents");
    selectDocumentView("document-editor");
  },
  onSelection: () => rememberWorkspaceView(),
});

applyActivityOrder();
applyActivityVisibility();
document.querySelector("[data-configure-activities]").addEventListener("click", (event) => {
  event.stopPropagation();
  const bounds = activityBar.getBoundingClientRect();
  openActivityContextMenu(bounds.right, bounds.top);
});

documentConnectorsButton?.addEventListener("click", () => {
  setActivityVisibility("integrations", true);
  selectActivity("integrations");
  document.querySelector('[data-activity="integrations"]')?.focus();
});

activityButtons.forEach((button) => {
  button.draggable = true;
  button.addEventListener("click", () => {
    selectActivity(button.dataset.activity);
    if (button.dataset.activity === "account") window.agentFactoryAdmin?.profile();
    if (button.dataset.activity === "admin") window.agentFactoryAdmin?.open("dashboard");
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
  openActivityContextMenu(event.clientX, event.clientY);
});

activityContextMenu?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-activity-visibility]");
  if (!button) return;
  event.stopPropagation();
  const activity = button.dataset.activityVisibility;
  setActivityVisibility(activity, button.getAttribute("aria-checked") !== "true");
  openActivityContextMenu(Number.parseFloat(activityContextMenu.style.left), Number.parseFloat(activityContextMenu.style.top));
});

activityContextMenu?.addEventListener("keydown", (event) => {
  if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
  const items = Array.from(activityContextMenu.querySelectorAll("button"));
  const current = items.indexOf(document.activeElement);
  if (!items.length) return;
  event.preventDefault();
  if (event.key === "Home") items[0].focus();
  else if (event.key === "End") items.at(-1).focus();
  else items[(current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
});

profileToggle?.addEventListener("click", () => {
  const expanded = profileToggle.getAttribute("aria-expanded") === "true";
  profileToggle.setAttribute("aria-expanded", String(!expanded));
  if (profileMenu) profileMenu.hidden = expanded;
});

document.addEventListener("click", (event) => {
  if (!profileControl?.contains(event.target)) {
    profileToggle?.setAttribute("aria-expanded", "false");
    if (profileMenu) profileMenu.hidden = true;
  }
  if (!activityContextMenu?.contains(event.target)) closeActivityContextMenu();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (profileMenu && !profileMenu.hidden) {
    profileMenu.hidden = true;
    profileToggle?.setAttribute("aria-expanded", "false");
    profileToggle?.focus();
  }
  closeActivityContextMenu();
});

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
  if (tenant.organizationId) localStorage.setItem(`agentFactoryOrganizationId:${activityUserId}`, tenant.organizationId);
  if (accountOrganization) accountOrganization.textContent = organizationSelect.selectedOptions[0]?.textContent || "—";
  await loadWorkspaces();
  if (wasOrganization) openOrganizationManagement();
});



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
