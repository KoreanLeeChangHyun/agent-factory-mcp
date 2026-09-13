// Run from repository root: NODE_PATH=/path/to/playwright/node_modules node assets/sources/ui-kit/verify.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require('playwright');
(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json')));
  for (const file of manifest.files) {
    const bytes = fs.readFileSync(path.join(__dirname, file.path));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), file.sha256);
  }
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      if (!route.request().url().startsWith('http://127.0.0.1:8765/')) {
        errors.push('External request: ' + route.request().url());
        return route.abort();
      }
      return route.continue();
    });
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('http://127.0.0.1:8765/assets/sources/ui-kit/');
      assert.equal(await page.locator('.icon-sample svg').count(), 30);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.locator('#menu-trigger').focus();
      await page.keyboard.press('ArrowDown');
      await page.waitForFunction(() => document.querySelector('#demo-menu').style.left !== '');
      assert.equal(await page.locator(':focus').textContent(), '복사');
      await page.keyboard.press('End');
      assert.equal(await page.locator(':focus').textContent(), '삭제');
      await page.keyboard.press('Home');
      assert.equal(await page.locator(':focus').textContent(), '복사');
      await page.keyboard.press('ArrowDown');
      assert.equal(await page.locator(':focus').textContent(), '이름 변경');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator(':focus').getAttribute('id'), 'menu-trigger');
      assert.ok(await page.locator('#demo-menu').isHidden());
      await page.keyboard.press('Space');
      await page.keyboard.press('Enter');
      assert.match(await page.locator('#demo-result').textContent(), /복사 선택/);
      await page.locator('#menu-trigger').click();
      await page.keyboard.press('Tab');
      assert.equal(await page.locator(':focus').getAttribute('id'), 'next-control');
      await page.locator('#menu-trigger').click();
      await page.locator('h2').first().click();
      assert.ok(await page.locator('#demo-menu').isHidden());
      // Force the anchor against the viewport bottom/right to exercise flip/shift.
      await page.locator('#menu-trigger').evaluate(el => Object.assign(el.style, { position: 'fixed', right: '0', bottom: '0' }));
      await page.locator('#menu-trigger').click();
      await page.waitForTimeout(100);
      const box = await page.locator('#demo-menu').boundingBox();
      assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= 900);
      await page.screenshot({ path: '/tmp/ui-source-kit-' + width + '.png', fullPage: true });
      await page.evaluate(() => window.demoMenu.destroy());
      assert.ok(await page.locator('#demo-menu').isHidden());
    }
    assert.deepEqual(errors, []);
    console.log('PASS: 20 hashes, 30 SVG instances, desktop/mobile layout, keyboard, dismissal, viewport collision, cleanup, no external runtime requests');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
