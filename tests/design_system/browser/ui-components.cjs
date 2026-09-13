// NODE_PATH=/tmp/af-pw/node_modules node tests/design_system/browser/ui-components.cjs
// Exercise the shipped CSS cascade, not a separate design-system stylesheet.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const template = await fs.readFile(path.join(root, 'template/workspace/index.html'), 'utf8');
    const styles = await Promise.all([...template.matchAll(/href="\.\.\/(static\/css\/[^\"]+)"/g)]
      .map(match => fs.readFile(path.join(root, match[1]), 'utf8')));
    const hosts = ['organization-view', 'planning-panel', 'reporting-panel', 'mcp-onboarding', 'integration-workspace', 'workspace-dialog', 'auth-card'];
    // Only the host layout is simplified. All component and feature CSS is real.
    await page.setContent(`<style>${styles.join('\n')}</style><style>
      html, body { height:auto; overflow:auto; font-family:var(--ui-font-family); }
      .sample { display:block; position:static; height:auto; width:auto; padding:16px; }
      .sample .controls { display:flex; gap:8px; flex-wrap:wrap; }
    </style><main>${hosts.map(host => `<section class="sample ${host}">
      <div class="controls"><button class="ui-button" data-basic>새로고침</button>
      <button class="ui-button ui-button--primary" data-primary>저장</button>
      <button class="ui-button ui-button--danger" data-danger>삭제</button>
      <button class="ui-button" disabled>권한 없음</button></div>
      <label class="ui-field">범위 이름<input value="긴 한국어 작업공간 이름과 식별자" /></label>
      <p class="ui-message" role="alert">연결에 실패했습니다. 다시 시도하세요.</p>
      <p class="ui-message ui-message--reserved" role="status"></p>
    </section>`).join('')}</main>`);
    // Inputs in Workspace features inherit their shell context in the real app.
    await page.locator('main').evaluate(el => el.classList.add('workspace-shell'));
    await page.addStyleTag({ content: 'main.workspace-shell { display:block; height:auto; }' });
    const metrics = locator => locator.evaluate(el => {
      const c = getComputedStyle(el);
      return Object.fromEntries(['height', 'padding', 'borderRadius', 'backgroundColor', 'color', 'fontSize'].map(k => [k, c[k]]));
    });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const reference = await metrics(page.locator('[data-basic]').first());
      for (const host of hosts) {
        const sample = page.locator(`.sample.${host}`);
        assert.deepEqual(await metrics(sample.locator('[data-basic]')), reference, host);
        assert.equal((await metrics(sample.locator('input'))).height, '30px', host);
        assert.equal(await sample.locator('[role="alert"]').evaluate(el => getComputedStyle(el).color), 'rgb(244, 135, 113)');
        assert.equal(await sample.locator('[role="status"]').evaluate(el => getComputedStyle(el).minHeight), '20px');
      }
      const button = page.locator('[data-primary]').first();
      await button.hover();
      assert.equal((await metrics(button)).backgroundColor, 'rgb(17, 119, 187)');
      await page.mouse.move(0, 0);
      await button.focus();
      assert.equal(await button.evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
      const before = await button.boundingBox();
      await button.evaluate(el => { el.disabled = true; el.setAttribute('aria-busy', 'true'); });
      const during = await button.boundingBox();
      assert.equal(during.width, before.width, 'Busy state must not move adjacent actions');
      assert.equal(during.height, before.height);
      assert.equal(await button.evaluate(el => getComputedStyle(el).cursor), 'progress');
      await button.evaluate(el => { el.disabled = false; el.removeAttribute('aria-busy'); });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    // Reproduce the original specificity defects under the entire CSS bundle.
    await page.locator('.sample.organization-view').evaluate(el => el.insertAdjacentHTML('beforeend', `
      <dl class="organization-stats"><div><dt>구성원</dt><dd><button class="ui-button ui-button--link">3</button></dd></div></dl>
      <nav class="organization-subnav ui-tabs"><button class="ui-tab" aria-current="page">개요</button></nav>`));
    assert.equal((await metrics(page.locator('.organization-stats button'))).fontSize, '18px');
    assert.equal((await metrics(page.locator('.organization-stats button'))).backgroundColor, 'rgba(0, 0, 0, 0)');
    assert.equal(await page.locator('.ui-tab').evaluate(el => getComputedStyle(el).borderBottomWidth), '2px');
    assert.equal((await metrics(page.locator('.ui-tab'))).borderRadius, '0px');

    // Load the real login HTML, JS and styles; delay a mocked response to observe busy state.
    const login = await browser.newPage({ viewport: { width: 390, height: 844 } });
    let release, submits = 0;
    await login.route('http://ui.test/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/auth/providers') return route.fulfill({ json: { providers: [] } });
      if (url.pathname === '/api/auth/login') {
        submits++;
        await new Promise(resolve => { release = resolve; });
        return route.fulfill({ status: 401, json: { error: { message: '이메일과 비밀번호를 확인하세요.' } } });
      }
      const file = url.pathname === '/login/' ? 'template/login/index.html' : url.pathname.slice(1);
      return route.fulfill({ body: await fs.readFile(path.join(root, file)), contentType: file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.svg') ? 'image/svg+xml' : 'text/html' });
    });
    await login.goto('http://ui.test/login/');
    await login.getByLabel('이메일', { exact: true }).fill('user@example.test');
    await login.getByLabel('비밀번호', { exact: true }).fill('incorrect-password');
    await login.getByRole('button', { name: '로그인', exact: true }).click();
    await login.waitForFunction(() => document.querySelector('[aria-busy="true"]'));
    await login.locator('form').evaluate(el => el.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    await login.waitForFunction(() => document.querySelector('button[type="submit"]').disabled);
    while (!release) await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(submits, 1);
    release();
    await login.getByRole('alert').getByText('이메일과 비밀번호를 확인하세요.').waitFor();
    assert.equal(await login.getByRole('button', { name: '로그인', exact: true }).isEnabled(), true);
    assert(await login.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    console.log('PASS shared components: seven hosts, desktop/mobile, tokens, tabs/stats, focus, busy geometry, real login failure and duplicate submission');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
