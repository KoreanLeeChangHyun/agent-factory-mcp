(() => {
  const titles = {
    dashboard: "개요",
    users: "사용자",
    organizations: "조직",
    workspaces: "워크스페이스",
    jobs: "작업",
    integrations: "연동",
    audit: "감사 로그",
    "feature-flags": "기능 플래그",
    runtime: "런타임",
  };
  const content = document.querySelector("[data-admin-content]");
  const status = document.querySelector("[data-admin-status]");
  const title = document.querySelector("[data-admin-title]");
  const tab = document.querySelector("[data-admin-tab]");
  const panels = document.querySelectorAll("[data-account-panel]");
  const profileButton = document.querySelector("[data-account-profile]");
  const rootPath = new URL("../", document.baseURI).pathname.replace(/\/$/, "");
  const escapeHtml = (value) => String(value ?? "—").replace(
    /[&<>'"]/g,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character],
  );

  const renderTable = (rows) => {
    if (!rows.length) return '<div class="admin-empty">표시할 레코드가 없습니다.</div>';
    const keys = Object.keys(rows[0]).filter((key) => !["payload", "rules"].includes(key));
    const head = keys.map((key) => `<th>${escapeHtml(key)}</th>`).join("");
    const body = rows.map((row) => `<tr>${keys.map((key) => `<td>${escapeHtml(row[key])}</td>`).join("")}</tr>`).join("");
    return `<div class="admin-table-shell"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  };

  const load = async (view) => {
    if (!content || !status || !title || !Object.hasOwn(titles, view)) return;
    title.textContent = titles[view];
    if (tab) tab.textContent = `플랫폼 관리 / ${titles[view]}`;
    status.textContent = "불러오는 중";
    content.replaceChildren();
    try {
      const response = await fetch(`${rootPath}/api/admin/${view}`, { credentials: "same-origin" });
      if (response.status === 401) {
        window.location.assign(`${rootPath}/login/`);
        return;
      }
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const data = await response.json();
      if (view === "dashboard") {
        content.innerHTML = `<div class="admin-cards">${Object.entries(data).map(([key, value]) => `<article class="admin-card"><span>${escapeHtml(key)}</span><strong>${escapeHtml(value)}</strong></article>`).join("")}</div>`;
      } else if (view === "runtime") {
        content.innerHTML = renderTable([data]);
      } else {
        content.innerHTML = renderTable(data);
      }
      status.textContent = "실시간";
    } catch (error) {
      content.innerHTML = `<div class="admin-error">${escapeHtml(error.message)}</div>`;
      status.textContent = "연결 불가";
    }
  };

  const showPanel = (name) => {
    panels.forEach((panel) => { panel.hidden = panel.dataset.accountPanel !== name; });
  };

  const open = (view) => {
    showPanel("admin");
    profileButton?.classList.remove("is-selected");
    document.querySelector("[data-admin-view].is-selected")?.classList.remove("is-selected");
    document.querySelector(`[data-admin-view="${view}"]`)?.classList.add("is-selected");
    history.replaceState(null, "", "#admin");
    load(view);
  };

  const profile = () => {
    showPanel("profile");
    document.querySelector("[data-admin-view].is-selected")?.classList.remove("is-selected");
    profileButton?.classList.add("is-selected");
    history.replaceState(null, "", "#account");
  };

  document.querySelectorAll("[data-admin-view]").forEach((button) => {
    button.addEventListener("click", () => open(button.dataset.adminView));
  });
  profileButton?.addEventListener("click", profile);

  window.agentFactoryAdmin = { load, open, profile };
})();
