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
    const picker = page.locator('#upload-example input');
    const start = page.locator('#upload-example > button');
    await picker.setInputFiles({ name:'fail-example.txt', mimeType:'text/plain', buffer:Buffer.from('example') });
    await start.click();
    await page.getByRole('button', { name:'재시도', exact:true }).waitFor();
    await page.getByRole('button', { name:'재시도', exact:true }).click();
    await page.waitForFunction(() => document.querySelector('.af-upload-list').textContent.includes('완료'));
    await picker.setInputFiles({ name:'cancel.txt', mimeType:'text/plain', buffer:Buffer.from('cancel me') });
    await start.click();
    await page.locator('.af-upload-list button').filter({ hasText:'취소' }).click();
    assert.equal(await page.locator('.af-upload-list').getByText('cancel.txt', { exact:false }).count(), 0);
    await picker.setInputFiles({ name:'large.txt', mimeType:'text/plain', buffer:Buffer.alloc(1024 * 1024 + 1) });
    assert.ok((await page.locator('#upload-example [role=status]').textContent()).length > 0);
    assert.equal(await page.locator('.af-upload-list li').count(), 1);
    await page.evaluate(() => window.afCatalog.uploads.destroy());
    assert.equal(await page.locator('#upload-example input').count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS: upload failure/retry/success, cancellation, size restriction, disposal');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
