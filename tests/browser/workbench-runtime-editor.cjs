// WORKBENCH_URL=http://127.0.0.1:4173 NODE_PATH=/tmp/af-pw/node_modules node tests/browser/workbench-runtime-editor.cjs
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
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.route("**/api/auth/me", (route) => route.fulfill({ json: { user: { id: userId } } }));
    await context.route("**/api/appearance/theme-profile", (route) => route.fulfill({ json: profile }));
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto(`${base}/workbench`);
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
    assert.equal(await page.getByRole("button", { name: "사이드바" }).getAttribute("aria-expanded"), "false");
    await page.getByRole("button", { name: "사이드바" }).click();

    await page.getByLabel("기본 테마").selectOption("light");
    assert.equal(await page.evaluate(() => document.documentElement.dataset.afTheme), "light");
    await page.getByLabel("기본 테마").selectOption("dark");
    assert.equal(await page.evaluate(() => document.documentElement.dataset.afTheme), "dark");
    await page.getByLabel("기본 테마").selectOption("high-contrast");
    assert.equal(await page.evaluate(() => document.documentElement.dataset.afTheme), "high-contrast");

    await page.goto(`${base}/authoring`);
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
