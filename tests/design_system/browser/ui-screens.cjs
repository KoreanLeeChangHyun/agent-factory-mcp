// NODE_PATH=/tmp/af-pw/node_modules node tests/design_system/browser/ui-screens.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let failFolders = false, releaseScope, scopeRequests = 0;
    let holdAdmin = false, releaseAdmin;
    let holdFolder=false, heldFolder;
    const destructiveRequests = [];
    const workspace = { id: 'one', organization_id: 'org', name: '한국어 작업공간 이름', status: 'active' };
    const connection = { id: 'drive', name: 'Google Drive', status: 'active', provider_id: 'google' };
    await page.route('http://ui.test/**', async route => {
      const url = new URL(route.request().url());
      const p = url.pathname;
      const reply = (json, status = 200) => route.fulfill({ json, status });
      if (p.startsWith('/api/')) {
        if (['PATCH','DELETE'].includes(route.request().method()) && /\/(integrations\/drive|integration-collections\/collection)$/.test(p)) {
          destructiveRequests.push({path:p, method:route.request().method(), body:route.request().postDataJSON()});
          return reply({ok:true});
        }
        if (p === '/api/auth/me') return reply({ user: { id: 'user', display_name: '테스터', email: 'user@example.test', is_platform_admin: true } });
        if (p === '/api/account/organizations') return reply([{ id: 'org', name: '개인', is_personal: true }]);
        if (p.endsWith('/workspaces') || p.endsWith('/recent')) return reply([workspace]);
        if (p.endsWith('/visits')) return route.fulfill({ status: 204 });
        if (p.endsWith('/mcp-connections')) return reply({ state: 'verified', connections: [] });
        if (p.endsWith('/plan')) return reply({ items: [], settings: {}, can_edit: false });
        if (p.endsWith('/reporting')) return reply({ agents: [], tasks: [] });
        if (p === '/api/integration-providers') return reply([{ id: 'google', key: 'google-drive' }]);
        if (p.endsWith('/integrations')) return reply([connection]);
        if (p.endsWith('/integrations/drive/state')) return reply({ status: 'active', inspection: { health: 'available' } });
        if (p.endsWith('/integration-collections')) {
          if (route.request().method() === 'POST') {
            scopeRequests++;
            await new Promise(resolve => { releaseScope = resolve; });
            return reply({ error: { message: '범위 저장 실패. 다시 시도하세요.' } }, 503);
          }
          return reply({ collections: [{ collection_id: 'collection', connection_id: 'drive', name: '제품 문서', enabled: true, last_refresh_status: 'succeeded' }] });
        }
        if (p.endsWith('/drive/folders') && holdFolder && url.searchParams.get('parent_id')==='folder') {heldFolder=route;return;}
        if (p.endsWith('/drive/folders')) return failFolders
          ? reply({ error: { message: '폴더 조회 권한이 없습니다.' } }, 403)
          : reply({ folders: [{ id: 'folder', name: '긴 한국어 폴더 이름과 식별자 '.repeat(4) }], next_page_token: null });
        if (p === '/api/admin/dashboard') {
          if (holdAdmin) await new Promise(resolve=>{releaseAdmin=resolve;});
          return reply({ users: 2, organizations: 1 });
        }
        if (p === '/api/admin/users') return reply({ error: { message: '조회 권한 없음' } }, 403);
        if (p === '/api/admin/jobs') return reply([{id:'작업-'.repeat(70),name:'<script>not executable</script>',status:'pending',payload:'not displayed',rules:'not displayed'}]);
        return reply([]);
      }
      const file = p.startsWith('/admin/assets/') ? 'assets/ui-kit/' + (p.slice('/admin/assets/'.length) || 'index.html') : p === '/workspace/' ? 'template/workspace/index.html' : p.slice(1);
      return route.fulfill({ body: await fs.readFile(path.join(root, file)), contentType: file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.svg') ? 'image/svg+xml' : 'text/html' });
    });
    await page.goto('http://ui.test/workspace/');
    assert.deepEqual(await page.evaluate(async()=>{
      const origin=document.createElement('button'), menu=document.createElement('div');
      menu.style.cssText='position:fixed;width:200px;height:120px';
      document.body.append(origin,menu);
      const cleanup=agentFactoryPositioning.positionMenu(menu,{origin,x:innerWidth-1,y:innerHeight-1});
      const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      await frame();
      const rect=menu.getBoundingClientRect();
      const bounded=rect.left>=8&&rect.top>=8&&rect.right<=innerWidth-8&&rect.bottom<=innerHeight-8;
      cleanup(); menu.style.left='17px'; dispatchEvent(new Event('resize')); await frame();
      const stopped=menu.style.left==='17px';
      const error=menu.dataset.positionError || null;
      origin.remove();menu.remove();return {bounded,stopped,error};
    }),{bounded:true,stopped:true,error:null});
    assert.deepEqual(await page.evaluate(()=>{
      const root=document.createElement('p'); root.dataset.owner='retained';
      agentFactoryUI.setStatus(root,{kind:'loading',text:'대기'});
      const busy=root.getAttribute('aria-busy');
      agentFactoryUI.setStatus(root,{kind:'error',text:'실패'});
      const error={role:root.getAttribute('role'),busy:root.hasAttribute('aria-busy'),text:root.textContent};
      agentFactoryUI.setStatus(root,{text:''});
      return {busy,error,hidden:root.hidden,owner:root.dataset.owner};
    }),{busy:'true',error:{role:'alert',busy:false,text:'실패'},hidden:true,owner:'retained'});
    await page.locator('[data-workspace-list] [data-workspace-id="one"]').click();
    await page.locator('[data-activity="integrations"]').click();
    await page.locator('.ui-resource-row').waitFor({ state: 'attached' });
    const workbarBoxes=await Promise.all([
      page.locator('.primary-sidebar__header').boundingBox(),
      page.locator('.integration-editor-header').boundingBox(),
    ]);
    assert.deepEqual(workbarBoxes.map(box=>box.height),[35,35]);
    assert.equal(new Set(workbarBoxes.map(box=>box.y+box.height)).size,1);
    assert.equal(await page.locator('.ui-resource-row').getAttribute('aria-pressed'), 'true');
    const color = selector => page.locator(selector).evaluate(el => getComputedStyle(el).backgroundColor);
    assert.equal(await color('[data-authorize-connection]'), 'rgb(14, 99, 156)');
    await page.locator('[data-integration-tab="status"]').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('[data-integration-tab="scope"]').getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('[data-integration-tab="scope"]').getAttribute('tabindex'), '0');
    assert.equal(await page.locator('[data-integration-tab="scope"]').evaluate(el=>document.getElementById(el.getAttribute('aria-controls')).getAttribute('role')), 'tabpanel');
    await page.keyboard.press('End');
    assert.equal(await page.locator('[data-integration-tab="settings"]').getAttribute('aria-selected'), 'true');
    await page.locator('[data-integration-tab="scope"]').click();await page.locator('.drive-folder-row').waitFor();
    holdFolder=true;
    const folderRequest=page.waitForRequest(request=>request.url().includes('parent_id=folder'));
    await page.locator('.drive-folder-row').getByRole('button',{name:/폴더 열기/}).click();await folderRequest;
    await page.locator('[data-drive-up]').click();await page.locator('.drive-folder-row').waitFor();
    assert(heldFolder);await heldFolder.fulfill({json:{folders:[{id:'stale',name:'오래된 하위 폴더'}],next_page_token:null}});holdFolder=false;
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(await page.getByRole('button',{name:'오래된 하위 폴더',exact:true}).count(),0);
    assert.equal(await page.locator('[data-drive-path]').textContent(),'내 드라이브');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.locator('[data-integration-tab="scope"]').click();
      await page.locator('.drive-folder-row').waitFor();
      await page.locator('.drive-folder-row button').first().click();
      await page.getByLabel('범위 이름', { exact: true }).fill('제품 문서');
      assert.equal(await page.getByLabel('범위 이름', { exact: true }).evaluate(el => getComputedStyle(el).height), '30px');
      assert(await page.locator('.integration-canvas').evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Integration overflow');
      await page.locator('[data-integration-tab="settings"]').click();
      await page.keyboard.press('Tab');
      await page.locator('[data-disconnect-account]').focus();
      assert.equal(await page.locator('[data-disconnect-account]').evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
      await page.locator('[data-integration-tab="status"]').click();
      assert.equal(await page.locator('.integration-canvas .af-metadata-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),width===390?1:3);
      await page.locator('[data-workspace-view="integrations"]').evaluate(el => { el.scrollTop = 0; });
      if (process.env.UI_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.UI_SCREENSHOT_DIR, `integration-${width}.png`) });
    }
    await page.locator('[data-integration-tab="scope"]').click();
    await page.locator('[data-scope-form] [type="submit"]').click();
    await page.waitForFunction(() => document.querySelector('[data-scope-form]').getAttribute('aria-busy') === 'true');
    await page.locator('[data-scope-form]').evaluate(el => el.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    while (!releaseScope) await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(scopeRequests, 1);
    releaseScope();
    await page.getByText('범위 저장 실패. 다시 시도하세요.').waitFor();
    assert(await page.locator('[data-scope-form] [type="submit"]').isEnabled());
    failFolders = true;
    await page.locator('[data-integration-tab="status"]').click();
    await page.locator('[data-integration-tab="scope"]').click();
    await page.getByText('폴더 조회 권한이 없습니다.').waitFor();
    assert.equal(await page.locator('[data-drive-state]').getAttribute('role'),'alert');
    assert.equal(await page.locator('[data-drive-state]').getAttribute('aria-busy'),null);
    await page.locator('[data-integration-tab="settings"]').click();
    const confirm = page.getByRole('dialog',{name:'작업 확인'});
    await page.locator('[data-disconnect-account]').click();
    await confirm.waitFor();
    await page.keyboard.press('Escape');
    assert.equal(destructiveRequests.length,0);
    assert.ok(await page.locator('[data-disconnect-account]').evaluate(el=>el===document.activeElement));
    await page.locator('[data-disconnect-account]').click();
    await Promise.all([
      page.waitForResponse(r=>r.request().method()==='GET'&&r.url().endsWith('/integrations')),
      confirm.getByRole('button',{name:'확인',exact:true}).click(),
    ]);
    assert.equal(destructiveRequests[0].method,'DELETE');
    assert.ok(destructiveRequests[0].path.endsWith('/workspaces/one/integrations/drive'));
    await page.locator('[data-integration-tab="settings"]').click();
    await page.locator('[data-unlink-collection]').click();
    await Promise.all([
      page.waitForResponse(r=>r.request().method()==='GET'&&r.url().endsWith('/integrations')),
      confirm.getByRole('button',{name:'확인',exact:true}).click(),
    ]);
    assert.deepEqual(destructiveRequests[1].body,{enabled:false});
    await page.locator('[data-integration-tab="settings"]').click();
    await page.locator('[data-disconnect-account]').click();
    await confirm.waitFor();
    await page.evaluate(()=>agentFactoryIntegrations.reset());
    assert.equal(await page.locator('dialog.af-confirm').count(),0);
    assert.equal(await page.locator('.drive-folder-row').count(),0);
    assert(await page.locator('[data-scope-form] [type="submit"]').isDisabled());
    assert.equal(await page.locator('[data-selected-folder]').textContent(),'선택하지 않음');
    assert.equal(destructiveRequests.length,2);
    await page.locator('[data-activity="account"]').click();
    assert(await page.locator('[data-account-email]').isVisible());
    assert.deepEqual(await page.locator('.account-canvas .af-metadata-grid dt').allTextContents(),['조직','작업공간']);
    await page.locator('[data-account-email]').evaluate(el=>{el.textContent='long-account-'.repeat(20)+'@example.test';});
    for (const width of [1440,390]) {
      await page.setViewportSize({width,height:900});
      assert(await page.locator('.account-canvas').evaluate(el=>el.scrollWidth<=el.clientWidth),'Account owns long identifier overflow');
      const columns=await page.locator('.account-canvas .af-metadata-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
      assert.equal(columns,width===390?1:3);
    }
    await page.locator('[data-activity="admin"]').click();
    await page.locator('[data-admin-content] .af-metadata-grid').waitFor();
    assert.equal(await page.locator('[data-admin-status]').getAttribute('data-kind'),'success');
    assert.equal(await page.locator('[data-admin-status]').getAttribute('aria-busy'),null);
    await page.locator('[data-admin-view="jobs"]').click();
    const adminTable=page.locator('[data-admin-content] .af-table');
    await adminTable.waitFor();
    assert.deepEqual(await adminTable.locator('th').allTextContents(),['id','name','status']);
    assert.equal(await adminTable.locator('script').count(),0);
    assert.equal(await adminTable.locator('td').nth(1).textContent(),'<script>not executable</script>');
    for(const width of [1440,390]) {
      await page.setViewportSize({width,height:900});
      assert(await page.locator('.admin-canvas').evaluate(el=>el.scrollWidth<=el.clientWidth),'Wide table does not widen the page');
      const geometry=await adminTable.locator('td').first().evaluate(el=>({padding:getComputedStyle(el).paddingLeft,token:getComputedStyle(el).getPropertyValue('--ui-space-3').trim()}));
      assert.equal(geometry.padding,geometry.token);
      if(width===390) assert(await page.locator('.admin-table-shell').evaluate(el=>{el.scrollLeft=100;return el.scrollLeft>0;}),'Table owns horizontal scrolling');
    }
    await page.locator('[data-admin-view="organizations"]').click();
    await page.locator('.admin-empty[data-kind="empty"]').waitFor();
    await page.locator('[data-admin-view="dashboard"]').click();
    await page.locator('[data-admin-content] .af-metadata-grid').waitFor();
    assert.deepEqual(await page.locator('[data-admin-content] dt').allTextContents(),['users','organizations']);
    assert.deepEqual(await page.locator('[data-admin-content] dd').allTextContents(),['2','1']);
    for (const width of [1440,390]) {
      await page.setViewportSize({width,height:900});
      assert(await page.locator('.admin-canvas').evaluate(el=>el.scrollWidth<=el.clientWidth),'Admin summary fits viewport');
      assert.equal(await page.locator('[data-admin-content] .af-metadata-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),width===390?1:3);
    }
    await page.setViewportSize({width:1440,height:900});
    await page.locator('[data-admin-view="assets"]').click();
    const catalog = page.frameLocator('.admin-asset-catalog');
    await catalog.locator('#primitive-example .ui-button').first().waitFor();
    const alignedHeaders = await page.locator('.workspace-shell').evaluate(shell => {
      const sidebar = shell.querySelector('.primary-sidebar__header').getBoundingClientRect();
      const admin = shell.querySelector('.admin-canvas > .af-page-header').getBoundingClientRect();
      return {
        top: Math.round(admin.top - sidebar.top),
        height: Math.round(admin.height - sidebar.height),
      };
    });
    assert.equal(alignedHeaders.top, 0, `Admin header top offset: ${JSON.stringify(alignedHeaders)}`);
    assert.equal(alignedHeaders.height, 0, `Admin header height offset: ${JSON.stringify(alignedHeaders)}`);
    assert.equal(await page.locator('[data-activity="admin"]').getAttribute('aria-label'), '슈퍼 관리자');
    assert.equal(await page.locator('[data-admin-catalog-link]').getAttribute('href'), '/admin/assets/');
    await catalog.locator('[data-demo-toast="success"]').click();
    await catalog.locator('#open-confirm').click();
    await catalog.locator('wa-dialog button').filter({hasText:'취소'}).waitFor();
    await page.keyboard.press('Escape');
    await catalog.locator('.af-toast').getByRole('button',{name:'알림 닫기'}).click();
    await catalog.locator('.af-toast').waitFor({state:'detached'});
    assert.equal(await page.locator('.admin-workspace .editor-header__tab').count(),0);
    await fs.mkdir(path.join(root,'artifacts/ui-review'),{recursive:true});
    for (const [width,height] of [[1440,1000],[1440,700],[390,900]]) {
      await page.setViewportSize({width,height});
      await catalog.locator('html').evaluate(el=>{el.scrollTop=0;document.body.scrollTop=0;});
      assert(await page.locator('.admin-canvas').evaluate(el=>el.scrollWidth<=el.clientWidth));
      assert(await catalog.locator('body').evaluate(el=>el.scrollWidth<=el.clientWidth), `Catalog overflow at ${width}px`);
      assert(await catalog.locator('.catalog-intro').first().isHidden());
      assert.equal(await catalog.locator('.catalog-grid').evaluate(el=>getComputedStyle(el).display),'block');
      const columns=await catalog.locator('.catalog-domain__items').first().evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
      assert.equal(columns,width===390?1:2);
      const geometry=await page.locator('.admin-asset-catalog').evaluate(el=>{
        const frame=el.getBoundingClientRect();
        const workspace=el.closest('.workspace').getBoundingClientRect();
        return {bottomGap:workspace.bottom-frame.bottom,height:frame.height};
      });
      assert(geometry.bottomGap>=0 && geometry.bottomGap<=25,JSON.stringify(geometry));
      assert(geometry.height>100,JSON.stringify(geometry));
      await page.locator('.admin-workspace').screenshot({path:path.join(root,`artifacts/ui-review/admin-layout-${width}-${height}.png`)});
    }
    await page.locator('[data-activity="account"]').click();
    assert.equal(await page.locator('.admin-asset-catalog').count(), 0);
    await page.locator('[data-activity="admin"]').click();
    await page.locator('[data-admin-content] .af-metadata-grid').waitFor();
    holdAdmin=true;
    const pendingRequest=page.waitForRequest('**/api/admin/dashboard');
    await page.evaluate(()=>{window.pendingAdminLoad=agentFactoryAdmin.load('dashboard');});
    await pendingRequest;
    assert.equal(await page.locator('[data-admin-status]').getAttribute('aria-busy'),'true');
    await page.locator('[data-admin-view="users"]').click();
    await page.locator('.admin-error[role="alert"]').waitFor();
    assert.equal(typeof releaseAdmin,'function');releaseAdmin();holdAdmin=false;
    await page.evaluate(()=>window.pendingAdminLoad);
    assert.equal(await page.locator('[data-admin-title]').textContent(),'사용자');
    assert.equal(await page.locator('.admin-error[role="alert"]').count(),1,'Old dashboard response must not replace the selected view error');
    assert.equal(await page.locator('[data-admin-status]').getAttribute('data-kind'),'error');
    assert.equal(await page.locator('[data-admin-status]').getAttribute('aria-busy'),null);
    assert.deepEqual(errors, []);
    console.log('PASS real integration/account/admin screens: desktop/mobile, long names, fields, selection, focus, busy, errors and permissions');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
