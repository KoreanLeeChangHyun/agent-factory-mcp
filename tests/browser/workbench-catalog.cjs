// CATALOG_URL=http://127.0.0.1:4173 NODE_PATH=/tmp/af-pw/node_modules node tests/browser/workbench-catalog.cjs
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

(async () => {
  const base = process.env.CATALOG_URL || "http://127.0.0.1:4173";
  const output = process.env.CATALOG_SCREENSHOT_DIR || "/tmp/agent-factory-catalog";
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(`${base}/`);
    await page.locator("main").waitFor();
    assert.equal(await page.locator("main").getAttribute("class"), "health-shell");

    await page.goto(`${base}/catalog`);
    await page.getByRole("heading", { name: "공통 에셋 카탈로그" }).waitFor();
    for (const theme of ["dark", "light", "high-contrast"]) {
      await page.getByLabel("테마").selectOption(theme);
      for (const width of ["180", "268", "520"]) {
        await page.getByLabel("사이드바 폭").selectOption(width);
        const preview = page.locator(".catalog-preview");
        assert.equal(Math.round((await preview.boundingBox()).width), Number(width));
        await page.screenshot({ path: path.join(output, `${theme}-${width}.png`) });
      }
    }

    await page.getByRole("button", { name: "search-list@1" }).click();
    await page.getByLabel("목록 검색").fill("존재하지 않음");
    await page.getByText("항목 없음").waitFor();
    await page.getByRole("button", { name: "number-input@1" }).click();
    const number = page.getByLabel("number-input 예제");
    await number.fill("3");
    await number.fill("");
    await number.fill("4");
    assert.deepEqual(pageErrors, []);
    await page.getByRole("button", { name: "split@1" }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    const separator = page.getByRole("separator", { name: "분할 위치 조절" });
    await page.waitForFunction(
      () => document.querySelector("[role='separator']")?.getAttribute("aria-orientation") === "horizontal",
    );
    assert.equal(await separator.getAttribute("aria-orientation"), "horizontal");
    const before = await page.locator(".af-layout-split > .af-card").first().boundingBox();
    await separator.press("ArrowDown");
    const after = await page.locator(".af-layout-split > .af-card").first().boundingBox();
    assert(after.height > before.height, "mobile split keyboard input must visibly resize the first track");
    await page.screenshot({ path: path.join(output, "mobile-390-split.png") });

    const opener = page.getByRole("button", { name: "대화상자" });
    await opener.focus();
    await opener.click();
    await page.getByRole("dialog").waitFor();
    await page.keyboard.press("Escape");
    assert(await opener.evaluate((element) => element === document.activeElement));
    await page.reload();
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    console.log(`PASS Workbench catalog interactions and screenshots: ${output}`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
