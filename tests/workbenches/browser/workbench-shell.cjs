// Shared shell context isolation and rollback projection with browser-owned HTTP fixtures.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");

(async () => {
  const base = process.env.WORKBENCH_URL || "http://127.0.0.1:4173";
  const appBase = `${(process.env.WORKBENCH_APP_BASE || `${base}/workbench/`).replace(/\/+$/, "")}/`;
  const user = "01234567-89ab-cdef-0123-456789abcdef";
  const secondUser = "fedcba98-7654-4321-fedc-ba9876543210";
  let currentUser = user;
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.route("**/api/auth/me", (route) => route.fulfill({ json: { user: { id: currentUser } } }));
    await context.route("**/api/appearance/theme-profile", (route) =>
      route.fulfill({
        json: {
          schemaVersion: "1.0",
          userId: currentUser.replaceAll("-", ""),
          revision: 1,
          base: "dark",
          density: "compact",
          overrides: {},
          reducedMotion: false,
        },
      }),
    );
    await context.route("**/workbench/selection", (route) =>
      route.fulfill({
        json: {
          mode: "react",
          version: 1,
          permissions: ["workspace.read", "document.read", "document.export"],
        },
      }),
    );
    await context.route("**/workbenches/published", (route) => route.fulfill({ json: { items: [] } }));
    let releaseA;
    const holdA = new Promise((resolve) => {
      releaseA = resolve;
    });
    await context.route(
      /\/api\/organizations\/organization-(a|b)\/workspaces\/(a|b)\/documents(?:\/.*)?$/,
      async (route) => {
        const [, organization, workspace] =
          route
            .request()
            .url()
            .match(/organization-(a|b)\/workspaces\/(a|b)/) || [];
        if (organization !== workspace) return route.fulfill({ status: 403, json: { detail: "cross-context" } });
        const pathname = new URL(route.request().url()).pathname;
        if (workspace === "a" && pathname.endsWith("/documents")) await holdA;
        if (pathname.endsWith("/documents"))
          return route.fulfill({
            json: [
              {
                id: `${workspace}0000000-0000-4000-8000-000000000000`,
                workspace_id: workspace,
                document_type: "original",
                title: `Workspace ${workspace.toUpperCase()} document`,
                slug: `document-${workspace}`,
                status: "active",
                document_metadata: { path: `folder/${workspace}.md` },
                current_revision_number: 0,
                revision: 1,
                created_at: "2026-09-13T00:00:00Z",
                updated_at: "2026-09-13T00:00:00Z",
              },
            ],
          });
        if (pathname.endsWith("/revisions")) return route.fulfill({ json: [] });
        return route.fulfill({
          json: {
            id: `${workspace}0000000-0000-4000-8000-000000000000`,
            workspace_id: workspace,
            document_type: "original",
            title: `Workspace ${workspace.toUpperCase()} document`,
            slug: `document-${workspace}`,
            status: "active",
            document_metadata: { path: `folder/${workspace}.md` },
            current_revision_number: 0,
            revision: 1,
            created_at: "2026-09-13T00:00:00Z",
            updated_at: "2026-09-13T00:00:00Z",
          },
        });
      },
    );
    const page = await context.newPage();
    const pageErrors = [];
    const observedRequests = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("request", (request) => {
      observedRequests.push(request.url());
      if (observedRequests.length > 20) observedRequests.shift();
    });
    const requestA = page.waitForRequest((request) => request.url().includes("organization-a/workspaces/a/documents"), {
      timeout: 5000,
    });
    let initialResponse;
    try {
      initialResponse = await page.goto(`${appBase}?organization=organization-a&workspace=a`);
      await requestA;
    } catch (error) {
      const body = await page
        .locator("body")
        .innerText()
        .catch(() => "<body unavailable>");
      console.error(
        JSON.stringify({
          finalUrl: page.url(),
          responseStatus: initialResponse?.status() ?? null,
          responseBodyType: initialResponse?.headers()["content-type"] ?? null,
          body: body.slice(0, 800),
          rootCount: await page
            .locator("#root")
            .count()
            .catch(() => -1),
          pageErrors: pageErrors.slice(-10),
          requests: observedRequests,
        }),
      );
      throw error;
    }
    await page.evaluate((prefix) => {
      history.pushState({}, "", `${prefix}?organization=organization-b&workspace=b`);
      dispatchEvent(new PopStateEvent("popstate"));
    }, new URL(appBase).pathname);
    await page.getByRole("button", { name: "folder 펼치기" }).click();
    await page.getByRole("button", { name: "b.md 항목" }).waitFor();
    releaseA();
    await page.waitForTimeout(50);
    assert.equal(await page.getByRole("button", { name: "a.md 항목" }).count(), 0);
    await page.evaluate((prefix) => {
      history.pushState({}, "", `${prefix}?organization=organization-a&workspace=a`);
      dispatchEvent(new PopStateEvent("popstate"));
    }, new URL(appBase).pathname);
    await page.getByRole("button", { name: "folder 펼치기" }).click();
    await page.getByRole("button", { name: "a.md 항목" }).waitFor();
    currentUser = secondUser;
    await page.reload();
    assert.equal(await page.getByRole("button", { name: "a.md 항목" }).count(), 0);
    currentUser = user;
    await page.reload();
    await page.getByRole("button", { name: "a.md 항목" }).waitFor();
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
