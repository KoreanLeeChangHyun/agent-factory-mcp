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
    task: "documents",
  });
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent: "agent-factory-stage7-browser",
    });
    const page = await context.newPage();
    let navigationPhase = null;
    const scopedApiPath = `/api/organizations/${process.env.WORKBENCH_BROWSER_ORGANIZATION}/workspaces/${process.env.WORKBENCH_BROWSER_WORKSPACE}`;
    const waitForFinished = (method, path) =>
      page.waitForEvent("requestfinished", {
        predicate: (request) =>
          request.method() === method && new URL(request.url()).pathname === path,
      });
    const waitForFinishedMatching = (method, path) =>
      page.waitForEvent("requestfinished", {
        predicate: (request) =>
          request.method() === method && path.test(new URL(request.url()).pathname),
      });
    const expectFinishedStatus = async (request, status) => {
      const response = await request.response();
      assert(
        response,
        `finished request has no response: ${request.method()} ${new URL(request.url()).pathname}`,
      );
      assert.equal(response.status(), status, `${request.method()} ${new URL(request.url()).pathname}`);
    };
    const trackOptionalRequests = (method, path) => {
      const cancellableTransitions = new Set(["react-to-legacy", "legacy-to-react"]);
      const tracked = new Map();
      let accepting = true;
      let activeTransition = null;
      const matches = (request) => {
        const requestUrl = new URL(request.url());
        return (
          request.method() === method &&
          requestUrl.origin === new URL(base).origin &&
          requestUrl.pathname === path
        );
      };
      const started = (request) => {
        if (!accepting || !matches(request) || tracked.has(request)) return;
        let resolveOutcome;
        const outcome = new Promise((resolve) => {
          resolveOutcome = resolve;
        });
        const entry = {
          outcome,
          request,
          settled: false,
          startedPhase: navigationPhase,
          startedPage: page.url(),
          cancellableTransition: activeTransition,
        };
        entry.resolve = (terminalOutcome, terminalTransition = null) => {
          if (entry.settled) return;
          entry.settled = true;
          entry.terminalOutcome = terminalOutcome;
          entry.terminalTransition = terminalTransition;
          resolveOutcome({
            outcome: terminalOutcome,
            request,
            startedPhase: entry.startedPhase,
            startedPage: entry.startedPage,
            terminalTransition,
          });
        };
        tracked.set(request, entry);
      };
      const finished = (request) => {
        tracked.get(request)?.resolve("finished");
      };
      const failed = (request) => {
        const entry = tracked.get(request);
        const terminalTransition = entry?.cancellableTransition ?? null;
        entry?.resolve("failed", terminalTransition);
      };
      page.on("request", started);
      page.on("requestfinished", finished);
      page.on("requestfailed", failed);
      return {
        beginTransition: (transition) => {
          assert(cancellableTransitions.has(transition), `unsupported visit transition: ${transition}`);
          assert.equal(activeTransition, null, "visit transitions must not overlap");
          activeTransition = transition;
          for (const entry of tracked.values()) {
            if (!entry.settled) entry.cancellableTransition = transition;
          }
        },
        endTransition: (transition) => {
          assert.equal(activeTransition, transition, "visit transition boundary mismatch");
          activeTransition = null;
        },
        permitsAbort: (request) => {
          const entry = tracked.get(request);
          return (
            entry?.terminalOutcome === "failed" &&
            cancellableTransitions.has(entry.terminalTransition)
          );
        },
        closeAndSettle: async () => {
          accepting = false;
          page.off("request", started);
          const outcomes = await Promise.all(
            [...tracked.values()].map((entry) => {
              if (entry.settled) return entry.outcome;
              return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                  reject(
                    new Error(
                      `started request did not settle: ${method} ${path} (phase: ${entry.startedPhase ?? "none"}, page: ${entry.startedPage})`,
                    ),
                  );
                }, 30000);
                entry.outcome.then((value) => {
                  clearTimeout(timeout);
                  resolve(value);
                }, reject);
              });
            }),
          );
          page.off("requestfinished", finished);
          page.off("requestfailed", failed);
          return outcomes;
        },
      };
    };
    const visitTracker = trackOptionalRequests("POST", `${scopedApiPath}/visits`);
    let logoutRequest = null;
    await page.goto(`${base}/login/`);
    await page.getByLabel("이메일").fill(process.env.WORKBENCH_BROWSER_EMAIL);
    await page.getByLabel("비밀번호").fill(process.env.WORKBENCH_BROWSER_PASSWORD);
    const identityLoaded = waitForFinished("GET", "/api/auth/me");
    const organizationsLoaded = waitForFinished("GET", "/api/account/organizations");
    const workspaceListLoaded = waitForFinishedMatching(
      "GET",
      /^\/api\/organizations\/[^/]+\/workspaces$/,
    );
    const recentWorkspacesLoaded = waitForFinishedMatching(
      "GET",
      /^\/api\/organizations\/[^/]+\/workspaces\/recent$/,
    );
    const workspaceGroupsLoaded = waitForFinishedMatching(
      "GET",
      /^\/api\/organizations\/[^/]+\/workspaces\/groups$/,
    );
    const [, identityRequest, organizationsRequest, workspaceRequest, recentRequest, groupsRequest] =
      await Promise.all([
        page.waitForURL(/\/workspace\/$/),
        identityLoaded,
        organizationsLoaded,
        workspaceListLoaded,
        recentWorkspacesLoaded,
        workspaceGroupsLoaded,
        page.getByRole("button", { name: "로그인" }).click(),
      ]);
    await expectFinishedStatus(identityRequest, 200);
    await expectFinishedStatus(organizationsRequest, 200);
    await expectFinishedStatus(workspaceRequest, 200);
    await expectFinishedStatus(recentRequest, 200);
    await expectFinishedStatus(groupsRequest, 200);
    const landingWorkspacePath = new URL(workspaceRequest.url()).pathname;
    assert.equal(new URL(recentRequest.url()).pathname, `${landingWorkspacePath}/recent`);
    assert.equal(new URL(groupsRequest.url()).pathname, `${landingWorkspacePath}/groups`);
    const csrfToken = await page.evaluate(() =>
      decodeURIComponent(
        document.cookie
          .split("; ")
          .find((value) => value.startsWith("agent_factory_csrf="))
          ?.split("=")[1] ?? "",
      ),
    );
    assert(csrfToken, "login did not issue the CSRF cookie");
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
      const deferredLogoutFailure = request === logoutRequest;
      const permittedNavigationAbort =
        requestUrl.origin === new URL(base).origin &&
        error === "net::ERR_ABORTED" &&
        ((["document-reload", "react-to-legacy"].includes(navigationPhase) && isRevisionContent) ||
          visitTracker.permitsAbort(request));
      if (!permittedNavigationAbort && !deferredLogoutFailure)
        unexpectedFailedRequestCount += 1;
      retain(
        failedRequests,
        {
          url: request.url().slice(0, 500),
          error: error.slice(0, 300),
          navigationPhase,
          permittedNavigationAbort,
          deferredLogoutFailure,
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
      await page.locator('nav[aria-label="작업 목록"] button[title="문서"][aria-current="page"]').waitFor();
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
    const createDocument = page.getByRole("button", { name: "새 원본 문서", exact: true });
    await createDocument.waitFor();
    await createDocument.click();
    await page.locator(".af-document-header h1", { hasText: "새 원본 문서" }).waitFor();
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
    const concurrentUpdate = await page.evaluate(
      async ({ organization, workspace, record, csrfToken }) => {
        const response = await fetch(`/api/organizations/${organization}/workspaces/${workspace}/documents/${record.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
          body: JSON.stringify({
            title: "동시 변경",
            status: record.status,
            metadata: record.document_metadata,
            revision: record.revision,
          }),
        });
        return { status: response.status, body: (await response.text()).slice(0, 500) };
      },
      {
        organization: process.env.WORKBENCH_BROWSER_ORGANIZATION,
        workspace: process.env.WORKBENCH_BROWSER_WORKSPACE,
        record,
        csrfToken,
      },
    );
    assert.equal(concurrentUpdate.status, 200, concurrentUpdate.body);
    const staleUpdateUrl = `${base}/api/organizations/${process.env.WORKBENCH_BROWSER_ORGANIZATION}/workspaces/${process.env.WORKBENCH_BROWSER_WORKSPACE}/documents/${record.id}`;
    const staleUpdate = page.waitForResponse(
      (response) => response.url() === staleUpdateUrl && response.request().method() === "PUT",
    );
    const conflictRefresh = waitForFinished("GET", new URL(staleUpdateUrl).pathname);
    await page.getByRole("button", { name: "정보 저장" }).click();
    assert.equal((await staleUpdate).status(), 409);
    await expectFinishedStatus(await conflictRefresh, 200);
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
    const reloadedDocumentReads = [
      [waitForFinished("GET", `${scopedApiPath}/documents`), 200],
      [waitForFinished("GET", new URL(staleUpdateUrl).pathname), 200],
      [waitForFinished("GET", `${new URL(staleUpdateUrl).pathname}/revisions`), 200],
      [waitForFinished("GET", `${new URL(staleUpdateUrl).pathname}/revisions/1/content`), 200],
    ];
    navigationPhase = "document-reload";
    await page.reload();
    for (const [request, status] of reloadedDocumentReads)
      await expectFinishedStatus(await request, status);
    assert.equal(
      await page.getByRole("separator", { name: "사이드바 너비 조절" }).getAttribute("aria-valuenow"),
      "520",
    );
    navigationPhase = null;
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.getByTitle("계정").click();
    await page.locator('nav[aria-label="작업 목록"] button[title="계정"][aria-current="page"]').waitFor();
    await page.getByRole("button", { name: "테마", exact: true }).click();
    await page.getByText("서버 테마를 적용했습니다.", { exact: true }).waitFor();
    await page.getByLabel("기본 테마").selectOption("light");
    await page.getByLabel("기본 테마").selectOption("high-contrast");
    assert.equal(await page.evaluate(() => document.documentElement.dataset.afTheme), "high-contrast");
    await page.getByTitle("문서").click();
    await page.locator('nav[aria-label="작업 목록"] button[title="문서"][aria-current="page"]').waitFor();
    await page.getByText("DB-backed revision").waitFor();
    navigationPhase = "react-to-legacy";
    visitTracker.beginTransition(navigationPhase);
    await page.getByRole("link", { name: "기존 화면" }).click();
    await page.locator("[data-workspace-shell]").waitFor();
    await page.waitForFunction(
      ({ organizationId, workspaceId }) => {
        const organization = document.querySelector("[data-organization-select]");
        const currentWorkspace = document.querySelector("[data-header-workspace]");
        const selectedWorkspace = [...document.querySelectorAll("[data-workspace-id]")].find(
          (element) => element.dataset.workspaceId === workspaceId,
        );
        return (
          organization?.value === organizationId &&
          currentWorkspace &&
          !currentWorkspace.hidden &&
          Boolean(currentWorkspace.textContent?.trim()) &&
          selectedWorkspace?.getAttribute("aria-current") === "true"
        );
      },
      {
        organizationId: process.env.WORKBENCH_BROWSER_ORGANIZATION,
        workspaceId: process.env.WORKBENCH_BROWSER_WORKSPACE,
      },
    );
    assert.equal(
      await page.getByLabel("개인 또는 조직").inputValue(),
      process.env.WORKBENCH_BROWSER_ORGANIZATION,
    );
    assert.notEqual((await page.getByLabel("현재 작업공간").textContent()).trim(), "");
    assert.equal(
      await page
        .locator(`[data-workspace-id="${process.env.WORKBENCH_BROWSER_WORKSPACE}"]`)
        .getAttribute("aria-current"),
      "true",
    );
    await page.getByRole("button", { name: "문서", exact: true }).click();
    await page.getByRole("link", { name: "원본 문서 테이블", exact: true }).click();
    await page.getByText("동시 변경", { exact: true }).waitFor();
    visitTracker.endTransition(navigationPhase);
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
    await workspaceRow.waitFor({ state: "visible" });
    const selectionPath = `${scopedApiPath}/workbench/selection`;
    const selectionLoaded = waitForFinished("GET", selectionPath);
    navigationPhase = "legacy-to-react";
    visitTracker.beginTransition(navigationPhase);
    await workspaceRow.click();
    await expectFinishedStatus(await selectionLoaded, 200);
    await page.getByRole("navigation", { name: "작업 목록" }).waitFor();
    await page.getByText("DB-backed revision").waitFor();
    visitTracker.endTransition(navigationPhase);
    navigationPhase = null;
    let resolveLogoutTerminal;
    const logoutTerminal = new Promise((resolve) => {
      resolveLogoutTerminal = resolve;
    });
    const matchesLogout = (request) => {
      const requestUrl = new URL(request.url());
      return (
        request.method() === "POST" &&
        requestUrl.origin === new URL(base).origin &&
        requestUrl.pathname === "/api/auth/logout"
      );
    };
    const logoutStarted = (request) => {
      if (!logoutRequest && matchesLogout(request)) logoutRequest = request;
    };
    const logoutFinished = (request) => {
      if (request === logoutRequest)
        resolveLogoutTerminal({ outcome: "finished", request, transition: null });
    };
    const logoutFailed = (request) => {
      if (request === logoutRequest)
        resolveLogoutTerminal({
          outcome: "failed",
          request,
        });
    };
    page.on("request", logoutStarted);
    page.on("requestfinished", logoutFinished);
    page.on("requestfailed", logoutFailed);
    const logoutResponseSeen = page.waitForResponse((response) => {
      const responseUrl = new URL(response.url());
      return (
        response.request().method() === "POST" &&
        responseUrl.origin === new URL(base).origin &&
        responseUrl.pathname === "/api/auth/logout"
      );
    });
    const logoutStatus = await page.evaluate(async (csrfToken) => {
      return (
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { "X-CSRF-Token": csrfToken },
        })
      ).status;
    }, csrfToken);
    const logoutResponse = await logoutResponseSeen;
    assert.equal(logoutStatus, 204);
    assert.equal(logoutResponse.status(), 204);
    assert.equal(logoutResponse.request(), logoutRequest);
    assert.equal((await page.request.get(`${base}/api/auth/me`)).status(), 401);
    await page.goto(`${appBase}?${query}`);
    await page.waitForURL(/\/login\/$/);
    const logoutTerminalResult = await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("logout request did not reach a terminal event")),
        30000,
      );
      logoutTerminal.then((value) => {
        clearTimeout(timeout);
        resolve(value);
      }, reject);
    });
    page.off("request", logoutStarted);
    page.off("requestfinished", logoutFinished);
    page.off("requestfailed", logoutFailed);
    assert.equal(logoutTerminalResult.request, logoutRequest);
    if (logoutTerminalResult.outcome === "finished")
      await expectFinishedStatus(logoutTerminalResult.request, 204);
    else {
      assert.equal(new URL(logoutTerminalResult.request.url()).origin, new URL(base).origin);
      assert.equal(logoutTerminalResult.request.failure()?.errorText, "net::ERR_ABORTED");
    }
    const visits = await visitTracker.closeAndSettle();
    for (const visit of visits) {
      assert.equal(visit.request.method(), "POST");
      assert.equal(new URL(visit.request.url()).origin, new URL(base).origin);
      assert.equal(new URL(visit.request.url()).pathname, `${scopedApiPath}/visits`);
      if (visit.outcome === "finished") await expectFinishedStatus(visit.request, 204);
      else {
        assert(
          ["react-to-legacy", "legacy-to-react"].includes(visit.terminalTransition),
          `visit abort was not bound to an explicit route transition (started phase: ${visit.startedPhase ?? "none"}, page: ${visit.startedPage})`,
        );
        assert.equal(visit.request.failure()?.errorText, "net::ERR_ABORTED");
      }
    }
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
