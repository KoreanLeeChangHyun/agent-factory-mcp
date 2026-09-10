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
    const remote = page.locator('#remote-choice-ts-control');
    await remote.fill('디자인');
    await page.waitForFunction(() => document.querySelector('#remote-status').textContent.includes('1개 결과'));
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    assert.equal(await page.locator('#remote-choice').inputValue(),'디자인');
    await page.evaluate(() => document.querySelector('#remote-choice').tomselect.clear());
    await remote.fill('실패');
    await page.waitForFunction(() => document.querySelector('#remote-status').textContent.includes('검색 실패'));
    await remote.fill('없는값');
    await page.waitForFunction(() => document.querySelector('#remote-status').textContent.includes('결과 없음'));
    const search = page.locator('#collection-example input[type=search]');
    await search.evaluate(node => {
      node.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));
      node.value = '없는조합값'; node.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));
    });
    assert.equal(await page.locator('#collection-example .af-resource-select').count(),5);
    await search.evaluate(node => node.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true})));
    assert.equal(await page.locator('#collection-example .af-resource-select').count(),0);
    assert.equal(await page.locator('#icon-example svg').count(),33);
    const icon = page.locator('#icon-example svg').first();
    assert.equal(await icon.getAttribute('aria-hidden'),'true');
    assert.equal(await icon.evaluate(node => getComputedStyle(node).strokeWidth),'1.4px');
    await page.getByRole('switch',{name:'알림 사용'}).check();
    assert.ok(await page.getByRole('switch',{name:'알림 사용'}).isChecked());
    assert.deepEqual(errors,[]);
    console.log('PASS: remote select success/error/empty, IME search suppression, icons, native switch');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
