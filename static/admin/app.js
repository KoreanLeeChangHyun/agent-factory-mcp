const titles = {
  dashboard: "Overview", users: "Users", organizations: "Organizations",
  workspaces: "Workspaces", jobs: "Jobs", integrations: "Integrations",
  audit: "Audit", "feature-flags": "Feature flags", runtime: "Runtime"
};
const content = document.querySelector("#content");
const status = document.querySelector("#status");
const escapeHtml = (value) => String(value ?? "—").replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

function table(rows) {
  if (!rows.length) return '<div class="empty">No records</div>';
  const keys = Object.keys(rows[0]).filter((key) => !["payload", "rules"].includes(key));
  return `<table><thead><tr>${keys.map((key) => `<th>${escapeHtml(key)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${keys.map((key) => `<td>${escapeHtml(row[key])}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

async function load(view) {
  document.querySelector("#title").textContent = titles[view];
  status.textContent = "Loading…";
  content.innerHTML = "";
  try {
    const response = await fetch(`/api/admin/${view}`, {credentials: "same-origin"});
    if (response.status === 401) { location.href = "/workspace/?login=required"; return; }
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const data = await response.json();
    if (view === "dashboard") {
      content.innerHTML = `<div class="cards">${Object.entries(data).map(([key, value]) => `<article class="card"><span>${escapeHtml(key)}</span><strong>${escapeHtml(value)}</strong></article>`).join("")}</div>`;
    } else if (view === "runtime") {
      content.innerHTML = table([data]);
    } else {
      content.innerHTML = table(data);
    }
    status.textContent = "Live";
  } catch (error) {
    content.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
    status.textContent = "Unavailable";
  }
}

document.querySelectorAll("nav button").forEach((button) => button.addEventListener("click", () => {
  document.querySelector("nav button.active")?.classList.remove("active");
  button.classList.add("active");
  load(button.dataset.view);
}));
load("dashboard");
