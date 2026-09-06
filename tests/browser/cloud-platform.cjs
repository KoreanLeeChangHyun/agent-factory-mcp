// Disposable actual server test. No API interception or fabricated editor responses.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const url = process.env.CLOUD_BROWSER_URL;
  assert(url && new URL(url).hostname === '127.0.0.1');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext();
    await context.addCookies([{ name: process.env.CLOUD_BROWSER_COOKIE_NAME,
      value: process.env.CLOUD_BROWSER_COOKIE, url }]);
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url + '/workspace/');
    await page.locator(`[data-workspace-list] [data-workspace-id="${process.env.CLOUD_BROWSER_WORKSPACE}"]`).click();
    // A fresh workspace has no selected activity; open Documents directly.
    if (await page.locator('[data-mcp-dismiss]').isVisible()) await page.locator('[data-mcp-dismiss]').click();
    await page.locator('[data-activity="documents"]').click();
    const file = page.locator(`[data-key="${process.env.CLOUD_BROWSER_DOCUMENT}"]`);
    const readable = async () => {
      await page.getByRole('tab', { name: 'cloud.md', exact: true }).waitFor({ state: 'visible' });
      await page.locator('.de-panel:visible pre').waitFor({ state: 'visible' });
      await page.waitForFunction(() => [...document.querySelectorAll('.de-panel pre')]
        .some(node => node.getClientRects().length > 0 &&
          getComputedStyle(node).visibility === 'visible' && node.textContent.includes('editor_run_1')));
    };
    await file.dblclick();
    await readable();
    await page.getByRole('button', { name: 'cloud.md 닫기', exact: true }).click();
    await page.getByRole('tab', { name: 'cloud.md', exact: true }).waitFor({ state: 'detached' });
    await file.dblclick();
    await readable();
    assert.deepEqual(errors, []);
    console.log('Actual HTTP current editor opened, read, closed and reopened the durable Document.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
