// WORKBENCH_URL=http://127.0.0.1:4173 NODE_PATH=/tmp/af-pw/node_modules node tests/workbenches/browser/workbench-runtime-editor.cjs
const { chromium } = require("playwright");
const assert = require("node:assert/strict");

const userId = "01234567-89ab-cdef-0123-456789abcdef";
const profile = {
  schemaVersion: "1.0",
  userId: userId.replaceAll("-", ""),
  revision: 1,
  base: "dark",
  density: "compact",
  overrides: {},
  reducedMotion: false,
};

(async () => {
  const base = process.env.WORKBENCH_URL || "http://127.0.0.1:4173";
  const appBase = `${(process.env.WORKBENCH_APP_BASE || `${base}/workbench/`).replace(/\/+$/, "")}/`;
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.route("**/api/auth/me", (route) => route.fulfill({ json: { user: { id: userId } } }));
    await context.route("**/api/appearance/theme-profile", (route) => route.fulfill({ json: profile }));
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto(`${appBase}runtime-preview`);
    const documentRow = page.locator(".af-nav-row", { hasText: "미리보기 문서" });
    await documentRow.waitFor();
    await documentRow.focus();
    assert(await documentRow.evaluate((element) => element === document.activeElement));
    await documentRow.press("Enter");
    await page.getByText(/작성기에서 제어하는 미리보기 데이터/).waitFor();
    const documentContent = page.locator('[data-component-id="document-content"] p');
    const beforeRefresh = await documentContent.textContent();
    await page.getByRole("button", { name: "새로고침" }).click();
    await page.waitForFunction(
      (before) => document.querySelector('[data-component-id="document-content"] p')?.textContent !== before,
      beforeRefresh,
    );

    const separator = page.getByRole("separator", { name: "사이드바 너비 조절" });
    for (let index = 0; index < 6; index += 1) await separator.press("ArrowLeft");
    assert.equal(await separator.getAttribute("aria-valuenow"), "180");
    for (let index = 0; index < 22; index += 1) await separator.press("ArrowRight");
    assert.equal(await separator.getAttribute("aria-valuenow"), "520");
    await page.reload();
    await page.locator(".af-nav-row", { hasText: "미리보기 문서" }).waitFor();
    assert.equal(
      await page.getByRole("separator", { name: "사이드바 너비 조절" }).getAttribute("aria-valuenow"),
      "520",
    );
    const expand = page.getByRole("button", { name: /미리보기 문서.*펼치기/ });
    await expand.click();
    await page.getByRole("button", { name: "시작 안내 항목", exact: true }).waitFor();
    await page.reload();
    assert.equal(
      await page.getByRole("button", { name: /미리보기 문서.*펼치기/ }).getAttribute("aria-expanded"),
      "true",
    );
    await page.getByRole("button", { name: "시작 안내 항목", exact: true }).waitFor();

    const sidebarToggle = page.getByRole("button", { name: "사이드바" });
    await sidebarToggle.click();
    assert.equal(await sidebarToggle.getAttribute("aria-expanded"), "false");
    await page.reload();
    await page.waitForFunction(
      () => document.querySelector(".af-runtime-sidebar-toggle")?.getAttribute("aria-expanded") === "false",
    );
    assert.equal(await page.getByRole("button", { name: "사이드바" }).getAttribute("aria-expanded"), "false");
    await page.getByRole("button", { name: "사이드바" }).click();

    await page.getByLabel("기본 테마").selectOption("light");
    assert.equal(await page.evaluate(() => document.documentElement.dataset.afTheme), "light");
    await page.getByLabel("기본 테마").selectOption("dark");
    assert.equal(await page.evaluate(() => document.documentElement.dataset.afTheme), "dark");
    await page.getByLabel("기본 테마").selectOption("high-contrast");
    assert.equal(await page.evaluate(() => document.documentElement.dataset.afTheme), "high-contrast");

    await page.goto(`${appBase}authoring`);
    await page.getByRole("heading", { name: "Workbench 구성" }).waitFor();
    await page.getByLabel("에셋 검색").fill("button@1");
    const add = page.getByRole("button", { name: "button@1 패널에 추가", exact: true });
    await add.focus();
    await add.press("Enter");
    await page.getByRole("button", { name: /button.*button@1/ }).waitFor();
    await page.getByRole("button", { name: "실행 취소" }).click();
    assert.equal(await page.getByRole("button", { name: /button.*button@1/ }).count(), 0);

    const json = page.getByLabel("Workbench 정의 JSON");
    const validDraft = await json.inputValue();
    await json.fill('{"unsafe":"draft"}');
    await page.getByRole("button", { name: "가져오기 및 검증" }).click();
    await page.getByRole("alert").waitFor();
    assert(await page.getByText("정의가 유효합니다.").isVisible());
    await json.fill(validDraft);
    await page.getByRole("button", { name: "가져오기 및 검증" }).click();

    const tenantDefinition = (title) => {
      const definition = JSON.parse(validDraft);
      definition.descriptor.title = title;
      return definition;
    };
    const definitions = {
      a: {
        id: "definition-a",
        key: "documents",
        title: "Tenant A",
        state: "draft",
        revision: 4,
        latestReleaseId: "release-a",
        definition: tenantDefinition("Tenant A stale"),
      },
      b: {
        id: "definition-b",
        key: "documents",
        title: "Tenant B",
        state: "draft",
        revision: 2,
        latestReleaseId: null,
        definition: tenantDefinition("Tenant B current"),
      },
    };
    await context.route(/\/api\/workspaces\/(?:a|b)\/workbenches(?:\/[^?#]*)?(?:\?[^#]*)?$/, async (route) => {
      const url = new URL(route.request().url());
      const match = url.pathname.match(/\/api\/workspaces\/(a|b)\/workbenches(?:\/(.*))?$/);
      if (!match) return route.continue();
      const [, workspace, tail] = match;
      const stage = !tail ? "list" : tail.endsWith("/draft") ? "draft" : "release";
      const record = definitions[workspace];
      const body =
        stage === "list"
          ? { items: [{ ...record, definition: undefined }], permissions: ["workbench.read", "workbench.preview"] }
          : stage === "draft"
            ? record
            : {
                id: "release-a",
                definitionId: record.id,
                definitionRevision: 4,
                releaseNumber: 99,
                definitionDigest: "sha256:stale",
                definition: record.definition,
                publishedAt: new Date().toISOString(),
              };
      try {
        await route.fulfill({ json: body });
      } catch {
        /* The superseded request was aborted. */
      }
    });
    const switchPage = await context.newPage();
    await switchPage.addInitScript(() => {
      const originalFetch = window.fetch.bind(window);
      let delayed = null;
      window.__workbenchDelay = {
        arm(stage) {
          let release;
          const gate = new Promise((resolve) => {
            release = resolve;
          });
          delayed = { stage, gate, release, started: false, finished: false };
        },
        release() {
          delayed?.release();
        },
        state() {
          return delayed ? { stage: delayed.stage, started: delayed.started, finished: delayed.finished } : null;
        },
      };
      window.fetch = async (input, init) => {
        const response = await originalFetch(input, init);
        const target = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
        const match = new URL(target, window.location.href).pathname.match(
          /\/api\/workspaces\/(a|b)\/workbenches(?:\/(.*))?$/,
        );
        if (!match) return response;
        const [, workspace, tail] = match;
        const stage = !tail ? "list" : tail.endsWith("/draft") ? "draft" : "release";
        const current = delayed;
        if (current && workspace === "a" && stage === current.stage) {
          const body = await response.arrayBuffer();
          const storedResponse = new Response(body, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
          current.started = true;
          await current.gate;
          current.finished = true;
          return storedResponse;
        }
        return response;
      };
    });
    await switchPage.goto(`${appBase}authoring`);
    await switchPage.getByRole("heading", { name: "Workbench 구성" }).waitFor();
    const selectWorkspace = (workspace) =>
      switchPage.evaluate((value) => {
        history.pushState({}, "", `/authoring?organization=organization-${value}&workspace=${value}`);
        dispatchEvent(new PopStateEvent("popstate"));
      }, workspace);
    for (const stage of ["list", "draft", "release"]) {
      await switchPage.evaluate((value) => window.__workbenchDelay.arm(value), stage);
      await selectWorkspace("a");
      await switchPage.waitForFunction(() => window.__workbenchDelay.state()?.started === true);
      await selectWorkspace("b");
      await switchPage.waitForFunction(() =>
        document.querySelector('textarea[aria-label="Workbench 정의 JSON"]')?.value.includes("Tenant B current"),
      );
      assert((await switchPage.getByLabel("Workbench 정의 JSON").inputValue()).includes("Tenant B current"));
      assert.equal(await switchPage.getByRole("heading", { name: "게시된 release 99" }).count(), 0);
      await switchPage.evaluate(() => window.__workbenchDelay.release());
      await switchPage.waitForFunction(() => window.__workbenchDelay.state()?.finished === true);
      await switchPage.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      assert((await switchPage.getByLabel("Workbench 정의 JSON").inputValue()).includes("Tenant B current"));
      assert.equal(await switchPage.getByRole("heading", { name: "게시된 release 99" }).count(), 0);
    }
    await switchPage.close();

    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(pageErrors, []);
    console.log(
      "PASS asserted Workbench composition, width/open restoration, theme switching, authoring, keyboard, and narrow viewport",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
