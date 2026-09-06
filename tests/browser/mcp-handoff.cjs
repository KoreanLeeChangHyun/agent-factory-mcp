// Run: NODE_PATH=<directory containing playwright> node tests/browser/workspace-start.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const server = http.createServer(async (req, res) => {
  let file = req.url.replace(/^\/factory/, '');
  if (file === '/workspace/') file = '/template/workspace/index.html';
  if (!file.startsWith('/static/') && !file.startsWith('/template/')) { res.writeHead(404).end(); return; }
  try {
    const data = await fs.readFile(path.join(root, file));
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  } catch { res.writeHead(404).end(); }
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const records = { one: [], two: [] };
  let serial = 0, issued = 0, revealFailure = false, createFailure = false, statusFailure = false;
  let holdSecret = false, releaseSecret;
  const choose = async id => {
    await page.locator('[data-workspace-picker-toggle]').click();
    await page.locator('[data-workspace-list] [data-workspace-id="' + id + '"]').click();
  };
  await page.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url()).pathname;
    const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (url.endsWith('/auth/me')) return reply({ user: { id: 'u', display_name: '테스트', email: 'test@example.test', is_platform_admin: false } });
    if (url.endsWith('/account/organizations')) return reply([{ id: 'org', name: '개인', is_personal: true }]);
    if (url.endsWith('/workspaces') || url.endsWith('/recent')) return reply(['one', 'two'].map(id => ({ id, name: '작업공간 ' + id, organization_id: 'org', status: 'active' })));
    if (url.endsWith('/visits')) return route.fulfill({ status: 204 });
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
    await page.locator('[data-mcp-token-list-state]').filter({ hasText: '없습니다' }).waitFor();
    assert(await downloadButton.isDisabled());
    createFailure = true; await page.locator('[data-mcp-enroll]').click();
    await page.locator('[data-mcp-token-message]').filter({ hasText: '발급하지 못' }).waitFor();
    createFailure = false; await page.locator('[data-mcp-enroll]').click();
    await page.waitForFunction(() => document.querySelector('[data-mcp-token]').value === 'fixture-secret-token-1');
    assert.equal(issued, 1);
    await page.reload();
    await page.waitForFunction(() => document.querySelector('[data-mcp-token]').value === 'fixture-secret-token-1');
    await mockClipboard(false);
    await page.locator('[data-mcp-copy-token]').click();
    await page.waitForFunction(() => window.copied === 'fixture-secret-token-1');
    assert(!(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).includes('fixture-secret'));
    assert(!(await copyAI.isDisabled()));
    await copyAI.click();
    await page.waitForFunction(() => window.copied.includes('agent-factory-one-vscode-ide-token-1.zip'));
    assert.equal(issued, 1);
    const clients = await page.locator('[data-mcp-client] option').evaluateAll(options => options.map(option => option.value));
    assert.equal(clients.length, 13);
    for (const client of clients) {
      await page.locator('[data-mcp-client]').selectOption(client);
      const variants = await page.locator('[data-mcp-variant] option').evaluateAll(options => options.map(option => option.value));
      for (const variant of variants) {
        if (variants.length > 1) await page.locator('[data-mcp-variant]').selectOption(variant);
        await refresh();
        if (await downloadButton.isDisabled()) {
          await page.locator('[data-mcp-enroll]').click();
          await page.waitForFunction(() => !!document.querySelector('[data-mcp-token]').value);
        }
        const selectedId = await page.locator('[data-mcp-token-select]').inputValue();
        const issuedBeforeDownload = issued;
        const file = await download();
        assert.equal(issued, issuedBeforeDownload);
        const metadata = JSON.parse(file.data['connection.json']);
        assert.equal(metadata.workspaceId, 'one'); assert.equal(metadata.tokenId, selectedId);
        assert.equal(JSON.parse(file.data['credentials.json']).token, 'fixture-secret-' + selectedId);
        assert(file.data[metadata.configFile].includes('/factory/mcp/workspaces/one/'));
        if (metadata.configFile.endsWith('.json')) JSON.parse(file.data[metadata.configFile]);
        if (metadata.configFile.endsWith('.toml')) {
          require('node:child_process').execFileSync('python3', ['-c', 'import tomllib,sys; tomllib.loads(sys.stdin.read())'], { input: file.data[metadata.configFile] });
        }
        await copyAI.click();
        await page.waitForFunction(expected => window.copied === expected, file.data['README.txt']);
        assert(file.data['README.txt'].includes(file.filename));
        assert(!file.data['README.txt'].includes('fixture-secret'));
      }
    }
    await page.locator('[data-mcp-client]').selectOption('vscode');
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
    await choose('two'); assert.equal(await token.inputValue(), '');
    assert.equal(await page.locator('[data-mcp-ai-text]').inputValue(), '');
    await choose('one');
    await page.waitForFunction(() => document.querySelector('[data-mcp-token]').value === 'fixture-secret-token-1');
    const secondId = 'token-' + (serial + 1);
    await page.locator('[data-mcp-enroll]').click();
    await page.waitForFunction(id => document.querySelector('[data-mcp-token]').value === 'fixture-secret-' + id, secondId);
    const issuedTotal = issued;
    await page.locator('[data-mcp-token-select]').selectOption('token-1');
    await page.waitForFunction(() => document.querySelector('[data-mcp-token]').value === 'fixture-secret-token-1');
    records.one.find(row => row.id === 'token-1').state = 'verified';
    await page.locator('[data-mcp-refresh]').click();
    await page.waitForFunction(() => document.querySelector('[data-mcp-status]').textContent === 'MCP 연결됨');
    assert.equal(await page.locator('[data-workspace-shell]').getAttribute('data-mcp-locked'), 'false');
    assert(await page.locator('[data-mcp-dismiss]').isHidden());
    assert(await page.locator('[data-mcp-onboarding]').isVisible());
    assert(await page.locator('[data-no-activities]').isHidden());
    assert(!(await page.locator('[data-mcp-refresh]').isDisabled()));
    assert.equal(await page.locator('.mcp-connection-toast').count(), 1);
    await refresh();
    assert.equal(await page.locator('.mcp-connection-toast').count(), 1);
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
    await page.locator('[data-mcp-config]').waitFor();
    await refresh();
    assert.equal(await secondRow.count(), 0);
    const helpColors = await page.evaluate(() => [getComputedStyle(document.querySelector('.mcp-extra-help')).color, getComputedStyle(document.querySelector('.mcp-manual-body')).color]);
    assert.equal(helpColors[0], helpColors[1]);
    statusFailure = true; await refresh();
    await page.locator('[data-mcp-token-list-state]').filter({ hasText: '불러오지 못' }).waitFor();
    statusFailure = false; await refresh();
    assert(await page.locator('[data-mcp-config]').isVisible());
    assert(await page.locator('[data-mcp-auth-help]').isVisible());
    assert.equal(await page.locator('.mcp-manual-setup details, [data-mcp-expand-config], [data-mcp-config-preview]').count(), 0);
    await page.locator('[data-mcp-client]').selectOption('codex');
    await page.locator('[data-mcp-variant]').selectOption('cli');
    await refresh();
    const codexTokenId = await page.locator('[data-mcp-token-select]').inputValue();
    await page.reload();
    await page.waitForFunction(() => document.querySelector('[data-mcp-token]').value !== '');
    assert.equal(await page.locator('[data-mcp-client]').inputValue(), 'codex');
    assert.equal(await page.locator('[data-mcp-variant]').inputValue(), 'cli');
    assert.equal(await page.locator('[data-mcp-token-select]').inputValue(), codexTokenId);
    assert.equal(await page.locator('[data-mcp-status]').textContent(), 'MCP 연결 대기');
    assert.equal(await page.locator('.mcp-connection-toast').count(), 0);
    assert(!(await page.evaluate(() => JSON.stringify(localStorage))).includes('fixture-secret'));
    assert(await page.locator('[data-mcp-config]').isVisible());
    const panelLayout = await page.evaluate(() => {
      const setup = document.querySelector('.mcp-setup').getBoundingClientRect();
      const tokens = document.querySelector('.mcp-token-panel').getBoundingClientRect();
      return setup.right <= tokens.left && setup.top === tokens.top;
    });
    assert(panelLayout);
    await refresh();
    await download();
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.evaluate(() => { delete navigator.clipboard; document.execCommand = window.nativeExecCommand; });
    await copyAI.click();
    const actualClipboard = await page.evaluate(() => navigator.clipboard.readText());
    assert(actualClipboard.includes('첨부한 agent-factory-one-codex-'));
    assert(actualClipboard.includes('credentials.json'));
    assert(await page.locator('[data-mcp-ai-fallback]').isHidden());
    assert.equal(await page.locator('[data-mcp-ai-message]').textContent(), '클립보드에 복사되었습니다.');
    assert(!actualClipboard.includes('fixture-secret'));
    await page.screenshot({ path: '/tmp/mcp-file-handoff-desktop.png' });
    await page.locator('[data-mcp-connections]').evaluate(list => {
      for (let i = 0; i < 40; i++) { const row = document.createElement('li'); row.textContent = 'Token ' + i; list.append(row); }
    });
    assert(await page.locator('.mcp-token-panel .mcp-panel-body').evaluate(node => { node.scrollTop = 100; return node.scrollTop > 0; }));
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: '/tmp/mcp-file-handoff-mobile.png' });
    assert.deepEqual(errors, []);
    console.log('PASS file handoff: 13 clients/all variants, valid ZIP/native config, persistent token selection, no auto issue, clipboard fallback, legacy/revoked/error handling, stale responses, mobile');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
