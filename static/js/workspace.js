const workspaceShell = document.querySelector("[data-workspace-shell]");
const sidebarResizer = document.querySelector("[data-sidebar-resizer]");
const activityButtons = document.querySelectorAll("[data-activity]");
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
const adminActivityButton = document.querySelector("[data-admin-activity]");
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
};

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

const selectActivity = (activity) => {
  if (!Object.hasOwn(activityTitles, activity)) return;
  if (location.hash === "#admin") history.replaceState(null, "", location.pathname + location.search);

  activityButtons.forEach((button) => {
    const isActive = button.dataset.activity === activity;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  adminActivityButton?.classList.remove("is-active");
  adminActivityButton?.setAttribute("aria-pressed", "false");
  sidebarViews.forEach((view) => {
    view.hidden = view.dataset.sidebarView !== activity;
  });
  workspaceViews.forEach((view) => {
    view.hidden = view.dataset.workspaceView !== activity;
  });
  if (sidebarTitle) sidebarTitle.textContent = activityTitles[activity];
};

const selectAdminActivity = () => {
  if (!adminActivityButton || adminActivityButton.hidden) return;
  activityButtons.forEach((button) => {
    button.classList.remove("is-active");
    button.setAttribute("aria-pressed", "false");
  });
  adminActivityButton.classList.add("is-active");
  adminActivityButton.setAttribute("aria-pressed", "true");
  sidebarViews.forEach((view) => { view.hidden = view.dataset.sidebarView !== "admin"; });
  workspaceViews.forEach((view) => { view.hidden = view.dataset.workspaceView !== "admin"; });
  if (sidebarTitle) sidebarTitle.textContent = "플랫폼 관리";
  window.agentFactoryAdmin?.load("dashboard");
  history.replaceState(null, "", "#admin");
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
  await loadDocuments();
};

const openWorkspace = async (session) => {
  if (currentUser) currentUser.textContent = session.user.display_name;
  if (currentUserEmail) currentUserEmail.textContent = session.user.email;
  if (profileName) profileName.textContent = session.user.display_name;
  if (profileAvatar) profileAvatar.textContent = session.user.display_name.trim().slice(0, 1).toUpperCase();
  if (profileControl) profileControl.hidden = false;
  if (adminActivityButton) adminActivityButton.hidden = !session.user.is_platform_admin;
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
  await loadWorkspaces();
  if (session.user.is_platform_admin && location.hash === "#admin") selectAdminActivity();
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

activityButtons.forEach((button) => {
  button.addEventListener("click", () => selectActivity(button.dataset.activity));
});

adminActivityButton?.addEventListener("click", selectAdminActivity);

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
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && profileMenu && !profileMenu.hidden) {
    profileMenu.hidden = true;
    profileToggle?.setAttribute("aria-expanded", "false");
    profileToggle?.focus();
  }
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
  await loadWorkspaces();
});

workspaceSelect?.addEventListener("change", async () => {
  tenant.workspaceId = workspaceSelect.value || null;
  if (tenant.workspaceId) localStorage.setItem("agentFactoryWorkspaceId", tenant.workspaceId);
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
