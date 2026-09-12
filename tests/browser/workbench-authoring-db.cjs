// Authenticated disposable-server test. No API interception or fabricated Workbench responses.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");

(async () => {
  const base = process.env.WORKBENCH_BROWSER_URL;
  assert(base && new URL(base).hostname === "127.0.0.1");
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addCookies([
      { name: process.env.WORKBENCH_BROWSER_COOKIE_NAME, value: process.env.WORKBENCH_BROWSER_COOKIE, url: base },
      { name: "agent_factory_csrf", value: "workbench-browser-csrf", url: base },
    ]);
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const query = new URLSearchParams({
      organization: process.env.WORKBENCH_BROWSER_ORGANIZATION,
      workspace: process.env.WORKBENCH_BROWSER_WORKSPACE,
    });
    await page.goto(`${base}/authoring?${query}`);
    await page.getByRole("heading", { name: "Workbench 구성" }).waitFor();
    await page.getByLabel("에셋 검색").fill("button@1");
    const add = page.getByRole("button", { name: "button@1 패널에 추가", exact: true });
    await add.focus();
    await add.press("Enter");
    await page.getByRole("button", { name: "초안 저장" }).click();
    await page.getByText("초안 revision 2을 저장했습니다.").waitFor();
    await page.getByRole("button", { name: "게시", exact: true }).click();
    await page.getByRole("heading", { name: "게시된 release 1" }).waitFor();
    await page.reload();
    await page.getByRole("heading", { name: "게시된 release 1" }).waitFor();
    await page.getByLabel("기본 테마").selectOption("high-contrast");
    assert.equal(await page.evaluate(() => document.documentElement.dataset.afTheme), "high-contrast");
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    console.log("Authenticated Workbench draft save, publish, durable reload, keyboard, theme and narrow layout passed.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
