const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = [], external = [];
    page.on('pageerror',error => errors.push(error.message));
    page.on('request',request => { if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:8765/')) external.push(request.url()); });
    await page.goto('http://127.0.0.1:8765/assets/ui-kit/');
    await page.waitForFunction(() => !!window.afCatalog);
    await page.locator('#tooltip-button').focus();
    await page.waitForFunction(() => document.querySelector('wa-tooltip').open);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('wa-tooltip').open);
    for (const width of [1280,768,390]) {
      await page.setViewportSize({width,height:900});
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await page.evaluate(() => window.afCatalog.destroy());
    assert.deepEqual(errors,[]);
    assert.deepEqual(external,[]);
    console.log('PASS: tooltip focus/Escape/disposal, responsive layout, no external runtime requests');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
