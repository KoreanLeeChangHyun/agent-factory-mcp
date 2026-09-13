// Run: NODE_PATH=<directory containing playwright> node tests/workspaces/browser/workspace-start.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const server = http.createServer(async (req, res) => {
  let file = req.url.replace(/^\/factory/, '');
  if (file === '/workspace/') file = '/template/workspace/index.html';
  if (!file.startsWith('/static/') && !file.startsWith('/template/')) { res.writeHead(404).end(); return; }
  try {
    const data = await fs.readFile(path.join(root, file));
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Content-Security-Policy', "style-src 'self'");
    res.end(data);
  } catch { res.writeHead(404).end(); }
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const cspViolations=[];
  await page.exposeFunction('captureCspViolation',directive=>cspViolations.push(directive));
  await page.addInitScript(()=>document.addEventListener('securitypolicyviolation',e=>window.captureCspViolation(e.violatedDirective)));
  const records = { one: [], two: [] };
  let serial = 0, issued = 0, revealFailure = false, createFailure = false, statusFailure = false;
  let holdSecret = false, releaseSecret;
  let holdWorkspaceSelection = false, releaseWorkspaceSelection, markWorkspaceSelectionStarted;
  const workspaceSelectionStarted = new Promise(resolve => { markWorkspaceSelectionStarted = resolve; });
  const choose = async (id, waitForCompletion = true) => {
    await page.locator('[data-workspace-picker-toggle]').click();
    await page.locator('[data-workspace-list] [data-workspace-id="' + id + '"]').click();
    if (waitForCompletion)
      await page.waitForFunction(workspaceId =>
        document.querySelector(`[data-workspace-list] [data-workspace-id="${workspaceId}"][aria-current="true"]`) &&
        document.querySelector('[data-mcp-tab="connection"][aria-selected="true"]'), id);
  };
  await page.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url()).pathname;
    const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (url.endsWith('/auth/me')) return reply({ user: { id: 'u', display_name: '테스트', email: 'test@example.test', is_platform_admin: false } });
    if (url.endsWith('/account/organizations')) return reply([{ id: 'org', name: '개인', is_personal: true }]);
    if (url.endsWith('/workspaces') || url.endsWith('/recent')) return reply(['one', 'two'].map(id => ({ id, name: '작업공간 ' + id, organization_id: 'org', status: 'active' })));
    if (url.endsWith('/visits')) return route.fulfill({ status: 204 });
    if (url.endsWith('/workbench/selection')) {
      if (holdWorkspaceSelection && url.includes('/workspaces/two/')) {
        markWorkspaceSelectionStarted();
        await new Promise(resolve => { releaseWorkspaceSelection = resolve; });
      }
      return reply({ mode: 'legacy' });
    }
    if (url.includes('/mcp-connections')) {
      const owner = url.split('/workspaces/')[1].split('/')[0];
      const rows = records[owner], id = url.split('/mcp-connections/')[1]?.split('/')[0];
      const row = rows.find(row => row.id === id);
      if (url.endsWith('/secret')) {
        if (holdSecret) { holdSecret = false; await new Promise(resolve => { releaseSecret = resolve; }); }
        if (revealFailure || !row || !row.retrievable || row.state === 'reauth_required') return reply({}, 409);
        return reply({ id, token: 'fixture-secret-' + id });
      }
      if (req.method() === 'POST') {
        if (createFailure) return reply({}, 403);
        issued++;
        const row = { id: 'token-' + (++serial), name: req.postDataJSON().name, state: 'pending', retrievable: true };
        rows.unshift(row); return reply({ ...row, token: 'fixture-secret-' + row.id }, 201);
      }
      if (url.endsWith('/purge')) {
        if (!row) return reply({}, 404);
        if (row.reason !== 'revoked') return reply({}, 409);
        rows.splice(rows.indexOf(row), 1); return route.fulfill({ status: 204 });
      }
      if (req.method() === 'DELETE') { row.state = 'reauth_required'; row.retrievable = false; row.reason = 'revoked'; return route.fulfill({ status: 204 }); }
      if (statusFailure) return reply({}, 503);
      return reply({ state: rows.some(row => row.state === 'verified') ? 'verified' : rows.length && rows.every(row => row.state === 'reauth_required') ? 'reauth_required' : 'pending', connections: rows });
    }
    return reply([]);
  });
  const token = page.locator('[data-mcp-token]');
  const downloadButton = page.locator('[data-mcp-download]');
  const copyAI = page.locator('[data-mcp-copy-ai]');
  const refresh = async () => {
    assert.equal(await page.locator('[data-mcp-token-refresh] svg.af-icon').count(),1);
    assert.equal(await page.locator('[data-mcp-token-refresh] svg').getAttribute('aria-hidden'),'true');
    assert.equal(await page.locator('[data-mcp-token-refresh]').getAttribute('aria-label'),'토큰 목록 새로고침');
    await page.locator('[data-mcp-token-refresh]').click();
    await page.waitForTimeout(80);
  };
  const mockClipboard = async fail => page.evaluate(fail => {
    window.copied = '';
    window.nativeExecCommand ||= document.execCommand.bind(document);
    document.execCommand = () => false;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => {
      if (fail) throw new Error('denied'); window.copied = text;
    } } });
  }, fail);
  const download = async () => {
    const pending = page.waitForEvent('download');
    await downloadButton.click();
    const file = await pending;
    assert.equal(await file.failure(), null);
    const destination = '/tmp/' + file.suggestedFilename();
    await file.saveAs(destination);
    const data = JSON.parse(require('node:child_process').execFileSync('python3', ['-c',
      'import zipfile,json,sys; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print(json.dumps({n:z.read(n).decode() for n in z.namelist()}))', destination], { encoding: 'utf8' }));
    return { data, filename: file.suggestedFilename() };
  };
  try {
    await page.goto('http://127.0.0.1:' + server.address().port + '/factory/workspace/');
    await choose('one');
    const sharedControls = await page.evaluate(() => {
      const selects = [...document.querySelectorAll('.mcp-ai-connect select')];
      return {
        fields: selects.every(control => control.classList.contains('af-input') && control.closest('.af-field') && control.labels.length === 1),
        tokenLabelField: Boolean(document.querySelector('[data-mcp-token-label].af-input')?.closest('.af-field')),
        secretType: document.querySelector('[data-mcp-token]').type,
        tokenCopy: Boolean(document.querySelector('[data-mcp-copy-token]')),
      };
    });
    assert.deepEqual(sharedControls,{fields:true,tokenLabelField:true,secretType:'hidden',tokenCopy:false});
    assert.equal(await page.getByRole('tab', { name: 'MCP 연결', exact: true }).getAttribute('aria-selected'),'true');
    assert(await page.locator('[data-mcp-tab-panel="connection"]').isVisible());
    assert(await page.locator('[data-mcp-tab-panel="overview"]').isHidden());
    const headerBoxes = await Promise.all([
      page.locator('.primary-sidebar__header').boundingBox(),
      page.locator('.workspace-panel-header').boundingBox(),
      page.locator('.mcp-setup > .mcp-panel-header').boundingBox(),
      page.locator('.mcp-token-panel > .mcp-panel-header').boundingBox(),
    ]);
    assert.deepEqual(headerBoxes.map(box => box.height), [35, 35, 35, 35]);
    assert.equal(headerBoxes[0].y + headerBoxes[0].height, headerBoxes[1].y + headerBoxes[1].height);
    assert.equal(headerBoxes[2].y + headerBoxes[2].height, headerBoxes[3].y + headerBoxes[3].height);
    const headerBorders = await Promise.all([
      page.locator('.primary-sidebar__header').evaluate(el=>getComputedStyle(el).borderBottomWidth),
      page.locator('.workspace-panel-header').evaluate(el=>getComputedStyle(el).borderBottomWidth),
      page.locator('.mcp-setup > .mcp-panel-header').evaluate(el=>getComputedStyle(el).borderBottomWidth),
      page.locator('.mcp-token-panel > .mcp-panel-header').evaluate(el=>getComputedStyle(el).borderBottomWidth),
    ]);
    assert.deepEqual(headerBorders,['1px','1px','1px','1px']);
    await page.locator('[data-mcp-token-list-state]').filter({ hasText: '없습니다' }).waitFor();
    assert(await downloadButton.isDisabled());
    await page.locator('[data-mcp-enroll]').click();
    assert(await page.locator('[data-mcp-token-dialog]').isVisible());
    assert(await page.locator('[data-mcp-token-label]').evaluate(node => node === document.activeElement));
    assert(await page.locator('[data-mcp-token-submit]').isDisabled());
    await page.locator('[data-mcp-token-label]').fill('  개인 노트북  ');
    assert(!(await page.locator('[data-mcp-token-submit]').isDisabled()));
    createFailure = true; await page.locator('[data-mcp-token-submit]').click();
    await page.locator('[data-mcp-token-dialog-message]').filter({ hasText: '발급하지 못' }).waitFor();
    createFailure = false; await page.locator('[data-mcp-token-submit]').click();
    await page.locator('[data-mcp-token-dialog]').waitFor({state:'hidden'});
    await page.waitForFunction(() => document.querySelector('[data-mcp-token]').value === 'fixture-secret-token-1');
    assert.equal(issued, 1);
    assert.equal(records.one[0].name, '개인 노트북');
    assert((await page.locator('[data-mcp-token-select] option[value="token-1"]').textContent()).includes('개인 노트북'));
    assert((await page.locator('[data-mcp-connections] li').first().textContent()).includes('개인 노트북'));
    await page.reload();
    await page.waitForFunction(() => document.querySelector('[data-mcp-token]').value === 'fixture-secret-token-1');
    await mockClipboard(false);
    assert(!(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).includes('fixture-secret'));
    assert(!(await copyAI.isDisabled()));
    await copyAI.click();
    await page.waitForFunction(() => window.copied.includes('agent-factory-one-all-clients-token-1.zip'));
    assert.equal(issued, 1);
    assert.equal(await page.locator('[data-mcp-client], [data-mcp-variant]').count(), 0);
    const selectedId = await page.locator('[data-mcp-token-select]').inputValue();
    const issuedBeforeDownload = issued;
    const allClientsFile = await download();
    assert.equal(issued, issuedBeforeDownload);
    const metadata = JSON.parse(allClientsFile.data['connection.json']);
    const expectedMcpURL = new URL('/factory/mcp/workspaces/one/', page.url()).href;
    assert.equal(metadata.workspaceId, 'one'); assert.equal(metadata.tokenId, selectedId);
    assert.equal(metadata.url, expectedMcpURL);
    assert.equal(metadata.clients.length, 18);
    assert.equal(new Set(metadata.clients.map(client => client.id)).size, 13);
    assert.equal(JSON.parse(allClientsFile.data['credentials.json']).token, 'fixture-secret-' + selectedId);
    for (const client of metadata.clients) {
      assert(client.configFile.startsWith(`clients/${client.id}/${client.environment}/`));
      assert(allClientsFile.data[client.configFile].includes(metadata.url));
      if (client.configFile.endsWith('.json')) JSON.parse(allClientsFile.data[client.configFile]);
      if (client.configFile.endsWith('.toml')) {
        require('node:child_process').execFileSync('python3', ['-c', 'import tomllib,sys; tomllib.loads(sys.stdin.read())'], { input: allClientsFile.data[client.configFile] });
      }
      if (client.commandFile) assert(allClientsFile.data[client.commandFile]);
    }
    await copyAI.click();
    await page.waitForFunction(expected => window.copied === expected, allClientsFile.data['README.txt']);
    assert(allClientsFile.data['README.txt'].includes(allClientsFile.filename));
    assert(allClientsFile.data['README.txt'].includes(metadata.url));
    assert(!allClientsFile.data['README.txt'].includes('fixture-secret'));
    await page.waitForFunction(() => document.querySelector('[data-mcp-token]').value === 'fixture-secret-token-1');
    await page.evaluate(() => { window.originalCreateURL = URL.createObjectURL; URL.createObjectURL = () => { throw new Error('download unavailable'); }; });
    await downloadButton.click();
    await page.locator('[data-mcp-ai-message]').filter({ hasText: '파일을 만들지 못' }).waitFor();
    assert(!(await copyAI.isDisabled()));
    await page.evaluate(() => { URL.createObjectURL = window.originalCreateURL; });
    await download();
    await page.reload();
    await page.waitForFunction(() => document.querySelector('[data-mcp-token]').value === 'fixture-secret-token-1' && !document.querySelector('[data-mcp-copy-ai]').disabled);
    await mockClipboard(false);
    await page.evaluate(() => { window.secretRequests = 0; const originalFetch = window.fetch; window.fetch = (...args) => { if (String(args[0]).endsWith('/secret')) window.secretRequests++; return originalFetch(...args); }; });
    await copyAI.click();
    await page.waitForFunction(() => window.copied.includes('.zip'));
    assert.equal(await page.evaluate(() => window.secretRequests), 0);
    await mockClipboard(true); await copyAI.click();
    await page.locator('[data-mcp-ai-fallback]').waitFor();
    holdWorkspaceSelection = true;
    await choose('two', false);
    await workspaceSelectionStarted;
    assert.equal(await token.inputValue(), '');
    assert.equal(await page.locator('[data-mcp-ai-text]').inputValue(), '');
    releaseWorkspaceSelection();
    await page.locator('[data-workspace-list] [data-workspace-id="two"][aria-current="true"]').waitFor();
    assert.equal(await token.inputValue(), '');
    holdWorkspaceSelection = false;
    await choose('one');
    await page.waitForFunction(() => document.querySelector('[data-mcp-token]').value === 'fixture-secret-token-1');
    const secondId = 'token-' + (serial + 1);
    await page.locator('[data-mcp-enroll]').click();
    await page.locator('[data-mcp-token-label]').fill('CI 테스트');
    await page.locator('[data-mcp-token-submit]').click();
    await page.waitForFunction(id => document.querySelector('[data-mcp-token]').value === 'fixture-secret-' + id, secondId);
    const issuedTotal = issued;
    await page.locator('[data-mcp-token-select]').selectOption('token-1');
    await page.waitForFunction(() => document.querySelector('[data-mcp-token]').value === 'fixture-secret-token-1');
    assert.equal(await page.locator('[data-mcp-connections] li[aria-current="true"]').count(), 1);
    assert((await page.locator('[data-mcp-connections] li[aria-current="true"]').textContent()).includes('선택됨'));
    records.one.find(row => row.id === 'token-1').state = 'verified';
    await page.locator('[data-mcp-refresh]').click();
    await page.waitForFunction(() => document.querySelector('[data-mcp-status]').textContent === 'MCP 연결됨');
    await page.locator('[data-mcp-check-message]').filter({ hasText: 'MCP 연결됨' }).waitFor();
    assert((await page.locator('[data-mcp-check-message]').textContent()).includes('확인'));
    assert.equal(await page.locator('[data-mcp-refresh]').textContent(), '상태 확인');
    assert.equal(await page.locator('[data-workspace-shell]').getAttribute('data-mcp-locked'), 'false');
    assert(await page.locator('[data-mcp-dismiss]').isHidden());
    assert(await page.locator('[data-mcp-onboarding]').isVisible());
    assert(await page.locator('[data-no-activities]').isHidden());
    assert(!(await page.locator('[data-mcp-refresh]').isDisabled()));
    const confirmationToast = page.locator('.af-toast').filter({hasText:'MCP 연결을 확인했습니다.'});
    await confirmationToast.waitFor();
    await confirmationToast.getByRole('button',{name:'알림 닫기'}).click({timeout:1000}).catch(() => {});
    await page.waitForFunction(() => document.querySelectorAll('.af-toast').length === 0, undefined, {timeout:10000});
    await refresh();
    await refresh();assert.equal(await page.locator('.af-toast').count(),0,'Dismissed confirmation does not repeat');
    records.one.find(row => row.id === 'token-1').client_name = 'agent-factory-connection-check';
    await refresh();
    assert((await page.locator('[data-mcp-status]').textContent()).includes('클라이언트 연결 확인 필요'));
    records.one.find(row => row.id === 'token-1').client_name = 'codex';
    await page.reload();
    await page.waitForFunction(() => document.querySelector('[data-mcp-token]').value === 'fixture-secret-token-1');
    assert(await page.locator('[data-mcp-onboarding]').isVisible());
    revealFailure = true; await downloadButton.click();
    await page.locator('[data-mcp-token-message]').filter({ hasText: '조회하지 못' }).waitFor();
    assert(await copyAI.isDisabled()); assert.equal(issued, issuedTotal);
    revealFailure = false; await refresh();
    await page.waitForFunction(() => document.querySelector('[data-mcp-token]').value === 'fixture-secret-token-1');
    holdSecret = true;
    const inFlight = downloadButton.click(); await inFlight;
    while (!releaseSecret) await page.waitForTimeout(10);
    await choose('two'); releaseSecret(); await page.waitForTimeout(100);
    assert.equal(await token.inputValue(), ''); assert(await copyAI.isDisabled());
    await choose('one');
    await page.waitForFunction(() => document.querySelector('[data-mcp-token]').value === 'fixture-secret-token-1');
    records.one.find(row => row.id === 'token-1').retrievable = false;
    await refresh();
    await page.waitForFunction(id => document.querySelector('[data-mcp-token]').value === 'fixture-secret-' + id, secondId);
    assert.equal(await page.locator('[data-mcp-token-select] option[value="token-1"]').count(), 0);
    records.one.push({id: 'expired-token', name: 'VS Code · Copilot', state: 'reauth_required', reason: 'expired', retrievable: false});
    await refresh();
    assert.equal(await page.locator('[data-mcp-token-select] option[value="expired-token"]').count(), 0);
    assert.equal(await page.locator('[data-mcp-connections] li').count(), 3);
    const secondRow = page.locator('[data-mcp-connections] li').filter({ hasText: secondId });
    await secondRow.getByRole('button', { name: '토큰 폐기' }).click();
    await page.waitForFunction(() => document.querySelector('[data-mcp-token]').value === '');
    assert(await downloadButton.isDisabled()); assert(await copyAI.isDisabled());
    await secondRow.getByRole('button', { name: '영구 삭제' }).click();
    await secondRow.waitFor({state: 'detached'});
    assert(!records.one.some(row => row.id === secondId));
    await page.reload();
    await page.locator('[data-mcp-onboarding]').waitFor();
    await refresh();
    assert.equal(await secondRow.count(), 0);
    assert.equal(await page.locator('.mcp-ai-step').count(), 4);
    const desktopStepTops = await page.locator('.mcp-ai-steps > li').evaluateAll(rows => rows.map(row => row.getBoundingClientRect().top));
    assert(desktopStepTops.slice(1).every((top, index) => top > desktopStepTops[index]));
    statusFailure = true; await refresh();
    await page.locator('[data-mcp-token-list-state]').filter({ hasText: '불러오지 못' }).waitFor();
    statusFailure = false; await refresh();
    await page.locator('[data-mcp-enroll]').click();
    await page.locator('[data-mcp-token-label]').fill('재연결');
    await page.locator('[data-mcp-token-submit]').click();
    await page.waitForFunction(() => document.querySelector('[data-mcp-token]').value !== '');
    await page.reload();
    await page.waitForFunction(() => document.querySelector('[data-mcp-token]').value !== '');
    assert.equal(await page.locator('[data-mcp-status]').textContent(), 'MCP 연결 대기');
    assert.equal(await page.locator('.af-toast').count(), 0);
    assert(!(await page.evaluate(() => JSON.stringify(localStorage))).includes('fixture-secret'));
    assert.equal(await page.locator('[data-mcp-client], [data-mcp-variant], [data-mcp-config], [data-mcp-command]').count(), 0);
    const panelLayout = await page.evaluate(() => {
      const setup = document.querySelector('.mcp-setup').getBoundingClientRect();
      const tokens = document.querySelector('.mcp-token-panel').getBoundingClientRect();
      return setup.right <= tokens.left && setup.top === tokens.top;
    });
    assert(panelLayout);
    await refresh();
    const clipboardFile = await download();
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.evaluate(() => { delete navigator.clipboard; document.execCommand = window.nativeExecCommand; });
    await copyAI.click();
    const actualClipboard = await page.evaluate(() => navigator.clipboard.readText());
    assert(actualClipboard.includes(clipboardFile.filename));
    assert(actualClipboard.includes(expectedMcpURL));
    assert(actualClipboard.includes('credentials.json'));
    assert(await page.locator('[data-mcp-ai-fallback]').isHidden());
    assert.equal(await page.locator('[data-mcp-ai-message]').textContent(), '');
    await page.locator('.af-toast').filter({hasText:'AI 지침을 복사했습니다.'}).waitFor();
    assert(!actualClipboard.includes('fixture-secret'));
    await page.screenshot({ path: '/tmp/mcp-file-handoff-desktop.png' });
    await page.locator('[data-mcp-connections]').evaluate(list => {
      for (let i = 0; i < 40; i++) { const row = document.createElement('li'); row.textContent = 'Token ' + i; list.append(row); }
    });
    assert(await page.locator('.mcp-token-panel .mcp-panel-body').evaluate(node => { node.scrollTop = 100; return node.scrollTop > 0; }));
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const mobileSteps = await page.locator('.mcp-ai-steps > li').evaluateAll(rows => rows.map(row => { const box = row.getBoundingClientRect(); return { top: box.top, bottom: box.bottom }; }));
    assert(mobileSteps.slice(1).every((step, index) => step.top >= mobileSteps[index].bottom));
    await page.screenshot({ path: '/tmp/mcp-file-handoff-mobile.png' });
    assert.deepEqual(errors, []);
    assert.deepEqual(cspViolations,[]);
    console.log('PASS file handoff: one ZIP with 13 clients/all variants, persistent token selection, no auto issue, clipboard fallback, legacy/revoked/error handling, stale responses, mobile');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
