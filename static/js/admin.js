(() => {
  const titles = {
    dashboard: "개요",
    users: "사용자",
    organizations: "조직",
    workspaces: "작업공간",
    jobs: "작업",
    integrations: "연동",
    audit: "감사 로그",
    "feature-flags": "기능 플래그",
    runtime: "런타임",
    assets: "공통 에셋",
  };
  const content = document.querySelector("[data-admin-content]");
  const ui = window.agentFactoryUI;
  content?.classList.add('af-kit');
  const message = (kind, text, className) => {
    const node = ui.status({kind,text}); node.classList.add(className); return node.outerHTML;
  };
  const status = document.querySelector("[data-admin-status]");
  const title = document.querySelector("[data-admin-title]");
  const catalogLink = document.querySelector("[data-admin-catalog-link]");
  const workspace = document.querySelector('[data-workspace-view="admin"]');
  const profileButton = document.querySelector("[data-account-profile]");
  const rootPath = new URL("../", document.baseURI).pathname.replace(/\/$/, "");
  let requestVersion = 0;
  let preferences = null;
  const setLoadStatus = (kind, text) => {
    status.classList.add('af-status--inline');
    ui.setStatus(status,{kind,text});
  };

  const renderTable = (rows) => {
    if (!rows.length) return message('empty','표시할 레코드가 없습니다.','admin-empty');
    const keys = Object.keys(rows[0]).filter((key) => !["payload", "rules"].includes(key));
    const table = ui.resourceTable({headers:keys,rows:rows.map(row=>keys.map(key=>row[key]))});
    table.classList.add('admin-table-shell');
    return table.outerHTML;
  };

  const load = async (view) => {
    if (!content || !status || !title || !Object.hasOwn(titles, view)) return;
    const request = ++requestVersion;
    title.textContent = titles[view];
    workspace.dataset.adminLayout = view === 'assets' ? 'catalog' : 'records';
    catalogLink.hidden = true;
    setLoadStatus('loading','불러오는 중');
    content.replaceChildren();
    try {
      const url = view === "assets" ? `${rootPath}/admin/assets/` : `${rootPath}/api/admin/${view}`;
      const response = await fetch(url, { credentials: "same-origin", cache: "no-store" });
      if (request !== requestVersion) return;
      if (response.status === 401) {
        window.location.assign(`${rootPath}/login/`);
        return;
      }
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      if (view === "assets") {
        catalogLink.href = url;
        catalogLink.hidden = false;
        const frame = document.createElement('iframe');
        frame.className = 'admin-asset-catalog';
        frame.title = '공통 에셋 카탈로그';
        frame.hidden = true;
        frame.addEventListener('load', () => {
          if (request !== requestVersion || workspace.dataset.adminLayout !== 'catalog') return;
          frame.hidden = false;
          setLoadStatus('success', '');
        }, { once: true });
        frame.src = url;
        content.replaceChildren(frame);
        return;
      }
      const data = await response.json();
      if (request !== requestVersion) return;
      if (view === "dashboard") {
        content.replaceChildren(ui.metadataGrid(Object.entries(data)));
      } else if (view === "runtime") {
        content.innerHTML = renderTable([data]);
      } else {
        content.innerHTML = renderTable(data);
      }
      setLoadStatus('success','조회 완료');
    } catch (error) {
      if (request !== requestVersion) return;
      content.innerHTML = message('error',error.message,'admin-error');
      setLoadStatus('error','조회 실패');
    }
  };

  const open = (view = preferences?.read({}).view || "dashboard") => {
    if (!Object.hasOwn(titles, view)) view = "dashboard";
    profileButton?.classList.remove("is-selected");
    document.querySelector("[data-admin-view].is-selected")?.classList.remove("is-selected");
    document.querySelector(`[data-admin-view="${view}"]`)?.classList.add("is-selected");
    history.replaceState(null, "", "#admin");
    preferences?.write({view});
    load(view);
  };

  const profile = () => {
    requestVersion++;
    document.querySelector("[data-admin-view].is-selected")?.classList.remove("is-selected");
    profileButton?.classList.add("is-selected");
    history.replaceState(null, "", "#account");
  };

  document.querySelectorAll("[data-admin-view]").forEach((button) => {
    button.addEventListener("click", () => open(button.dataset.adminView));
  });
  profileButton?.addEventListener("click", profile);

  const reset = () => {
    requestVersion++;
    if (catalogLink) catalogLink.hidden = true;
    content?.replaceChildren();
  };
  const setPreferences = (next) => { preferences = next; };
  window.agentFactoryAdmin = { load, open, profile, reset, setPreferences };
})();
