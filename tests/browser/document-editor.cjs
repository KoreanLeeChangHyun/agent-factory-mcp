// NODE_PATH=/tmp/af-pw/node_modules node tests/browser/document-editor.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const pdfFixture = (() => {
  const stream = '0 0 1 rg 20 20 60 60 re f\nBT /F1 16 Tf 20 140 Td (Document preview) Tj ET\n';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>'];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  return pdf + `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
})();
const server = http.createServer(async (req, res) => {
  if (req.url.includes('/documents/pdf/revisions/1/content')) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', Buffer.byteLength(pdfFixture));
    res.setHeader('Content-Disposition', 'attachment; filename="guide.pdf"');
    return res.end(pdfFixture);
  }
  const file = req.url.replace(/^\/factory/, '').replace(/^\/workspace\/$/, '/template/workspace/index.html');
  if (!file.startsWith('/static/') && !file.startsWith('/template/')) return res.writeHead(404).end();
  try {
    const content = await fs.readFile(path.join(root, file));
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; object-src 'none'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    res.end(content);
  } catch { res.writeHead(404).end(); }
});
const docs = [
  ['a', 'processed', 'notes/a.md'], ['b', 'processed', 'notes/b.md'], ['c', 'processed', 'notes/deep/c.json'],
  ['s', 'specification', 'design/spec.md'], ['z', 'specification', 'design/archive.bin'],
  ['img', 'specification', 'design/logo.png'], ['pdf', 'specification', 'design/guide.pdf'], ['bad', 'processed', 'denied.md'],
  ['slow', 'processed', 'slow.md'], ['empty', 'processed', 'empty.md'],
].map(([id, document_type, file]) => ({ id, document_type, title: file.split('/').at(-1), document_metadata: { path: file }, current_revision_number: id === 'empty' ? 0 : 1 }));
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const chooseWorkspace = async id => {
    await page.locator('[data-workspace-picker-toggle]').click();
    await page.locator('[data-workspace-list] [data-workspace-id="' + id + '"]').click();
  };
  page.setDefaultTimeout(6000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const consoleErrors = []; page.on('console', message => { if (message.type() === 'error') consoleErrors.push({ text: message.text(), location: message.location() }); });
  let slowRoute, denied = true;
  await page.route('**/api/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (pathname.endsWith('/auth/me')) return reply({ user: { id: 'user', display_name: '테스터', email: 'test@example.test', is_platform_admin: false } });
    if (pathname.endsWith('/account/organizations')) return reply([{ id: 'org', name: '개인', is_personal: true }]);
    if (pathname.endsWith('/workspaces') || pathname.endsWith('/recent')) return reply(['one', 'two'].map(id => ({ id, organization_id: 'org', name: id, status: 'active' })));
    if (pathname.endsWith('/visits')) return route.fulfill({ status: 204 });
    if (pathname.endsWith('/mcp-connections')) return reply({ state: 'verified', connections: [] });
    if (pathname.endsWith('/documents')) return reply(pathname.includes('/one/') ? docs : []);
    if (pathname.endsWith('/content')) {
      const id = pathname.split('/documents/')[1].split('/')[0];
      if (id === 'bad' && denied) return reply({}, 403);
      if (id === 'slow') { slowRoute = route; return; }
      if (id === 'z') return route.fulfill({ contentType: 'application/octet-stream', body: 'fixture binary' });
      if (id === 'pdf') {
        return route.continue();
      }
      if (id === 'img') return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII=', 'base64') });
      if (id === 'c') return reply({ nested: { value: 1 } });
      return route.fulfill({ contentType: 'text/markdown', body: `# ${id}\nContent ${id}\n<script>window.injected=true</script>\n` + 'Document line\n'.repeat(100) });
    }
    return reply([]);
  });
  const file = id => page.locator(`[data-key="${id}"]`);
  const tab = name => page.getByRole('tab', { name, exact: true });
  const groups = page.locator('.de-group');
  const open = async id => { await file(id).dblclick(); };
  const chooseMenu = async (target, label) => { await target.click({ button: 'right' }); await page.locator('.de-menu').getByRole('menuitem', { name: label, exact: true }).click(); };
  const drag = async (source, target, x = .5, y = .5, copy = false) => {
    const from = await source.boundingBox(), to = await target.boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + 12); await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 10, from.y + 12, { steps: 3 });
    if (copy) await page.keyboard.down('Control');
    await page.mouse.move(to.x + to.width * x, to.y + to.height * y, { steps: 12 });
    await page.mouse.up(); if (copy) await page.keyboard.up('Control');
  };
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/factory/workspace/`);
    await page.locator('[data-workspace-list] .workspace-row').first().click();
    await page.locator('[data-activity="documents"]').click();
    await file('a').waitFor();
    // Each explorer owns its search on the header row, outside the collapsed body.
    for (const kind of ['processed', 'specification']) {
      const toggle = page.locator(`[aria-controls="${kind}-group-content"]`);
      const header = page.locator('.de-document-header').filter({ has: toggle });
      const search = header.getByRole('searchbox');
      const overview = header.locator('[data-document-target]');
      const collapse = header.getByRole('button', { name: /모두 접기/ });
      assert.deepEqual(await header.evaluate(el => [...el.children].map(child => child.tagName)), ['BUTTON', 'INPUT', 'BUTTON', 'A']);
      assert(await overview.locator('svg').count());
      assert.equal(await overview.textContent(), '');
      await toggle.click();
      assert(await search.isVisible());
      await overview.click();
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
      assert(await page.locator(`[data-document-view="${kind}-overview"]`).isVisible());
      await search.fill('no-match');
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
      await search.fill('');
      await search.fill(kind === 'processed' ? 'c.json' : 'spec.md');
      await search.focus(); await page.keyboard.press('Tab'); assert(await collapse.evaluate(el => el === document.activeElement));
      await page.keyboard.press('Tab'); assert(await overview.evaluate(el => el === document.activeElement));
      await collapse.press('Enter');
      assert.equal(await search.inputValue(), '');
      assert.equal(await page.locator(`[data-${kind}-list] [aria-expanded="true"]`).count(), 0);
      await search.fill('no-match'); await search.fill('');
      const folded = page.locator(`[data-${kind}-list] [aria-expanded="false"]`);
      while (await folded.count()) await folded.first().locator(':scope > .de-tree-name').click();
      const toggleRect = await toggle.boundingBox(), searchRect = await search.boundingBox();
      assert(Math.abs(toggleRect.y + toggleRect.height / 2 - searchRect.y - searchRect.height / 2) <= 1);
    }
    if (process.env.DOCUMENT_HEADERS_ONLY === '1') {
      for (const width of [180, 268, 520]) {
        await page.locator('[data-workspace-shell]').evaluate((el, width) => el.style.setProperty('--primary-sidebar-width', `${width}px`), width);
        for (const header of await page.locator('.de-document-header').all()) {
          assert(await header.evaluate(el => el.scrollWidth <= el.clientWidth));
          if (await header.getByRole('searchbox').count()) assert((await header.getByRole('searchbox').boundingBox()).width >= 32);
          const rects = await header.evaluate(el => [...el.children].map(child => { const r = child.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; }));
          assert(rects.every(r => Math.abs(r.y + r.h / 2 - rects[0].y - rects[0].h / 2) <= 1));
          assert(rects.every((r, index) => !index || r.x >= rects[index - 1].x + rects[index - 1].w));
        }
        const columns = await page.locator('.de-document-header').evaluateAll(headers => headers.map(header => [header.children[1], header.querySelector('[data-document-target$="-overview"]')].map(el => {
          const rect = el.getBoundingClientRect(), css = getComputedStyle(el);
          return { x:rect.x, width:rect.width, height:rect.height, border:css.border, background:css.backgroundColor, radius:css.borderRadius, font:css.fontSize };
        })));
        assert.deepEqual(columns[1][0], columns[2][0]);
        assert.equal(columns[0][1].x, columns[1][1].x);
        assert.equal(columns[1][1].x, columns[2][1].x);
      }
      await page.locator('[data-workspace-shell]').evaluate(el => el.style.setProperty('--primary-sidebar-width', '268px'));
      const search = page.getByRole('searchbox', { name: '가공 문서 파일 이름 검색' });
      await search.fill('c.json'); assert.equal(await file('a').count(), 0); await file('c').waitFor();
      await search.press('ArrowDown'); assert.equal(await page.locator(':focus').getAttribute('role'), 'treeitem');
      await search.fill('');
      await search.fill('a.md'); await file('a').press('Enter'); await tab('a.md').waitFor();
      await page.getByRole('searchbox', { name: '명세 문서 파일 이름 검색' }).fill('spec.md');
      await file('s').press('Enter'); await tab('spec.md').waitFor();
      const original = page.locator('.document-group[aria-labelledby="original-group-label"]');
      assert.deepEqual(await original.locator('.de-document-header').evaluate(el => [...el.children].map(child => child.tagName)), ['SPAN', 'A', 'A']);
      assert.equal(await original.getByRole('searchbox').count(), 0);
      const tableLink = original.getByRole('link', {name:'원본 문서 테이블', exact:true});
      assert.equal(await tableLink.locator('svg').count(), 1);
      assert.equal((await tableLink.textContent()).trim(), '');
      await tableLink.focus(); await tableLink.press('Enter');
      assert(await page.locator('[data-document-view="original-search"]').isVisible());
      await page.evaluate(() => window.agentFactoryWorkspace.originalSearch.replaceRows([
        {sourceIdentity:'one', name:'Alpha source', classification:'문서', provider:'Drive', tags:['alpha'], extension:'md', modifiedAt:'2026-09-06', sourceUrl:'https://example.com/alpha'},
        {sourceIdentity:'two', name:'Beta source', classification:'문서', provider:'Drive', tags:['beta'], extension:'md', modifiedAt:'2026-09-06', sourceUrl:'https://example.com/beta'},
      ]));
      await page.locator('[data-original-global-search]').fill('Alpha');
      await page.getByRole('link', {name:'Alpha source',exact:true}).waitFor();
      assert.equal(await page.getByRole('link', {name:'Beta source',exact:true}).count(), 0);
      await original.getByRole('link', {name:'원본 문서 개요',exact:true}).click();
      assert(await page.locator('[data-document-view="original-overview"]').isVisible());
      assert.equal(await page.locator('.document-sidebar .document-navigation__item').count(), 0);
      assert.equal(await page.locator('[data-document-explorer-toggle]').count(), 0);
      await page.getByRole('link', {name:'가공 문서 개요',exact:true}).click();
      await open('a'); assert.equal(await tab('spec.md').count(),1);
      await page.screenshot({ path: '/tmp/document-headers.png' });
      await page.setViewportSize({width:600,height:800});
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({path:'/tmp/document-headers-mobile.png'});
      assert.deepEqual(errors, []);
      console.log('PASS: explorer header placement, collapse/search, keyboard, and 180–520px widths');
      return;
    }
    assert.equal(await file('c').getAttribute('aria-level'), '3');
    // Folder navigation and search.
    await page.locator('[data-key="notes"] > .de-tree-name').click(); assert.equal(await file('a').count(), 0);
    await page.locator('[data-key="notes"]').press('ArrowRight'); await file('a').waitFor();
    await file('a').focus(); await page.keyboard.press('ArrowDown'); assert.equal(await page.locator(':focus').getAttribute('data-key'), 'b');
    await page.getByRole('searchbox', { name: '가공 문서 파일 이름 검색' }).fill('c.json'); assert.equal(await file('a').count(), 0); await file('c').waitFor();
    await page.getByRole('searchbox', { name: '가공 문서 파일 이름 검색' }).fill('');
    await file('a').click({ modifiers: ['Control'] }); await file('b').click({ modifiers: ['Shift'] });
    assert.equal(await page.locator('[data-processed-list] [aria-selected="true"]').count(), 2);
    await file('b').press('Shift+F10'); await page.getByRole('menuitem', { name: '열기', exact: true }).waitFor();
    await page.keyboard.press('End');
    assert.ok(await page.getByRole('menuitem').last().evaluate(el=>el===document.activeElement));
    await page.keyboard.press('Home');
    assert.ok(await page.getByRole('menuitem').first().evaluate(el=>el===document.activeElement));
    await page.keyboard.press('Escape'); assert.equal(await page.locator(':focus').getAttribute('data-key'), 'b');
    // Preview reuse, promotion, duplicate activation, independent tab closing.
    await file('a').click(); await tab('a.md').waitFor();
    const closeIcon=page.getByRole('button',{name:'a.md 닫기',exact:true}).locator('svg.af-icon');
    assert.equal(await closeIcon.count(),1);
    assert.equal(await closeIcon.getAttribute('aria-hidden'),'true');
    await file('b').click(); assert.equal(await tab('a.md').count(), 0);
    await open('b'); await open('a'); assert.equal(await page.getByRole('tab').count(), 2);
    await open('a'); assert.equal(await tab('a.md').count(), 1);
    await tab('b.md').click(); await tab('b.md').press('ArrowRight'); assert.equal(await tab('a.md').getAttribute('aria-selected'), 'true');
    await page.waitForFunction(() => document.querySelector('.de-panel:not([hidden]) pre')?.textContent.includes('Content a'));
    assert.equal(await page.evaluate(() => window.injected), undefined);
    // Pinned tab survives close others.
    await chooseMenu(tab('a.md'), '탭 고정'); await chooseMenu(tab('b.md'), '다른 탭 닫기'); assert.equal(await page.getByRole('tab').count(), 2);
    await page.getByRole('button', { name: 'a.md 고정 해제', exact: true }).click();
    // Horizontal then nested vertical split, same file in multiple groups.
    await chooseMenu(tab('a.md'), '오른쪽으로 분할'); assert.equal(await groups.count(), 2); assert.equal(await tab('a.md').count(), 2);
    await chooseMenu(tab('a.md').last(), '아래로 분할'); assert.equal(await groups.count(), 3);
    assert.equal(await page.locator('.de-split--horizontal').count(), 1); assert.equal(await page.locator('.de-split--vertical').count(), 1);
    // Keyboard and pointer sash resize, maximize/restore.
    const sash = page.getByRole('separator', { name: '문서 분할 크기 조절', exact: true }).first();
    await sash.focus(); await page.keyboard.press('ArrowRight'); assert.equal(await sash.getAttribute('aria-valuenow'), '55');
    const sashRect = await sash.boundingBox();
    assert.equal(sashRect.width, 5, 'Horizontal split handle retains its pointer target');
    const verticalSashRect = await page.locator('.de-split--vertical > .de-sash').boundingBox();
    assert.equal(verticalSashRect.height, 5, 'Vertical split handle retains its pointer target');
    await page.mouse.move(sashRect.x + 2, sashRect.y + 30); await page.mouse.down(); await page.mouse.move(sashRect.x + 50, sashRect.y + 30); await page.mouse.up();
    assert(Number(await sash.getAttribute('aria-valuenow')) > 55);
    assert.equal(await page.locator('html[data-af-split-cursor]').count(), 0, 'Pointer release clears the global resize cursor');
    await groups.last().getByRole('button', { name: '그룹 확대·복원', exact: true }).click(); assert.equal(await page.locator('.de-group:visible').count(), 1);
    await page.locator('.de-group:visible').getByRole('button', { name: '그룹 확대·복원', exact: true }).click(); assert.equal(await page.locator('.de-group:visible').count(), 3);
    // Close last tab in nested group; preserve active group when closing elsewhere.
    await groups.first().getByRole('tab', { name: 'b.md', exact: true }).click();
    const activeId = await page.locator('.de-group.is-active').getAttribute('data-group-id');
    await groups.last().getByRole('button', { name: 'a.md 닫기', exact: true }).click();
    assert.equal(await groups.count(), 2); assert.equal(await page.locator('.de-split--vertical').count(), 0);
    assert.equal(await page.locator('.de-group.is-active').getAttribute('data-group-id'), activeId);
    // Cross-kind files open in the same group system; views keep tabs and scroll.
    await open('s'); assert.equal(await groups.count(), 2);
    await page.locator('[data-document-target="processed-overview"]').click();
    await open('b'); assert.equal(await tab('spec.md').count(), 1);
    await page.locator('[data-activity="schedule"]').click(); await page.locator('[data-activity="documents"]').click(); assert.equal(await tab('spec.md').count(), 1);
    // Actual pointer-driven DND from explorer to an edge creates a group.
    await drag(file('c'), groups.first().locator('.de-body'), .5, .9); assert.equal(await groups.count(), 3);
    await page.waitForFunction(() => [...document.querySelectorAll('.de-text')].some(el => el.textContent.includes('"nested"')));
    // Tab movement into an existing duplicate merges and removes empty source.
    const aGroups = groups.filter({ has: page.getByRole('tab', { name: 'a.md', exact: true }) });
    await drag(aGroups.last().getByRole('tab', { name: 'a.md', exact: true }), aGroups.first().locator('.de-body'));
    assert.equal(await tab('a.md').count(), 1); assert.equal(await groups.count(), 2);
    // Copy tab with modifier; center drop keeps original.
    await drag(tab('c.json'), groups.first().locator('.de-body'), .5, .5, true); assert.equal(await tab('c.json').count(), 2);
    // Multi-select explorer and open selected to the side.
    await file('a').click({ modifiers: ['Control'] }); await file('b').click({ modifiers: ['Control'] });
    await chooseMenu(file('b'), '오른쪽에 열기');
    assert(await page.locator('.de-group.is-active').getByRole('tab', { name: 'a.md', exact: true }).count());
    // Filtering away the range anchor must not select unrelated leading files.
    await file('c').click({modifiers:['Control']});
    const processedSearch=page.locator('[aria-labelledby="processed-group-label"] .de-document-search');
    await processedSearch.fill('.md');
    await file('b').click({modifiers:['Shift']});
    assert.deepEqual(await page.locator('[data-processed-list] [aria-selected="true"]').evaluateAll(rows=>rows.map(row=>row.dataset.key)),['b']);
    await processedSearch.fill('');
    // Error/retry, binary fallback, and image rendering.
    await open('bad'); await page.getByRole('alert').filter({ hasText: '권한' }).waitFor(); denied = false;
    await page.getByRole('button', { name: '다시 시도', exact: true }).click(); await page.waitForFunction(() => document.querySelector('.de-group.is-active .de-panel:not([hidden]) pre')?.textContent.includes('Content bad'));
    await open('z'); await page.getByRole('link', { name: '파일 다운로드' }).waitFor({ state: 'visible' });
    await open('img'); await page.waitForFunction(() => document.querySelector('.de-image')?.naturalWidth === 1);
    assert.equal(await file('empty').getAttribute('aria-disabled'), 'true');
    await file('empty').click({ force: true }); assert.equal(await tab('empty.md').count(), 0);
    // Escape cancels drag markers without moving tabs.
    const total = await page.getByRole('tab').count();
    const sourceRect = await tab('logo.png').boundingBox(); await page.mouse.move(sourceRect.x + 10, sourceRect.y + 10); await page.mouse.down(); await page.mouse.move(sourceRect.x + 50, sourceRect.y + 60, { steps: 6 }); await page.keyboard.press('Escape'); await page.mouse.up();
    assert.equal(await page.locator('[data-drop], [data-insert]').count(), 0); assert.equal(await page.getByRole('tab').count(), total);
    await page.screenshot({ path: '/tmp/document-editor-desktop.png' });
    // Workspace switch clears all tabs and cancels in-flight bodies.
    await open('slow'); await page.waitForFunction(() => document.querySelector('.de-panel[aria-busy="true"]'));
    await chooseWorkspace('two');
    if (slowRoute) await slowRoute.fulfill({ contentType: 'text/plain', body: 'stale private body' }).catch(() => {});
    assert.equal(await page.getByRole('tab').count(), 0);
    assert(!(await page.locator('body').textContent()).includes('stale private body'));
    await chooseWorkspace('one'); await page.locator('[data-activity="documents"]').click(); await file('a').waitFor(); await open('a');
    // Pane scroll survives tab switching and overview navigation.
    const aPanelId = await tab('a.md').getAttribute('aria-controls');
    await page.waitForFunction(id => !!document.getElementById(id)?.querySelector('pre'), aPanelId);
    await page.locator(`#${aPanelId}`).evaluate(el => { el.scrollTop = 180; });
    await open('b'); await tab('a.md').click();
    await page.locator('[data-document-target="specification-overview"]').click(); await open('a');
    assert.equal(await page.locator(`#${aPanelId}`).evaluate(el => el.scrollTop), 180);
    // Tab reordering preserves panel identity and scroll position.
    await open('s');
    await drag(tab('spec.md'), tab('a.md'), .1, .5);
    assert.deepEqual(await page.getByRole('tab').allTextContents(), ['spec.md', 'a.md', 'b.md']);
    await tab('a.md').click();
    assert.equal(await page.locator(`#${aPanelId}`).evaluate(el => el.scrollTop), 180);
    await chooseMenu(tab('a.md'), '오른쪽 탭 닫기'); assert.equal(await tab('b.md').count(), 0);
    await chooseMenu(tab('spec.md'), '다른 탭 닫기'); assert.equal(await tab('a.md').count(), 0);
    await chooseMenu(tab('spec.md'), '모든 탭 닫기'); assert.equal(await page.getByRole('tab').count(), 0);
    await open('a');
    // Top/left edge drops and group-wide closing clean nested layouts.
    await drag(file('b'), groups.first().locator('.de-body'), .5, .1); assert.equal(await groups.count(), 2);
    await drag(file('s'), groups.first().locator('.de-body'), .1, .5); assert.equal(await groups.count(), 3);
    await groups.first().getByRole('button', { name: '그룹 메뉴', exact: true }).click();
    await page.getByRole('menuitem', { name: '그룹 닫기', exact: true }).click(); assert.equal(await groups.count(), 2);
    await groups.first().getByRole('button', { name: '그룹 메뉴', exact: true }).click();
    await page.getByRole('menuitem', { name: '전체 에디터 닫기', exact: true }).click(); assert.equal(await groups.count(), 1);
    assert.equal(await page.locator('.de-split').count(), 0);
    await open('a');
    // Close final tab retains a full-size empty group, then reopen.
    await page.getByRole('button', { name: 'a.md 닫기', exact: true }).click(); assert.equal(await groups.count(), 1); assert(await page.locator('.de-empty').isVisible());
    await open('a');
    // Actual PDF page rendering, zoom and retained canvas across tab reordering.
    await open('pdf'); await page.locator('.de-pdf-page[data-rendered="1"]').waitFor();
    assert.deepEqual(await page.locator('.de-pdf-page').evaluate(canvas => [...canvas.getContext('2d').getImageData(40, 140, 1, 1).data]), [0, 0, 255, 255]);
    assert.match(await page.locator('.de-panel:not([hidden]) .sr-only').textContent(), /Document preview/);
    await page.getByRole('button', { name: '다음 페이지', exact: true }).click();
    await page.locator('.de-pdf-page[data-rendered="2"]').waitFor();
    assert(await page.getByRole('button', { name: '다음 페이지', exact: true }).isDisabled());
    await page.getByRole('button', { name: '이전 페이지', exact: true }).click();
    await page.locator('.de-pdf-page[data-rendered="1"]').waitFor();
    const initialWidth = await page.locator('.de-pdf-page').evaluate(canvas => canvas.width);
    await page.getByRole('button', { name: 'PDF 확대', exact: true }).click();
    await page.waitForFunction(width => document.querySelector('.de-pdf-page')?.width > width, initialWidth);
    await page.getByRole('status').filter({ hasText: '125%' }).waitFor();
    await page.screenshot({ path: '/tmp/document-editor-pdf.png' });
    await page.locator('.de-pdf-page').evaluate(canvas => { canvas.dataset.retained = 'yes'; });
    await tab('a.md').click(); await tab('guide.pdf').click();
    await drag(tab('guide.pdf'), tab('a.md'), .1, .5);
    assert.equal(await page.locator('.de-pdf-page').getAttribute('data-retained'), 'yes');
    await page.getByRole('button', { name: 'guide.pdf 닫기', exact: true }).click();
    await page.setViewportSize({ width: 600, height: 800 });
    await page.screenshot({ path: '/tmp/document-editor-mobile.png' });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    assert.deepEqual(consoleErrors.filter(message => /Content Security Policy|Refused to|violates/.test(message.text)), []);
    console.log('Document workbench browser scenarios passed.');
  } catch (error) { console.error('Browser errors:', errors, consoleErrors); for (const frame of page.frames()) console.error('Frame', frame.url(), await frame.locator('body').innerHTML().then(text => text.slice(0, 1600)).catch(() => 'unavailable')); await page.screenshot({ path: '/tmp/document-editor-failure.png' }); throw error; }
  finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
