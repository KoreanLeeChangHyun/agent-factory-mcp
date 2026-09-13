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
    const collection = page.locator('#collection-example');
    assert.equal(await collection.locator('.af-resource-select').count(),5);
    await collection.getByRole('button',{name:'다음',exact:true}).click();
    await collection.getByRole('button',{name:'예제 리소스 6',exact:true}).click();
    assert.match(await collection.locator('.af-detail-pane').textContent(),/예제 리소스 6/);
    await collection.getByLabel('유형 필터').selectOption('document');
    assert.match(await collection.locator('nav').textContent(),/1 \/ 2/);
    await collection.getByLabel('리소스 검색').fill('없는 이름');
    assert.equal(await collection.locator('.af-resource-select').count(),0);
    await collection.getByRole('button',{name:'필터 초기화'}).click();
    assert.equal(await collection.locator('.af-resource-select').count(),5);
    const settings = page.locator('#settings-example');
    await settings.getByLabel('표시 이름').fill('새 이름');
    await settings.getByRole('button',{name:'취소',exact:true}).click();
    assert.equal(await settings.getByLabel('표시 이름').inputValue(),'예제 이름');
    await settings.getByLabel('표시 이름').fill('실패');
    await settings.getByRole('button',{name:'저장',exact:true}).click();
    await page.waitForFunction(() => document.querySelector('#settings-example').textContent.includes('저장하지 못했습니다.'));
    await settings.getByLabel('표시 이름').fill('성공 이름');
    await settings.getByRole('button',{name:'저장',exact:true}).click();
    await page.waitForFunction(() => document.querySelector('#settings-example').textContent.includes('저장했습니다.'));
    await settings.getByLabel('표시 이름').fill('미저장');
    await settings.getByRole('button',{name:'취소',exact:true}).click();
    assert.equal(await settings.getByLabel('표시 이름').inputValue(),'성공 이름');
    for (const width of [1280,390]) {
      await page.setViewportSize({width,height:900});
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: collection filter/search/paging/detail/reset; settings cancel/failure/success; narrow layout');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
