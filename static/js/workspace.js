const workspaceShell = document.querySelector("[data-workspace-shell]");
const activityBar = document.querySelector(".activity-bar");
const sidebarResizer = document.querySelector("[data-sidebar-resizer]");
const activityButtons = document.querySelectorAll("[data-activity]");
const activityContextMenu = document.querySelector("[data-activity-context-menu]");
const sidebarTitle = document.querySelector("[data-sidebar-title]");
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
const specificationFrame = document.querySelector("[data-specification-frame]");
const specificationTab = document.querySelector("[data-specification-tab]");
const organizationSelect = document.querySelector("[data-organization-select]");
const workspaceSelect = document.querySelector("[data-workspace-select]");
const workspaceContext = document.querySelector("[data-workspace-context]");
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
  account: "계정",
  admin: "관리자",
};
const activityOrderKey = "agentFactoryActivityOrder";
const activityVisibilityKey = "agentFactoryActivityVisibility";
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

const specificationStatusLabel = (status) => {
  if (status === "missing-human") return "사람용 명세 문서 없음";
  return "바인딩 불일치";
};

const safeDocumentHref = (value) => {
  if (typeof value !== "string" || value.trim() === "") return null;
  try {
    const resolved = new URL(value, window.location.href);
    return resolved.origin === window.location.origin && resolved.pathname.startsWith(`${rootPath}/api/`)
      ? resolved
      : null;
  } catch {
    return null;
  }
};

const openSpecification = (item, link) => {
  const href = safeDocumentHref(item.href);
  if (!href || !specificationFrame) return;
  document.querySelectorAll("[data-specification-link]").forEach((candidate) => {
    const isCurrent = candidate === link;
    candidate.classList.toggle("is-selected", isCurrent);
    if (isCurrent) candidate.setAttribute("aria-current", "page");
    else candidate.removeAttribute("aria-current");
  });
  specificationFrame.src = href.href;
  specificationFrame.title = `${item.name} 명세 문서`;
  if (specificationTab) specificationTab.textContent = item.name;
  selectActivity("documents");
  selectDocumentView("specification-document");
};

const loadDocuments = async () => {
  if (!specificationList || !specificationTreeState) return;
  if (!tenant.organizationId || !tenant.workspaceId) {
    specificationTreeState.textContent = "워크스페이스를 선택해 주세요.";
    return;
  }
  try {
    const documents = await api(`/api/organizations/${tenant.organizationId}/workspaces/${tenant.workspaceId}/documents`);
    if (!Array.isArray(documents)) throw new TypeError("문서 응답 형식이 올바르지 않습니다.");

    const originalRows = documents
      .filter((item) => item.document_type === "original")
      .map((item) => {
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

    specificationList.replaceChildren();
    const specifications = documents.filter((item) => item.document_type === "specification");
    specifications.forEach((rawItem) => {
      const item = {
        id: String(rawItem.id),
        name: rawItem.title,
        href: rawItem.current_revision_number > 0
          ? `${rootPath}/api/organizations/${tenant.organizationId}/workspaces/${tenant.workspaceId}/documents/${rawItem.id}/revisions/${rawItem.current_revision_number}/content`
          : null,
        status: rawItem.current_revision_number > 0 ? "paired" : "missing-human",
      };
      const href = item.status === "paired" ? safeDocumentHref(item.href) : null;
      if (href) {
        const link = document.createElement("a");
        link.className = "document-navigation__item";
        link.href = href.href;
        link.textContent = item.name || item.id;
        link.dataset.specificationLink = item.id;
        link.addEventListener("click", (event) => {
          event.preventDefault();
          openSpecification(item, link);
        });
        specificationList.append(link);
        return;
      }
      const state = document.createElement("span");
      state.className = "document-tree__item-status";
      state.textContent = `${item.name || item.id} · ${specificationStatusLabel(item.status)}`;
      specificationList.append(state);
    });

    if (specifications.length === 0) {
      specificationTreeState.textContent = "연결된 명세 문서가 없습니다.";
      specificationTreeState.hidden = false;
      specificationList.hidden = true;
      return;
    }
    specificationTreeState.textContent = `명세 문서 ${specifications.length}개`;
    specificationTreeState.hidden = true;
    specificationList.hidden = false;
  } catch {
    specificationList.hidden = true;
    specificationTreeState.hidden = false;
    specificationTreeState.textContent = "명세 문서를 불러오지 못했습니다.";
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
  localStorage.setItem(activityOrderKey, JSON.stringify(orderedActivityButtons().map((button) => button.dataset.activity)));
};

const applyActivityOrder = () => {
  if (!activityBar) return;
  const candidateOrder = storedJson(activityOrderKey, []);
  const storedOrder = Array.isArray(candidateOrder) ? candidateOrder : [];
  const rank = new Map(storedOrder.map((activity, index) => [activity, index]));
  orderedActivityButtons()
    .sort((left, right) => (rank.get(left.dataset.activity) ?? 99) - (rank.get(right.dataset.activity) ?? 99))
    .forEach((button) => activityBar.append(button));
};

const activityVisibility = () => {
  const visibility = storedJson(activityVisibilityKey, {});
  return visibility && typeof visibility === "object" && !Array.isArray(visibility) ? visibility : {};
};

const applyActivityVisibility = () => {
  const visibility = activityVisibility();
  activityButtons.forEach((button) => {
    const activity = button.dataset.activity;
    const permitted = activity !== "admin" || platformAdmin;
    button.hidden = !permitted || visibility[activity] === false;
  });
};

const setActivityVisibility = (activity, visible) => {
  const visibility = activityVisibility();
  visibility[activity] = visible;
  localStorage.setItem(activityVisibilityKey, JSON.stringify(visibility));
  applyActivityVisibility();
  const active = document.querySelector("[data-activity].is-active");
  if (active?.hidden) {
    const fallback = orderedActivityButtons().find((button) => !button.hidden);
    if (fallback) selectActivity(fallback.dataset.activity);
  }
};

const closeActivityContextMenu = () => {
  if (activityContextMenu) activityContextMenu.hidden = true;
};

const openActivityContextMenu = (x, y) => {
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
  if (!Object.hasOwn(activityTitles, activity)) return;
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
  if (sidebarTitle) sidebarTitle.textContent = activityTitles[activity];
};

const selectDocumentView = (target) => {
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
  if (target !== "specification-document") {
    document.querySelectorAll("[data-specification-link]").forEach((item) => {
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

const populateSelect = (select, rows) => {
  if (!select) return;
  select.replaceChildren(...rows.map((row) => {
    const option = document.createElement("option");
    option.value = row.id;
    option.textContent = row.name;
    return option;
  }));
};

const loadWorkspaces = async () => {
  if (!tenant.organizationId) {
    tenant.workspaceId = null;
    populateSelect(workspaceSelect, []);
    await loadDocuments();
    return;
  }
  const workspaces = await api(`/api/organizations/${tenant.organizationId}/workspaces`);
  populateSelect(workspaceSelect, workspaces);
  const savedWorkspace = localStorage.getItem("agentFactoryWorkspaceId");
  tenant.workspaceId = workspaces.some((item) => item.id === savedWorkspace)
    ? savedWorkspace
    : workspaces[0]?.id || null;
  if (workspaceSelect) workspaceSelect.value = tenant.workspaceId || "";
  if (accountWorkspace) accountWorkspace.textContent = workspaceSelect?.selectedOptions[0]?.textContent || "—";
  await loadDocuments();
};

const openWorkspace = async (session) => {
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
  if (workspaceContext) workspaceContext.hidden = false;

  const organizations = await api("/api/account/organizations");
  populateSelect(organizationSelect, organizations);
  if (organizationSelect) {
    organizationSelect.disabled = organizations.length <= 1;
    organizationSelect.title = organizations.length > 1 ? "조직 변경" : "현재 조직";
  }
  const savedOrganization = localStorage.getItem("agentFactoryOrganizationId");
  tenant.organizationId = organizations.some((item) => item.id === savedOrganization)
    ? savedOrganization
    : organizations[0]?.id || null;
  if (organizationSelect) organizationSelect.value = tenant.organizationId || "";
  if (accountOrganization) accountOrganization.textContent = organizationSelect?.selectedOptions[0]?.textContent || "—";
  await loadWorkspaces();
  if (session.user.is_platform_admin && location.hash === "#admin") {
    selectActivity("admin");
    window.agentFactoryAdmin?.open("dashboard");
  } else if (location.hash === "#account") {
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
  }
};

if (workspaceShell) {
  workspaceShell.dataset.ready = "true";
}

applyActivityOrder();
applyActivityVisibility();

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
  tenant.organizationId = organizationSelect.value || null;
  if (tenant.organizationId) localStorage.setItem("agentFactoryOrganizationId", tenant.organizationId);
  if (accountOrganization) accountOrganization.textContent = organizationSelect.selectedOptions[0]?.textContent || "—";
  await loadWorkspaces();
});

workspaceSelect?.addEventListener("change", async () => {
  tenant.workspaceId = workspaceSelect.value || null;
  if (tenant.workspaceId) localStorage.setItem("agentFactoryWorkspaceId", tenant.workspaceId);
  if (accountWorkspace) accountWorkspace.textContent = workspaceSelect.selectedOptions[0]?.textContent || "—";
  await loadDocuments();
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
