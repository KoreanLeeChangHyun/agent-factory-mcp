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
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const captureDirectory = process.env.AF_CAPTURE_DIR ? path.resolve(process.env.AF_CAPTURE_DIR) : null;
  if (captureDirectory) await fs.mkdir(captureDirectory, { recursive: true });
  const chooseWorkspace = async id => {
    await page.locator('[data-workspace-picker-toggle]').click();
    if (id) await page.locator('[data-workspace-list] [data-workspace-id="' + id + '"]').click();
  };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let organizations = [];
  let rows = [];
  let recent = [];
  let groups = [];
  let failCreate = false;
  let renameFailure = false;
  let failList = false;
  let delayedDocument;
  let slowId;
  let deferCreate = false;
  let finishCreate;
  const mutations = [];
  await context.addCookies([{ name: 'agent_factory_csrf', value: 'test-csrf', url: `http://127.0.0.1:${server.address().port}` }]);
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url()).pathname.replace(/^\/factory/, '');
    const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) {
      assert.equal(request.headers()['x-csrf-token'], 'test-csrf');
      mutations.push({ url, body: request.postData() ? request.postDataJSON() : null });
    }
    if (url.endsWith('/workspaces/groups') && request.method() === 'GET') return reply(groups);
    if (url.endsWith('/workspaces/groups') && request.method() === 'POST') {
      const group = { id: `group-${groups.length + 1}`, name: request.postDataJSON().name, collapsed: false, revision: 1, workspace_ids: [] };
      groups.push(group); return reply(group, 201);
    }
    if (/\/workspaces\/groups\/[^/]+$/.test(url) && request.method() === 'PATCH') {
      const group = groups.find(item => item.id === url.split('/').at(-1));
      const body = request.postDataJSON();
      if (!group || body.revision !== group.revision) return reply({}, 409);
      if (body.name !== undefined) group.name = body.name;
      if (body.collapsed !== undefined) group.collapsed = body.collapsed;
      group.revision += 1; return reply({ ...group, workspace_ids: [] });
    }
    if (/\/workspaces\/groups\/[^/]+\/workspaces\/[^/]+$/.test(url) && request.method() === 'PUT') {
      const parts = url.split('/'); const group = groups.find(item => item.id === parts.at(-3)); const workspaceId = parts.at(-1);
      for (const item of groups) item.workspace_ids = item.workspace_ids.filter(id => id !== workspaceId);
      group.workspace_ids.push(workspaceId); return route.fulfill({ status: 204 });
    }
    if (/\/workspaces\/groups\/workspaces\/[^/]+$/.test(url) && request.method() === 'DELETE') {
      const workspaceId = url.split('/').at(-1);
      for (const item of groups) item.workspace_ids = item.workspace_ids.filter(id => id !== workspaceId);
      return route.fulfill({ status: 204 });
    }
    if (request.method() === 'PUT' && /\/workspaces\/[^/]+$/.test(url)) {
      assert.equal(request.headers()['x-csrf-token'], 'test-csrf');
      if (renameFailure) return reply({}, 403);
      const row = rows.find(row => row.id === url.split('/').at(-1));
      const body = request.postDataJSON();
      if (body.revision !== row.revision) return reply({}, 409);
      row.name = body.name; row.revision++;
      return reply(row);
    }
    if (url.endsWith('/mcp-connections')) return reply({ state: 'verified', connections: [] });
    if (url === '/api/auth/me') return reply({ user: { id: 'user', display_name: '테스터', email: 'test@example.com', is_platform_admin: false } });
    if (url === '/api/account/organizations') return reply(organizations);
    if (url.endsWith('/visits')) { const id = url.split('/').at(-2); recent = [rows.find(row => row.id === id), ...recent.filter(row => row.id !== id)]; return route.fulfill({ status: 204 }); }
    if (url.endsWith('/documents')) {
      if (url.includes(slowId) && slowId) { delayedDocument = () => reply([{ id: 'stale', title: '다른 공간 문서', document_type: 'processed', current_revision_number: 1 }]); return; }
      return reply([]);
    }
    if (url.endsWith('/recent')) return reply(recent.filter(row => url.includes(row.organization_id)));
    if (request.method() === 'POST' && (url.endsWith('/workspaces') || url.endsWith('/personal-workspaces'))) {
      if (failCreate) return reply({ error: { message: 'denied' } }, 403);
      if (!organizations.length) organizations = [{ id: 'personal-owner', name: '테스터 Personal', is_personal: true }];
      const row = { id: `workspace-${rows.length + 1}`, organization_id: organizations[0].id, status: 'active', revision: 1, ...request.postDataJSON() };
      rows.push(row);
      if (deferCreate) { finishCreate = () => reply(row, 201); return; }
      return reply(row, 201);
    }
    if (url.endsWith('/workspaces')) return failList ? reply({}, 500) : reply(rows.filter(row => url.includes(row.organization_id)));
    return reply({});
  });
  const base = `http://127.0.0.1:${server.address().port}/factory/workspace/`;
  const visible = selector => page.locator(selector).isVisible();
  const menu = async () => { await page.locator('[data-workspace-picker-toggle]').click(); };
  try {
    await page.goto(base);
    await page.waitForFunction(() => document.querySelector('[data-workspace-list-state]').textContent.includes('없습니다'));
    const initialViewport = page.viewportSize();
    const profileTrigger = page.locator('[data-profile-toggle]');
    const profileMenu = page.locator('[data-profile-menu]');
    const logout = page.locator('[data-logout]');
    for (const width of [1440,390]) {
      await page.setViewportSize({width,height:900});
      await profileTrigger.focus(); await profileTrigger.press('ArrowDown');
      assert(await logout.evaluate(el=>el===document.activeElement));
      await page.waitForFunction(()=>{
        const menu=document.querySelector('[data-profile-menu]'),box=menu.getBoundingClientRect();
        return !!menu.style.left && box.left>=7 && box.right<=innerWidth-7 && box.top>=0 && box.bottom<=innerHeight;
      });
      await logout.press('Home');assert(await logout.evaluate(el=>el===document.activeElement));
      await logout.press('Escape');assert(await profileMenu.isHidden());
      assert(await profileTrigger.evaluate(el=>el===document.activeElement));
      assert.equal(await profileTrigger.getAttribute('aria-expanded'),'false');
      await profileTrigger.click();await logout.press('Tab');assert(await profileMenu.isHidden());
      await profileTrigger.click();await page.locator('.workspace-picker').click({position:{x:4,y:4}});assert(await profileMenu.isHidden());
    }
    await page.setViewportSize(initialViewport);
    assert(await visible('.workspace-picker'));
    assert(await visible('.activity-bar'));
    assert.equal(await page.locator('[data-region=activity-bar]').count(), 1);
    assert.equal(await page.locator('aside[data-region="primary-sidebar"]').count(), 1);
    assert.equal(await page.locator('aside[data-region="primary-sidebar"] [data-sidebar-view]').count(), 11);
    assert.equal(await page.locator('main[data-region="workspace"] > [data-workspace-view="organization"]').count(), 1);
    assert.equal(await page.locator('main[data-region="workspace"] > [data-workspace-view="workspaces"]').count(), 1);
    assert.equal(await page.locator('.start-rail').count(), 0);
    assert(await visible('[data-workspace-picker-toggle]'));
    assert.equal(await page.locator('[data-activity]:visible').count(), 0);
    assert.equal(await page.locator('[data-organization-select]').inputValue(), '');
    assert.equal(await page.locator('.workspace-title-bar [data-organization-select]').count(), 0);
    assert.equal(await page.locator('.organization-sidebar [data-organization-select]').count(), 1);
    const headerGeometry = await page.locator('.workspace-title-bar').evaluate(header => ({
      height: header.getBoundingClientRect().height,
      rowHeight: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--title-bar-height')),
      rows: getComputedStyle(header.parentElement).gridTemplateRows.split(' ').length,
    }));
    assert.equal(headerGeometry.height, headerGeometry.rowHeight);
    assert.equal(headerGeometry.rows, 2);
    await page.screenshot({ path: '/tmp/workspace-start-empty.png' });
    await page.locator('.workspace-picker-links [data-create-workspace]').click();
    await page.locator('#workspace-name').fill('첫 프로젝트');
    failCreate = true;
    await page.locator('[data-create-form] [type=submit]').click();
    await page.waitForFunction(() => document.querySelector('[data-create-error]').textContent.includes('권한'));
    assert(await visible('[data-create-dialog]'));
    failCreate = false;
    await page.locator('[data-create-form] [type=submit]').click();
    await page.waitForFunction(() => document.querySelector('[data-workspace-shell]').dataset.mode === 'workspace');
    assert(await visible('.activity-bar'));
    assert(!await visible('.workspace-picker'));
    assert.equal(await page.evaluate(() => tenant.workspaceId || ''), 'workspace-1');
    assert(!await visible('[data-workspace-view="documents"]'));
    assert.equal(await page.locator('[data-activity].is-active').count(), 0);
    assert(mutations.some(item => item.url === '/api/account/personal-workspaces'));
    assert.equal(await page.locator('[data-connect-workspace], [data-workspace-filter]').count(), 0);
    await menu();
    await page.locator('[data-workspace-header-actions] [data-create-workspace]').click();
    await page.locator('#workspace-name').fill('두 번째 프로젝트');
    await page.locator('[data-create-form] [type=submit]').click();
    await page.waitForFunction(() => tenant.workspaceId === 'workspace-2');
    assert(await visible('[data-workspace-picker-toggle]'));
    assert.equal(await page.locator('[data-workspace-picker-toggle]').getAttribute('aria-pressed'), 'true');
    assert(await visible('.workspace-picker-sidebar'));
    assert.equal(await page.locator('.activity-button__label').count(), 11);
    assert.equal(await page.locator('.activity-bar').evaluate(node => getComputedStyle(node).borderTopWidth), '1px');
    assert.equal(await page.locator('.workspace-title-bar [data-workspace-select], .workspace-title-bar [data-workspace-actions]').count(), 0);
    assert.deepEqual(await page.locator('.activity-bar > button').evaluateAll(buttons => buttons.slice(0, 2).map(button => button.getAttribute('aria-label'))), ['조직', '작업공간 목록']);
    const previousIcons = await page.locator('[data-activity]:visible').count();
    await page.locator('[data-open-organizations]').click();
    assert(await visible('.organization-sidebar'));
    assert(await visible('.organization-view'));
    assert.equal(await page.evaluate(() => tenant.workspaceId), 'workspace-2');
    assert.equal(await page.locator('[data-activity]:visible').count(), previousIcons);
    await page.screenshot({ path: '/tmp/workspace-organizations.png' });
    await chooseWorkspace('workspace-2');
    const originalBar = await page.locator('.activity-bar').elementHandle();
    await page.locator('[data-activity="logs"]').click({ button: 'right' });
    await page.locator('[data-activity-visibility="logs"]').click();
    await page.keyboard.press('Escape');
    assert(!await visible('[data-activity="logs"]'));
    await page.locator('[data-activity="documents"]').focus();
    await page.keyboard.press('Alt+ArrowUp');
    const orderTwo = await page.locator('.activity-bar [data-activity]').evaluateAll(nodes => nodes.map(node => node.dataset.activity));
    await chooseWorkspace('workspace-1');
    assert(await visible('[data-activity="logs"]'));
    assert.notDeepEqual(await page.locator('.activity-bar [data-activity]').evaluateAll(nodes => nodes.map(node => node.dataset.activity)), orderTwo);
    await chooseWorkspace('workspace-2');
    assert(!await visible('[data-activity="logs"]'));
    assert.deepEqual(await page.locator('.activity-bar [data-activity]').evaluateAll(nodes => nodes.map(node => node.dataset.activity)), orderTwo);
    assert(await originalBar.evaluate(node => node === document.querySelector('.activity-bar')));
    const defaultWorkspaceGroup=page.locator('[data-workspace-default-group]');
    assert.equal(await page.locator('.primary-sidebar.af-sidebar-host.af-kit').count(),1);
    assert.equal(await page.locator('[data-sidebar-view].af-sidebar-view').count(),11);
    assert.deepEqual(await page.locator('.primary-sidebar').evaluate(host => {
      const pairs = [
        ['.app-sidebar__section','af-sidebar-section'],
        ['.app-sidebar__section-header','af-sidebar-section__header'],
        ['.app-sidebar__section-content','af-sidebar-section__content'],
        ['.app-sidebar__nav','af-sidebar-navigation'],
        ['.app-sidebar__row','af-sidebar-navigation__item'],
        ['.app-sidebar__state','af-sidebar-state'],
      ];
      return pairs.flatMap(([selector,className]) => [...host.querySelectorAll(selector)]
        .filter(element => !element.classList.contains(className)).map(() => selector));
    }),[]);
    assert.equal(await page.locator('[data-workspace-list] > .af-explorer-tree').count(),1);
    assert.equal(await defaultWorkspaceGroup.locator(':scope > .af-explorer-line').getByText('기본 그룹', { exact: true }).count(), 1);
    assert.equal(await page.locator('[data-workspace-list] img, [data-workspace-list] [data-material-icon]').count(),0);
    assert.equal(await defaultWorkspaceGroup.locator(':scope > .af-explorer-line > .af-explorer-icon-slot').evaluate(node=>getComputedStyle(node).display),'none');
    assert.equal(await page.locator('.workspace-ungrouped > .af-explorer-group').evaluate(node=>getComputedStyle(node,'::before').display),'none');
    assert.equal(await page.evaluate(() => {
      const group=document.querySelector('[data-workspace-default-group] > .af-explorer-line .af-explorer-name');
      const workspace=document.querySelector('.workspace-ungrouped [data-workspace-id] > .af-explorer-line .af-explorer-name');
      return workspace.getBoundingClientRect().left-group.getBoundingClientRect().left;
    }),8);
    assert.equal(await defaultWorkspaceGroup.locator(':scope > .af-explorer-line').evaluate(node=>node.getBoundingClientRect().height),22);
    await defaultWorkspaceGroup.locator(':scope > .af-explorer-line').click();assert.equal(await defaultWorkspaceGroup.getAttribute('aria-expanded'),'false');
    assert(!await visible('.workspace-ungrouped [data-workspace-id]'));
    await defaultWorkspaceGroup.locator(':scope > .af-explorer-line').click();assert.equal(await defaultWorkspaceGroup.getAttribute('aria-expanded'),'true');
    assert.equal(await page.locator('.workspace-ungrouped [data-workspace-id]').count(),2);
    await page.locator('[data-activity="documents"]').click();
    const geometry = await page.evaluate(() => {
      const side = document.querySelector('.primary-sidebar');
      const main = document.querySelector('.workspace');
      return {
        gap: main.getBoundingClientRect().left - side.getBoundingClientRect().right,
        mainRadius: getComputedStyle(main).borderRadius,
        sideRadius: getComputedStyle(side).borderRadius,
        mainBorder: getComputedStyle(main).borderTopWidth,
        sideBorder: getComputedStyle(side).borderTopWidth,
        mainBackground: getComputedStyle(main).backgroundColor,
        sideBackground: getComputedStyle(side).backgroundColor,
      };
    });
    assert.equal(geometry.gap, 5);
    assert.equal(geometry.mainRadius, '7px');
    assert.equal(geometry.sideRadius, geometry.mainRadius);
    assert.equal(geometry.mainBorder, '1px');
    assert.equal(geometry.sideBorder, geometry.mainBorder);
    assert.equal(geometry.sideBackground, geometry.mainBackground);
    const resizer = page.locator('[data-sidebar-resizer]');
    assert.equal(await page.locator('[data-sidebar-toggle]').count(), 0);
    const defaultSidebarWidth = await page.locator('.primary-sidebar').evaluate(node => node.getBoundingClientRect().width);
    const mainWidthWithSidebar = await page.locator('.workspace').evaluate(node => node.getBoundingClientRect().width);
    const resizerBox = await resizer.boundingBox();
    await page.mouse.move(resizerBox.x + resizerBox.width / 2, resizerBox.y + 20);
    await page.mouse.down();
    await page.mouse.move(resizerBox.x - 100, resizerBox.y + 20);
    await page.mouse.up();
    assert(await page.locator('.primary-sidebar').isHidden());
    assert(await resizer.isVisible());
    assert.equal(await resizer.getAttribute('aria-valuenow'), '0');
    if (captureDirectory) await page.screenshot({ path:path.join(captureDirectory, 'sidebar-collapsed.png') });
    assert(await page.locator('.workspace').evaluate((node, width) => node.getBoundingClientRect().width > width, mainWidthWithSidebar));
    assert.equal(await page.evaluate(() => {
      const activity = document.querySelector('.activity-bar');
      const main = document.querySelector('.workspace');
      return main.getBoundingClientRect().left - activity.getBoundingClientRect().right;
    }), 5);
    const collapsedResizerBox = await resizer.boundingBox();
    await page.mouse.move(collapsedResizerBox.x + collapsedResizerBox.width / 2, collapsedResizerBox.y + 20);
    await page.mouse.down();
    await page.mouse.move(collapsedResizerBox.x + collapsedResizerBox.width / 2 + 100, collapsedResizerBox.y + 20);
    await page.mouse.up();
    assert(await page.locator('.primary-sidebar').isVisible());
    assert.equal(await page.locator('.primary-sidebar').evaluate(node => node.getBoundingClientRect().width), 280);
    if (captureDirectory) await page.screenshot({ path:path.join(captureDirectory, 'sidebar-drag-expanded.png') });
    await page.keyboard.press('Control+b');
    assert(await page.locator('.primary-sidebar').isHidden());
    await page.keyboard.press('Control+b');
    assert(await page.locator('.primary-sidebar').isVisible());
    await page.keyboard.press('Control+b');
    assert(await page.locator('.primary-sidebar').isHidden());
    await page.locator('[data-activity="documents"]').click();
    assert(await page.locator('.primary-sidebar').isVisible());
    await resizer.focus();
    const beforeWidth = await page.locator('.primary-sidebar').evaluate(node => node.getBoundingClientRect().width);
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('.primary-sidebar').evaluate(node => node.getBoundingClientRect().width), beforeWidth + 16);
    await page.locator('[data-activity="documents"]').click();
    await page.screenshot({ path: '/tmp/workspace-selected.png' });
    const persistedSidebarWidth = await page.locator('.primary-sidebar').evaluate(node => node.getBoundingClientRect().width);
    await page.reload();
    await page.waitForFunction(() => tenant.workspaceId === 'workspace-2');
    assert(await visible('[data-workspace-view="documents"]'));
    assert.equal(await page.locator('[data-header-workspace]').textContent(), await page.locator('[data-account-workspace]').textContent());
    assert(await visible('[data-header-workspace]'));
    assert.equal(await page.locator('[data-workspace-list] [aria-current="true"]').getAttribute('data-workspace-id'), 'workspace-2');
    assert.equal(await page.locator('.primary-sidebar').evaluate(node => node.getBoundingClientRect().width), persistedSidebarWidth);
    await page.locator('[data-activity="schedule"]').click();
    assert(await page.locator('.primary-sidebar').isHidden(),'Schedule defaults to a closed sidebar');
    await page.locator('[data-activity="schedule"]').click();
    assert.equal(await page.locator('.primary-sidebar').evaluate(node => node.getBoundingClientRect().width), defaultSidebarWidth);
    await page.evaluate(() => setSidebarWidth(360));
    await page.locator('[data-activity="documents"]').click();
    assert.equal(await page.locator('.primary-sidebar').evaluate(node => node.getBoundingClientRect().width), persistedSidebarWidth);
    await page.locator('[data-activity="schedule"]').click();
    assert.equal(await page.locator('.primary-sidebar').evaluate(node => node.getBoundingClientRect().width), 360);
    await page.locator('[data-activity="documents"]').click();
    await page.keyboard.press('Control+b');
    assert(await page.locator('.primary-sidebar').isHidden());
    await page.reload();
    await page.waitForFunction(() => tenant.workspaceId === 'workspace-2');
    await page.waitForFunction(() => document.querySelector('[data-workspace-shell]').dataset.mode === 'workspace');
    assert(await page.locator('.primary-sidebar').isHidden(),'Closed sidebar state is restored after reload');
    await page.locator('[data-activity="documents"]').click();
    assert(await page.locator('.primary-sidebar').isVisible(),'Selecting a task-list item opens its sidebar');
    assert.equal(await page.locator('.primary-sidebar').evaluate(node => node.getBoundingClientRect().width), persistedSidebarWidth);
    assert(!await visible('[data-activity="logs"]'));
    await page.locator('.activity-bar').click({ button: 'right', position: { x: 20, y: 550 } });
    const checked = await page.locator('[data-activity-visibility][aria-checked="true"]').evaluateAll(nodes => nodes.map(node => node.dataset.activityVisibility));
    const checkItems = page.locator('[data-activity-visibility]');
    await checkItems.first().press('End');assert(await checkItems.last().evaluate(el=>el===document.activeElement));
    await checkItems.last().press('Home');assert(await checkItems.first().evaluate(el=>el===document.activeElement));
    await checkItems.first().press('ArrowDown');assert(await checkItems.nth(1).evaluate(el=>el===document.activeElement));
    const toggled = checkItems.nth(1), priorChecked = await toggled.getAttribute('aria-checked');
    await toggled.press('Space');assert.equal(await toggled.getAttribute('aria-checked'),String(priorChecked!=='true'));
    assert(await toggled.evaluate(el=>el===document.activeElement),'Toggling retains the live focused checkbox');
    await toggled.press('Space');assert.equal(await toggled.getAttribute('aria-checked'),priorChecked);
    await page.setViewportSize({width:390,height:844});
    await page.waitForFunction(()=>{
      const box=document.querySelector('[data-activity-context-menu]').getBoundingClientRect();
      return box.left>=7 && box.right<=innerWidth-7 && box.top>=7 && box.bottom<=innerHeight-7;
    });
    await page.setViewportSize(initialViewport);
    for (const activity of checked) await page.locator(`[data-activity-visibility="${activity}"]`).click();
    await page.keyboard.press('Escape');
    assert(await visible('[data-no-activities]'));
    assert(await page.locator('[data-configure-activities]').evaluate(el=>el===document.activeElement));
    await page.locator('[data-configure-activities]').click();
    await page.locator('[data-activity-visibility="documents"]').click();
    await page.keyboard.press('Escape');
    assert(!await visible('[data-no-activities]'));
    assert(await visible('[data-workspace-view="documents"]'));
    await chooseWorkspace('workspace-1');
    assert(await visible('[data-activity="logs"]'));
    await chooseWorkspace('workspace-2');
    await menu();
    await page.keyboard.press('Escape');
    await page.locator('[data-workspace-picker-toggle]').click();
    assert(await visible('[data-workspace-metadata]'));
    assert.equal(await page.getByRole('tab', { name: '작업공간 정보', exact: true }).getAttribute('aria-selected'),'true');
    await page.getByRole('tab', { name: 'MCP 연결', exact: true }).click();
    assert(!await visible('[data-workspace-metadata]'));
    assert(await visible('[data-mcp-status]'));
    assert(await visible('.mcp-token-panel'));
    assert.equal(await page.locator('[data-mcp-connections]').getAttribute('aria-label'),'발급한 연결 토큰');
    await page.getByRole('tab', { name: '작업공간 정보', exact: true }).click();
    assert(await visible('[data-workspace-metadata]'));
    assert(await visible('[data-workspace-picker-toggle]'));
    assert((await page.locator('[data-activity]:visible').count()) > 0);
    assert.equal(await page.evaluate(() => tenant.workspaceId || ''), 'workspace-2');
    await page.locator('[data-activity="documents"]').click();
    assert(await visible('[data-workspace-view="documents"]'));
    assert(!await visible('.workspace-picker'));
    await page.locator('[data-workspace-picker-toggle]').click();
    assert(await visible('[data-workspace-metadata]'));
    assert.equal(await page.locator('[data-workspace-list] [data-workspace-id]').count(), 2);
    await page.screenshot({ path: '/tmp/workspace-start-list.png' });
    await page.reload();
    await page.waitForFunction(() => tenant.workspaceId === 'workspace-2');
    await page.waitForFunction(() => document.querySelector('[data-workspace-shell]').dataset.mode === 'workspace');
    assert((await page.locator('[data-activity]:visible').count()) > 0);
    slowId = 'workspace-1';
    await page.locator('[data-workspace-list] [data-workspace-id]').first().click();
    await page.waitForTimeout(50);
    await chooseWorkspace('workspace-2');
    await delayedDocument();
    await page.waitForTimeout(50);
    assert.equal(await page.locator('[data-processed-list]').textContent(), '');
    await menu();
    await page.locator('[data-workspace-picker-toggle]').click();
    assert.equal(await page.evaluate(() => tenant.workspaceId || ''), 'workspace-2');
    await chooseWorkspace('');
    assert.equal(await page.evaluate(() => tenant.workspaceId || ''), 'workspace-2');
    assert((await page.locator('[data-activity]:visible').count()) > 0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: '/tmp/workspace-start-mobile.png' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await menu();
    assert(await visible('[data-workspace-header-actions] [data-create-workspace]'));
    await page.keyboard.press('Escape');
    failList = true;
    await page.reload();
    await page.waitForFunction(() => !document.querySelector('[data-retry-workspaces]').hidden);
    failList = false;
    await page.locator('[data-retry-workspaces]').click();
    await page.waitForFunction(() => document.querySelectorAll('[data-workspace-list] [data-workspace-id]').length === 2);
    await page.locator('[data-create-workspace-group]').click();
    await page.getByRole('textbox', { name: '새 그룹 이름', exact: true }).fill('개발');
    await page.getByRole('textbox', { name: '새 그룹 이름', exact: true }).press('Enter');
    const workspaceGroupLine=page.locator('.workspace-group > .af-explorer-line');
    await workspaceGroupLine.getByText('개발', { exact: true }).waitFor();
    assert(await page.locator('.workspace-ungrouped').evaluate(node => node.compareDocumentPosition(document.querySelector('.workspace-group')) & Node.DOCUMENT_POSITION_FOLLOWING));
    assert.equal(await page.locator('.workspace-group-move').count(), 0);
    await page.locator('[data-workspace-list] [data-workspace-id="workspace-2"]').dragTo(workspaceGroupLine);
    await page.locator('.workspace-group [data-workspace-id="workspace-2"]').waitFor();
    await page.locator('.workspace-group [data-workspace-id="workspace-2"]').dragTo(page.locator('.workspace-ungrouped > .af-explorer-line'));
    await page.locator('.workspace-ungrouped [data-workspace-id="workspace-2"]').waitFor();
    await page.locator('.workspace-ungrouped [data-workspace-id="workspace-2"]').dragTo(workspaceGroupLine);
    assert.equal(await page.locator('.workspace-group [data-workspace-id="workspace-2"]').count(), 1);
    await workspaceGroupLine.click({ button: 'right' });
    await page.getByRole('menuitem', { name: '이름 변경', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    assert.ok(await page.locator('.workspace-group').evaluate(el=>el===document.activeElement));
    assert.equal(await page.getByRole('menuitem', { name: '이름 변경', exact: true }).count(),0);
    await workspaceGroupLine.click({ button: 'right' });
    await page.keyboard.press('Home');
    assert.ok(await page.getByRole('menuitem', { name: '이름 변경', exact: true }).evaluate(el=>el===document.activeElement));
    await page.getByRole('menuitem', { name: '이름 변경', exact: true }).click();
    await page.getByRole('textbox', { name: '그룹 이름 변경', exact: true }).fill('취소할 그룹');
    await page.keyboard.press('Escape');
    assert.equal(await workspaceGroupLine.locator('.af-explorer-name').textContent(), '개발');
    await page.locator('.workspace-group').focus(); await page.keyboard.press('F2');
    await page.getByRole('textbox', { name: '그룹 이름 변경', exact: true }).fill('  제품 개발  ');
    await page.keyboard.press('Enter');
    await page.locator('.workspace-group > .af-explorer-line').getByText('제품 개발', { exact: true }).waitFor();
    assert.equal(await page.locator('.workspace-group [data-workspace-id="workspace-2"]').count(), 1);
    await page.locator('.workspace-group > .af-explorer-line').click();
    assert(!await visible('.workspace-group [data-workspace-id="workspace-2"]'));
    await page.waitForFunction(() => workspaceGroups()[0]?.collapsed === true);
    await page.reload();
    await page.locator('.workspace-group > .af-explorer-line').waitFor();
    assert.equal(await page.locator('.workspace-group > .af-explorer-line .af-explorer-name').textContent(), '제품 개발');
    assert(!await visible('.workspace-group [data-workspace-id="workspace-2"]'));
    await page.locator('.workspace-group > .af-explorer-line').click();
    await page.locator('.workspace-group [data-workspace-id="workspace-2"]').click();
    assert(await visible('.workspace-picker-sidebar'));
    await page.locator('.workspace-group [data-workspace-id="workspace-2"]').click({ button: 'right' });
    await page.getByRole('menuitem', { name: '이름 변경', exact: true }).click();
    await page.getByRole('textbox', { name: '작업공간 이름 변경', exact: true }).fill('취소할 이름');
    await page.keyboard.press('Escape');
    await page.locator('.workspace-group [data-workspace-id="workspace-2"]').focus();
    await page.keyboard.press('F2');
    await page.getByRole('textbox', { name: '작업공간 이름 변경', exact: true }).fill('  변경한 작업공간  ');
    renameFailure = true;
    await page.keyboard.press('Enter');
    await page.locator('.workspace-rename [role="alert"]').getByText('이름을 변경할 권한이 없습니다.').waitFor();
    renameFailure = false;
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('[data-header-workspace]').textContent === '변경한 작업공간');
    assert.equal(await page.locator('[data-mcp-workspace]').textContent(), '변경한 작업공간');
    assert((await page.locator('[data-workspace-metadata]').textContent()).includes('변경한 작업공간'));
    assert((await page.locator('[data-workspace-metadata]').textContent()).includes('workspace-2'));
    await page.reload();
    await page.waitForFunction(() => document.querySelector('[data-header-workspace]').textContent === '변경한 작업공간');
    assert((await page.locator('.workspace-group [data-workspace-id="workspace-2"]').textContent()).includes('변경한 작업공간'));
    await page.screenshot({ path: '/tmp/workspace-groups.png' });
    await chooseWorkspace('');
    // A canceled creation must not mix its result into another ownership context.
    organizations.push({ id: 'other-owner', name: '다른 조직', is_personal: false });
    await page.reload();
    await page.waitForFunction(() => document.querySelectorAll('[data-workspace-list] [data-workspace-id]').length === 2);
    deferCreate = true;
    await page.locator('[data-workspace-header-actions] [data-create-workspace]').click();
    await page.locator('#workspace-name').fill('늦게 생성된 프로젝트');
    await page.locator('[data-create-form] [type=submit]').click();
    while (!finishCreate) await page.waitForTimeout(10);
    await page.keyboard.press('Escape');
    await page.locator('[data-open-organizations]').click();
    await page.locator('[data-organization-select]').selectOption('other-owner');
    await finishCreate();
    await page.waitForTimeout(80);
    assert.equal(await page.evaluate(() => tenant.workspaceId || ''), '');
    assert.equal(await page.locator('[data-workspace-list] [data-workspace-id]').count(), 0);
    await page.waitForFunction(() => document.querySelector('[data-workspace-shell]').dataset.mode === 'organization');
    await page.goto(base + '#account');
    await page.reload();
    await page.waitForFunction(() => !document.querySelector('[data-workspace-view="account"]').hidden);
    assert(await visible('[data-workspace-view="account"]'));
    assert.equal(await page.locator('[data-go-home]').count(), 0);
    assert(!(await page.locator('body').innerText()).includes('워크스페이스'));
    assert(!(await page.locator('body').innerText()).includes('시작 화면'));
    // A stored selection may only restore an accessible, active Workspace.
    await page.evaluate(() => localStorage.setItem('agentFactorySelection:user:other-owner', JSON.stringify({ workspaceId: 'not-accessible', mode: 'workspace', activity: 'documents' })));
    await page.goto(base);
    await page.reload();
    await page.waitForFunction(() => document.querySelector('[data-workspace-list-state]').textContent.includes('없습니다'));
    assert.equal(await page.evaluate(() => tenant.workspaceId || ''), '');
    assert.equal(await page.locator('[data-activity]:visible').count(), 0);
    // Browser storage is an optional navigation aid and must not block authenticated discovery.
    await page.addInitScript(() => {
      const unavailable = () => { throw new DOMException('Storage unavailable', 'SecurityError'); };
      Storage.prototype.getItem = unavailable;
      Storage.prototype.setItem = unavailable;
      Storage.prototype.removeItem = unavailable;
    });
    await page.reload();
    await page.waitForFunction(() => document.querySelectorAll('[data-workspace-list] [data-workspace-id]').length > 0);
    assert.notEqual(await page.locator('[data-workspace-list-state]').textContent(), '계정 정보를 불러오지 못했습니다.');
    assert.deepEqual(errors, []);
    console.log('PASS: empty, creation/error/repeated creation, open/switch/home, search/recent, connection scope, stale responses, mobile, retry, storage denial, /factory prefix, CSRF');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
