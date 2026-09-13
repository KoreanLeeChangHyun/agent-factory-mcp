// NODE_PATH=assets/ui-kit/node_modules node tests/administration/browser/admin-assets.cjs
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');

// Only this loopback fixture supplies a synthetic principal; production uses session auth.
const server = spawn('.venv/bin/python', ['-u', '-c', `
import socket
from uuid import UUID
import uvicorn
from fastapi import Request
from app.main import create_app
from app.common.errors import AuthenticationError
from app.modules.auth.dependencies import get_current_principal
from app.modules.auth.service import Principal
app = create_app()
def principal(request: Request):
    role = request.headers.get('x-test-role')
    if role is None:
        raise AuthenticationError('authentication_required')
    return Principal(UUID('11111111-1111-4111-8111-111111111111'), 'test@example.test', 'Test', role == 'super')
app.dependency_overrides[get_current_principal] = principal
sock = socket.socket()
sock.bind(('127.0.0.1', 0))
print(sock.getsockname()[1], flush=True)
uvicorn.Server(uvicorn.Config(app, log_level='error')).run(sockets=[sock])
`], {
  stdio: ['ignore', 'pipe', 'inherit'],
  env: {...process.env, AGENT_FACTORY_ROOT_PATH:'/factory'},
});

(async () => {
  let browser;
  try {
    const [output] = await once(server.stdout, 'data');
    const url = `http://127.0.0.1:${Number(String(output).trim())}/factory/admin/assets/`;
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage({ extraHTTPHeaders: { 'x-test-role': 'super' }, reducedMotion:'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let expectedUploadErrors = 0;
    page.on('console', message => {
      if (message.type() !== 'error') return;
      if (process.env.AF_CAPTURE_DIR && /^\[Uppy\] \[\d{2}:\d{2}:\d{2}\] 데모에서 만든 첫 시도 실패$/.test(message.text())) {
        expectedUploadErrors++; return;
      }
      errors.push(message.text());
    });
    const navigationStarted = performance.now();
    await page.goto(url);
    await page.waitForFunction(() => !!window.afCatalog);
    const navigationMs = Math.round(performance.now() - navigationStarted);
    assert(await page.locator('#icon-example .af-icon-button').evaluate(el=>{
      const rect=el.getBoundingClientRect(); return rect.width===rect.height;
    }),'Icon buttons stay square inside the grid');
    const splitRoot = page.locator('.split-example-shell > [data-scope="splitter"][data-part="root"]');
    const splitHandle = splitRoot.locator(':scope > [data-part="resize-trigger"]');
    await splitHandle.focus();
    const splitBefore = Number(await splitHandle.getAttribute('aria-valuenow'));
    await page.keyboard.press('ArrowRight');
    assert(Number(await splitHandle.getAttribute('aria-valuenow')) > splitBefore);
    const splitCaptureDirectory = process.env.AF_CAPTURE_DIR ? path.resolve(process.env.AF_CAPTURE_DIR) : null;
    if (splitCaptureDirectory) {
      await fs.mkdir(splitCaptureDirectory, { recursive:true });
      await splitRoot.screenshot({ path:path.join(splitCaptureDirectory,'split-resized.png') });
    }
    const tree = page.locator('#explorer-example');
    const item = key => tree.locator(`[data-key="${key}"]`);
    await item('readme').locator(':scope > .af-explorer-line').click();
    assert.equal(await item('readme').getAttribute('aria-selected'),'true');
    await page.keyboard.press('Shift+ArrowDown');
    assert.equal(await item('design').getAttribute('aria-selected'),'true');
    assert.equal(await item('readme').getAttribute('aria-selected'),'true');
    await item('locked-file').locator(':scope > .af-explorer-line').click();
    assert.equal(await item('locked-file').getAttribute('aria-selected'),'false');
    await item('docs').focus(); await page.keyboard.press('ArrowLeft');
    assert.equal(await item('readme').count(),0);
    await page.keyboard.press('ArrowRight');
    assert.equal(await item('readme').count(),1);
    await page.keyboard.press('ArrowRight');
    assert.equal(await tree.locator(':focus').getAttribute('data-key'),'readme');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#explorer-result').textContent(),'항목 열기 예제');
    assert.equal(await tree.locator('[tabindex="0"]').count(),1);
    assert.equal(await item('readme').locator(':scope > .af-explorer-line').evaluate(el=>el.getBoundingClientRect().height),22);
    const settleOverlay = selector => page.locator(selector).evaluate(async el=>{
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      await Promise.all(el.shadowRoot.getAnimations().map(animation=>animation.finished.catch(()=>{})));
    });
    if (process.env.AF_CAPTURE_DIR) {
      const directory = path.resolve(process.env.AF_CAPTURE_DIR);
      await fs.mkdir(directory, {recursive:true});
      for (const width of [1440,390]) {
        await page.setViewportSize({width,height:1000});
        await page.screenshot({path:path.join(directory,`catalog-${width}.png`),fullPage:true});
        const sections = page.locator('.catalog-domain__items > article');
        assert.equal(await sections.count(),14,'Capture every top-level catalog example');
        const firstAssetBox = await sections.first().evaluate(article => {
          const box = article.getBoundingClientRect();
          const title = article.querySelector('h3').getBoundingClientRect();
          const asset = article.querySelector('#icon-example').getBoundingClientRect();
          const style = getComputedStyle(article);
          return {
            border: style.borderTopWidth,
            titleInside: title.left >= box.left && title.right <= box.right,
            assetInside: asset.left >= box.left && asset.right <= box.right,
          };
        });
        assert.deepEqual(firstAssetBox,{border:'1px',titleInside:true,assetInside:true});
        for (let index=0;index<await sections.count();index++) {
          await sections.nth(index).screenshot({path:path.join(directory,`section-${String(index+1).padStart(2,'0')}-${width}.png`)});
        }
      }
      await page.setViewportSize({width:1440,height:1000});
      await page.locator('#open-confirm').click();
      await page.locator('wa-dialog button').filter({hasText:'취소'}).waitFor();
      await settleOverlay('wa-dialog');
      await page.screenshot({path:path.join(directory,'confirm.png')});
      await page.keyboard.press('Escape');
      await page.locator('#open-drawer').click();
      await page.locator('#close-drawer').waitFor();
      await settleOverlay('#demo-drawer');
      await page.screenshot({path:path.join(directory,'drawer.png')});
      await page.locator('#close-drawer').click();
      await page.locator('#menu-button').click();
      await page.locator('#menu-surface').waitFor();
      await page.screenshot({path:path.join(directory,'menu.png')});
      await page.keyboard.press('Escape');
      for (const width of [180,268,520]) {
        await tree.evaluate((el,width)=>{el.style.width=width+'px';},width);
        assert(await tree.evaluate(el=>el.scrollWidth<=el.clientWidth),'Explorer owns long-name clipping');
        await tree.screenshot({path:path.join(directory,`tree-${width}.png`)});
      }
      await item('tests').locator(':scope > .af-explorer-line').click();
      await page.keyboard.press('ArrowRight');
      assert.equal(await item('tests').getAttribute('aria-expanded'),'true');
      assert.equal(await item('tests').getAttribute('aria-selected'),'true');
      for (const [key,icon] of [['tests','folder-test-open'],['benchmarks','folder-benchmark'],['contracts','folder-contract'],['integration','folder-connection'],['runtime','folder'],['support','folder']]) {
        assert.equal(await item(key).locator(':scope > .af-explorer-line [data-material-icon]').getAttribute('data-material-icon'),icon);
      }
      assert.equal(await item('tests').locator(':scope > [role="group"]').evaluate(el=>getComputedStyle(el,'::before').borderLeftWidth),'1px');
      await tree.evaluate(el=>{el.style.width='300px';});
      await item('tests').screenshot({path:path.join(directory,'tree-reference.png')});
      await tree.evaluate(el=>{el.style.width='';});
      await page.locator('#remote-choice-ts-control').fill('실패');
      await page.waitForFunction(()=>document.querySelector('#remote-status').textContent.includes('검색 실패'));
      assert.equal(await page.locator('#remote-choice').locator('..').locator('.no-results').textContent(),'검색하지 못했습니다.');
      await page.keyboard.press('Escape');
      await page.locator('#remote-status').locator('..').screenshot({path:path.join(directory,'remote-error.png')});
      const settings=page.locator('#settings-example');
      await settings.getByLabel('표시 이름').fill('실패');
      await settings.getByRole('button',{name:'저장',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('#settings-example').textContent.includes('저장하지 못했습니다.'));
      await settings.screenshot({path:path.join(directory,'settings-error.png')});
      await page.locator('#upload-example input').setInputFiles({name:'fail-review.txt',mimeType:'text/plain',buffer:Buffer.from('demo')});
      await page.locator('#upload-example > button').click();
      await page.getByRole('button',{name:'재시도',exact:true}).waitFor();
      await page.locator('#upload-example').screenshot({path:path.join(directory,'upload-error.png')});
      await page.getByRole('button',{name:'재시도',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('.af-upload-list').textContent.includes('완료'));
      await page.locator('#upload-example').screenshot({path:path.join(directory,'upload-complete.png')});
      assert.equal(expectedUploadErrors,1,'The deliberately rejected demo upload logs one expected error');
    }
    // Embed the real protected page under a same-origin document with real CSP headers.
    await page.evaluate(url => {
      window.afCatalog.destroy();
      const frame = document.createElement('iframe');
      frame.title = '공통 에셋'; frame.src = url;
      frame.style.cssText = 'width:100%;height:800px;border:0';
      document.body.replaceChildren(frame);
    }, url);
    const catalog = page.frameLocator('iframe');
    await catalog.locator('#primitive-example .ui-button').first().waitFor();
    assert(await catalog.locator('.catalog-intro').first().isHidden(), 'Embedded catalog hides its duplicate introduction');
    await catalog.locator('#open-confirm').click();
    await catalog.locator('wa-dialog button').filter({ hasText: '취소' }).waitFor();
    await page.keyboard.press('Escape');
    await catalog.locator('[data-demo-toast="success"]').click();
    await catalog.locator('.af-toast').waitFor();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      assert(await catalog.locator('body').evaluate(el => el.scrollWidth <= el.clientWidth));
      assert.equal(await catalog.locator('.catalog-grid').evaluate(el => getComputedStyle(el).display), 'block');
      const columns = await catalog.locator('.catalog-domain__items').first().evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
      assert.equal(columns, width === 390 ? 1 : 2);
    }
    assert.deepEqual(
      await catalog.locator('.catalog-domain__header h2').allTextContents(),
      ['기반 에셋', '입력·작업', '탐색', '피드백·오버레이', '레이아웃', '리소스 조합'],
    );
    assert.equal(await catalog.locator('.catalog-domain__items > article').count(), 14);
    assert.deepEqual(errors, []);
    for (const [headers, expected] of [[{}, 401], [{ 'x-test-role': 'member' }, 403]]) {
      const context = await browser.newContext({ extraHTTPHeaders: headers });
      for (const file of ['', 'catalog/catalog.js', 'src/components/explorer-tree.js', 'styles/theme.css', 'generated/vendors.js']) {
        assert.equal((await context.request.get(url + file)).status(), expected);
      }
      await context.close();
    }
    console.log(`PASS private catalog: actual HTTP authorization, iframe/CSP, controls, 1440/390px; initial load ${navigationMs}ms`);
  } finally {
    await browser?.close();
    server.kill('SIGTERM');
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
