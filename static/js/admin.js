const titles = {
  dashboard: "개요", users: "사용자", organizations: "조직",
  workspaces: "워크스페이스", jobs: "작업", integrations: "연동",
  audit: "감사 로그", "feature-flags": "기능 플래그", runtime: "런타임"
};
const content = document.querySelector("#content");
const status = document.querySelector("#status");
const tabTitle = document.querySelector("#tab-title");
const rootPath = new URL("../", document.baseURI).pathname.replace(/\/$/, "");
const escapeHtml = (value) => String(value ?? "—").replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

function table(rows) {
  if (!rows.length) return '<div class="empty">표시할 레코드가 없습니다.</div>';
  const keys = Object.keys(rows[0]).filter((key) => !["payload", "rules"].includes(key));
  return `<div class="table-shell"><table><thead><tr>${keys.map((key) => `<th>${escapeHtml(key)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${keys.map((key) => `<td>${escapeHtml(row[key])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

async function load(view) {
  document.querySelector("#title").textContent = titles[view];
  if (tabTitle) tabTitle.textContent = titles[view];
  status.textContent = "불러오는 중";
  content.innerHTML = "";
  try {
    const response = await fetch(`${rootPath}/api/admin/${view}`, {credentials: "same-origin"});
    if (response.status === 401) { location.href = `${rootPath}/workspace/?login=required`; return; }
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const data = await response.json();
    if (view === "dashboard") {
      content.innerHTML = `<div class="cards">${Object.entries(data).map(([key, value]) => `<article class="card"><span>${escapeHtml(key)}</span><strong>${escapeHtml(value)}</strong></article>`).join("")}</div>`;
    } else if (view === "runtime") {
      content.innerHTML = table([data]);
    } else {
      content.innerHTML = table(data);
    }
    status.textContent = "실시간";
  } catch (error) {
    content.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
    status.textContent = "연결 불가";
  }
}

document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => {
  document.querySelector("[data-view].active")?.classList.remove("active");
  button.classList.add("active");
  load(button.dataset.view);
}));
load("dashboard");
