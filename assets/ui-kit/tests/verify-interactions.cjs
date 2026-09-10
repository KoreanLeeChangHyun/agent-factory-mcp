const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:8765/assets/ui-kit/');
    await page.waitForFunction(() => !!window.afCatalog);
    await page.locator('[data-demo-toast=error]').click();
    await page.waitForSelector('.af-toast');
    await page.locator('[data-demo-toast=error]').click();
    assert.equal(await page.locator('.af-toast').count(), 1, 'same ID must update');
    await page.locator('.af-toast button').filter({ hasText:'닫기' }).click();
    await page.waitForSelector('.af-toast', { state:'detached' });
    await page.mouse.move(0, 0);
    await page.evaluate(() => window.afCatalog.notifications.show({ title:'타이머 예제', duration:400 }));
    await page.waitForSelector('.af-toast');
    await page.waitForSelector('.af-toast', { state:'detached' });
    await page.locator('#open-confirm').click();
    await page.locator('wa-dialog button').filter({ hasText:'취소' }).waitFor({ state:'visible' });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('#confirm-result').textContent.includes('취소'));
    assert.equal(await page.locator(':focus').getAttribute('id'), 'open-confirm');
    await page.locator('#open-confirm').click();
    await page.locator('wa-dialog button').filter({ hasText:'삭제' }).click();
    await page.waitForFunction(() => document.querySelector('#confirm-result').textContent.includes('확인'));
    await page.locator('#open-drawer').click();
    await page.locator('#close-drawer').click();
    await page.waitForFunction(() => document.activeElement.id === 'open-drawer');
    await page.evaluate(() => window.afCatalog.destroy());
    assert.equal(await page.locator('.af-toast-region').count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS: toast dedup/dismiss/timer, confirm cancel/accept, drawer close, focus restoration, disposal');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
