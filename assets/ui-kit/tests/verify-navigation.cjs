const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror',error => errors.push(error.message));
    await page.goto('http://127.0.0.1:8765/assets/ui-kit/');
    await page.waitForFunction(() => !!window.afCatalog);
    const tabs = page.locator('#navigation-example [role=tab]');
    await tabs.first().focus(); await page.keyboard.press('ArrowRight');
    assert.equal(await tabs.nth(1).getAttribute('aria-selected'),'true');
    await page.keyboard.press('ArrowRight');
    assert.equal(await tabs.first().getAttribute('aria-selected'),'true');
    await page.locator('#navigation-example').getByRole('button',{name:'다음',exact:true}).click();
    assert.match(await page.locator('#navigation-example').getByRole('navigation',{name:'페이지 이동'}).textContent(),/2 \/ 3/);
    await page.locator('#menu-button').focus(); await page.keyboard.press('ArrowDown');
    await page.waitForFunction(() => document.activeElement.textContent === '복사');
    await page.keyboard.press('End');
    assert.equal(await page.locator(':focus').textContent(),'이름 변경');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator(':focus').getAttribute('id'),'menu-button');
    await page.locator('#popover-button').click();
    await page.waitForFunction(() => document.querySelector('#popover-surface').matches(':popover-open'));
    await page.locator('h1').first().click();
    await page.waitForFunction(() => !document.querySelector('#popover-surface').matches(':popover-open'));
    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors,[]);
    console.log('PASS: tab keyboard/disabled skip, pagination, menu keyboard, popover dismissal, narrow layout');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
