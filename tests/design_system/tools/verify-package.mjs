import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { chromium } from 'playwright';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const archive = path.join(root,'release/agent-factory-ui-assets.tar.gz');
const metadata = JSON.parse(await readFile(path.join(root,'release/archive.json')));
assert.equal(createHash('sha256').update(await readFile(archive)).digest('hex'),metadata.sha256);
const folder = await mkdtemp(path.join(tmpdir(),'af-ui-unpack-'));
const extracted = spawnSync('tar',['-xzf',archive,'-C',folder],{stdio:'inherit'});
assert.equal(extracted.status,0);
const manifest = JSON.parse(await readFile(path.join(folder,'MANIFEST.json')));
for (const file of manifest.files) {
  assert.ok(!file.path.includes('node_modules') && !file.path.includes('release/'));
  assert.equal(createHash('sha256').update(await readFile(path.join(folder,file.path))).digest('hex'),file.sha256);
}
const server = spawn('python3',['-m','http.server','8766','--bind','127.0.0.1'],{cwd:folder,stdio:'ignore'});
let browser;
try {
  let ready = false;
  for(let i=0;i<30;i++) {
    try { ready = (await fetch('http://127.0.0.1:8766/MANIFEST.json')).ok; } catch { /* server not listening yet */ }
    if(ready) break;
    await new Promise(resolve => setTimeout(resolve,100));
  }
  assert.ok(ready);
  browser = await chromium.launch();
  const page = await browser.newPage({viewport:{width:390,height:900}});
  const errors = [];
  page.on('pageerror',error => errors.push(error.message));
  page.on('response',response => { if(response.status() >= 400) errors.push(response.status() + ' ' + response.url()); });
  await page.goto('http://127.0.0.1:8766/assets/ui-kit/');
  await page.waitForFunction(() => !!window.afCatalog);
  assert.equal(await page.locator('#icon-example svg').count(),33);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.locator('#open-confirm').click();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('#confirm-result').textContent.includes('취소'));
  assert.deepEqual(errors,[]);
  console.log('PASS: independent archive hashes, catalog/css/modules/icons loading, mobile layout and dialog');
} finally { await browser?.close(); server.kill('SIGTERM'); }
