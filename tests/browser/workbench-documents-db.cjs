// Authenticated real-HTTP/real-PostgreSQL Documents slice; no API interception.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");

(async () => {
  const base = process.env.WORKBENCH_BROWSER_URL;
  assert(base && new URL(base).hostname === "127.0.0.1");
  const appBase = `${(process.env.WORKBENCH_APP_BASE || `${base}/workbench/`).replace(/\/+$/, "")}/`;
  const query = new URLSearchParams({
    organization: process.env.WORKBENCH_BROWSER_ORGANIZATION,
    workspace: process.env.WORKBENCH_BROWSER_WORKSPACE,
  });
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addCookies([
      { name: process.env.WORKBENCH_BROWSER_COOKIE_NAME, value: process.env.WORKBENCH_BROWSER_COOKIE, url: base },
      { name: "agent_factory_csrf", value: "workbench-browser-csrf", url: base },
    ]);
    const page = await context.newPage();
    const errors = [];
    const consoleErrors = [];
    const observedRequests = [];
    const observedResponses = [];
    const errorResponses = [];
    const failedRequests = [];
    const expectedConflictConsole =
      "error: Failed to load resource: the server responded with a status of 409 (Conflict)";
    let expectedConflictConsoleCount = 0;
    let unexpectedConsoleErrorCount = 0;
    let unexpectedFailedRequestCount = 0;
    let navigationPhase = null;
    const scopedApiPath = `/api/organizations/${process.env.WORKBENCH_BROWSER_ORGANIZATION}/workspaces/${process.env.WORKBENCH_BROWSER_WORKSPACE}`;
    const retain = (items, value, limit = 20) => {
      items.push(value);
      if (items.length > limit) items.shift();
    };
    page.on("pageerror", (error) => retain(errors, error.message.slice(0, 500), 10));
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        const diagnostic = `${message.type()}: ${message.text()}`.slice(0, 500);
        if (diagnostic === expectedConflictConsole) expectedConflictConsoleCount += 1;
        else unexpectedConsoleErrorCount += 1;
        retain(consoleErrors, diagnostic, 10);
      }
    });
    page.on("request", (request) => retain(observedRequests, request.url().slice(0, 500)));
    page.on("response", (response) => {
      const record = {
        url: response.url().slice(0, 500),
        status: response.status(),
        contentType: response.headers()["content-type"]?.slice(0, 200) ?? null,
      };
      retain(observedResponses, record);
      if (response.status() >= 400) errorResponses.push(record);
    });
    page.on("requestfailed", (request) => {
      const requestUrl = new URL(request.url());
      const error = request.failure()?.errorText ?? "unknown";
      const isRevisionContent =
        requestUrl.pathname.startsWith(`${scopedApiPath}/documents/`) &&
        /\/revisions\/\d+\/content$/.test(requestUrl.pathname);
      const isWorkspaceVisit = requestUrl.pathname === `${scopedApiPath}/visits`;
      const permittedNavigationAbort =
        requestUrl.origin === new URL(base).origin &&
        error === "net::ERR_ABORTED" &&
        ((["document-reload", "react-to-legacy"].includes(navigationPhase) && isRevisionContent) ||
          (navigationPhase === "legacy-to-react" && isWorkspaceVisit));
      if (!permittedNavigationAbort) unexpectedFailedRequestCount += 1;
      retain(
        failedRequests,
        {
          url: request.url().slice(0, 500),
          error: error.slice(0, 300),
          navigationPhase,
          permittedNavigationAbort,
        },
        10,
      );
    });
    let initialResponse;
    try {
      initialResponse = await page.goto(`${appBase}?${query}`);
      assert(initialResponse, "production Workbench navigation returned no response");
      assert.match(
        initialResponse.headers()["content-security-policy"] ?? "",
        /(?:^|; )script-src 'self'(?:;|$)/,
        "production Workbench must retain its strict script CSP",
      );
      await page.getByRole("navigation", { name: "작업 목록" }).waitFor();
      assert.equal(await page.locator("#root").evaluate((root) => root.childElementCount > 0), true);
    } catch (error) {
      const responseBody = initialResponse
        ? await initialResponse
            .text()
            .then((body) => body.slice(0, 800))
            .catch(() => "<response body unavailable>")
        : null;
      const dom = await page
        .evaluate(() => ({
          contentType: document.contentType,
          readyState: document.readyState,
          title: document.title.slice(0, 200),
          rootChildren: document.querySelector("#root")?.childElementCount ?? -1,
          rootText: (document.querySelector("#root")?.textContent ?? "").trim().slice(0, 800),
          bodyText: (document.body?.innerText ?? "").trim().slice(0, 800),
          theme: document.documentElement.dataset.afTheme ?? null,
        }))
        .catch(() => ({ unavailable: true }));
      console.error(
        "Initial production Workbench navigation failed:",
        JSON.stringify({
          failure: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
          requestedUrl: `${appBase}?${query}`,
          finalUrl: page.url().slice(0, 500),
          response: initialResponse
            ? {
                url: initialResponse.url().slice(0, 500),
                status: initialResponse.status(),
                contentType: initialResponse.headers()["content-type"]?.slice(0, 200) ?? null,
                body: responseBody,
              }
            : null,
          pageErrors: errors,
          consoleErrors,
          failedRequests,
          requests: observedRequests,
          responses: observedResponses,
          dom,
        }),
      );
      throw error;
    }
    await page.getByRole("button", { name: "새 항목" }).click();
    const row = page.getByRole("button", { name: /새 문서-.*항목/ });
    await row.waitFor();
    await row.focus();
    await row.press("Enter");
    await page.getByLabel("새 Markdown revision").fill("# 실제 문서\n\nDB-backed revision");
    await page.getByRole("button", { name: "revision 저장" }).click();
    await page.getByText("revision 1을 저장했습니다.").waitFor();
    await page.getByText("DB-backed revision").waitFor();
    const title = page.getByLabel("제목");
    await title.fill("충돌 뒤 유지할 제목");
    const record = await page.evaluate(
      async ({ organization, workspace }) => {
        const path = `/api/organizations/${organization}/workspaces/${workspace}/documents`;
        const rows = await (await fetch(path)).json();
        return rows.find((item) => item.title === "새 원본 문서");
      },
      { organization: process.env.WORKBENCH_BROWSER_ORGANIZATION, workspace: process.env.WORKBENCH_BROWSER_WORKSPACE },
    );
    await page.evaluate(
      async ({ organization, workspace, record }) => {
        await fetch(`/api/organizations/${organization}/workspaces/${workspace}/documents/${record.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "X-CSRF-Token": "workbench-browser-csrf" },
          body: JSON.stringify({
            title: "동시 변경",
            status: record.status,
            metadata: record.document_metadata,
            revision: record.revision,
          }),
        });
      },
      {
        organization: process.env.WORKBENCH_BROWSER_ORGANIZATION,
        workspace: process.env.WORKBENCH_BROWSER_WORKSPACE,
        record,
      },
    );
    const staleUpdateUrl = `${base}/api/organizations/${process.env.WORKBENCH_BROWSER_ORGANIZATION}/workspaces/${process.env.WORKBENCH_BROWSER_WORKSPACE}/documents/${record.id}`;
    const staleUpdate = page.waitForResponse(
      (response) => response.url() === staleUpdateUrl && response.request().method() === "PUT",
    );
    await page.getByRole("button", { name: "정보 저장" }).click();
    assert.equal((await staleUpdate).status(), 409);
    await page.getByText(/충돌.*입력한 제목은 유지/).waitFor();
    assert.equal(await title.inputValue(), "충돌 뒤 유지할 제목");
    navigationPhase = "document-reload";
    await page.reload();
    await page.getByText("DB-backed revision").waitFor();
    navigationPhase = null;
    const separator = page.getByRole("separator", { name: "사이드바 너비 조절" });
    assert.equal(await separator.getAttribute("aria-valuenow"), "268");
    for (let index = 0; index < 30; index += 1) await separator.press("ArrowLeft");
    assert.equal(await separator.getAttribute("aria-valuenow"), "180");
    for (let index = 0; index < 30; index += 1) await separator.press("ArrowRight");
    assert.equal(await separator.getAttribute("aria-valuenow"), "520");
    navigationPhase = "document-reload";
    await page.reload();
    assert.equal(
      await page.getByRole("separator", { name: "사이드바 너비 조절" }).getAttribute("aria-valuenow"),
      "520",
    );
    navigationPhase = null;
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.getByText("서버 테마를 적용했습니다.", { exact: true }).waitFor();
    await page.getByLabel("기본 테마").selectOption("light");
    await page.getByLabel("기본 테마").selectOption("high-contrast");
    assert.equal(await page.evaluate(() => document.documentElement.dataset.afTheme), "high-contrast");
    navigationPhase = "react-to-legacy";
    await page.getByRole("link", { name: "기존 화면" }).click();
    await page.locator("[data-workspace-shell]").waitFor();
    navigationPhase = null;
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "작업공간 목록", exact: true }).click();
    const workspaceRow = page.locator(
      `[data-workspace-list] [data-workspace-id="${process.env.WORKBENCH_BROWSER_WORKSPACE}"]`,
    );
    await workspaceRow.waitFor({ state: "attached" });
    if (!(await workspaceRow.isVisible())) {
      const containingGroup = workspaceRow.locator(
        "xpath=ancestor::*[@role='treeitem' and @aria-expanded][1]",
      );
      if ((await containingGroup.count()) && (await containingGroup.getAttribute("aria-expanded")) === "false")
        await containingGroup.locator(":scope > .af-explorer-line").click();
    }
    navigationPhase = "legacy-to-react";
    await workspaceRow.click();
    await page.getByRole("navigation", { name: "작업 목록" }).waitFor();
    await page.getByText("DB-backed revision").waitFor();
    navigationPhase = null;
    assert.deepEqual(errors, []);
    assert.equal(unexpectedFailedRequestCount, 0, JSON.stringify(failedRequests));
    assert.deepEqual(
      errorResponses.filter(({ status, url }) => status !== 409 || url !== staleUpdateUrl),
      [],
    );
    assert.equal(
      errorResponses.filter(({ status, url }) => status === 409 && url === staleUpdateUrl).length,
      1,
    );
    assert(expectedConflictConsoleCount <= 1);
    assert.equal(unexpectedConsoleErrorCount, 0, JSON.stringify(consoleErrors));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
