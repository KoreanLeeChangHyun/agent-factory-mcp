// NODE_PATH=/tmp/af-pw/node_modules node tests/knowledge/browser/cloud-document-delivery.cjs
// PYTHON selects the application's environment; no live database/provider required.
const { chromium } = require('playwright');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const fixtureResult = spawnSync(process.env.PYTHON || path.join(root, '.venv/bin/python'),
  ['tests/knowledge/browser/cloud-document-delivery.fixture.py'], { cwd: root, encoding: 'utf8', env: {...process.env, PYTHONPATH: root} });
assert.equal(fixtureResult.status, 0, fixtureResult.stderr);
const fixture = JSON.parse(fixtureResult.stdout);
const csp = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; object-src 'none'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
const server = http.createServer(async (req, res) => {
  if (req.url.endsWith('/package/preview')) {res.writeHead(200, {'Content-Type':'text/html', ...fixture.headers});return res.end(fixture.html);}
  if (req.url.endsWith('/package')) {res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(fixture.manifest));}
  if (req.url.endsWith('/content')) {res.setHeader('Content-Type','application/zip');return res.end('fixture ZIP response; package parser tested separately');}
  res.setHeader('Content-Security-Policy', csp);
  if (req.url === '/editor.js') {res.setHeader('Content-Type','text/javascript');return res.end(await fs.readFile(path.join(root,'static/js/document-editor.js')));}
  if (req.url === '/harness.js') {res.setHeader('Content-Type','text/javascript');return res.end(`localStorage.setItem('secret','parent-secret');document.cookie='secret=parent-cookie';
const editor=Object.create(AgentFactoryDocumentEditor.prototype);editor.rootPath='';
window.testTab={panel:document.querySelector('main'),doc:{title:'명세 문서',href:'/api/organizations/org/workspaces/ws/documents/doc/revisions/1/content'},controller:new AbortController(),urls:[]};
editor.loadContent(testTab);window.editor=editor;`);}
  res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="ko"><title>Workspace</title><main></main><script src="/editor.js"></script><script src="/harness.js"></script></html>');
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({channel:'chromium', headless:true, args:['--no-sandbox']});
  try {
    const page = await browser.newPage(); page.setDefaultTimeout(10000);
    const networkEscapes=[], externalAttempts=new Map(), policyFailures=new Map();
    const policyMessages=[], scriptFailures=[], initializationErrors=[];
    const url=`http://127.0.0.1:${server.address().port}/`;
    const fixtureOrigin=new URL(url).origin;
    const isExternal = value => {
      const target=new URL(value);
      return ['http:', 'https:'].includes(target.protocol) && target.origin !== fixtureOrigin;
    };
    // A request event can precede browser-policy rejection. Interception marks
    // the network boundary; abort every external escape before it leaves the test.
    await page.route('**/*', route => {
      if (isExternal(route.request().url())) {
        networkEscapes.push(route.request().url());
        return route.abort('blockedbyclient');
      }
      return route.continue();
    });
    page.on('console', message => {
      const value = message.text();
      if (value.includes('https://blocked.invalid') && /content security policy/i.test(value)) policyMessages.push(value);
      if (message.type() === 'error' && /Not allowed to load local resource|Refused to load the script|Loading the script .*violates/i.test(value)) scriptFailures.push(value.slice(0, 500));
    });
    page.on('pageerror', error => initializationErrors.push(error.message));
    page.on('requestfailed', request => {
      if (isExternal(request.url())) policyFailures.set(request, request.failure()?.errorText);
      if (request.resourceType() === 'script') scriptFailures.push(`${request.url().slice(0, 100)}: ${request.failure()?.errorText}`);
    });
    page.on('request', request => {if(isExternal(request.url())) externalAttempts.set(request, request.url());});
    await page.goto(url);
    const outer=page.frameLocator('.de-package-preview'), human=outer.frameLocator('iframe');
    const waitForInitialization = async () => {
      try { await human.locator('html[data-package-initialized="ready"]').waitFor({state:'attached'}); }
      catch (error) { throw new Error(`Package scripts did not initialize: ${JSON.stringify({scriptFailures, initializationErrors})}`, {cause:error}); }
      assert.deepEqual(scriptFailures, [], 'Validated local scripts must load in the opaque child');
      assert.deepEqual(initializationErrors, [], 'Package initialization must not throw');
      const state = await human.locator('html').evaluate(() => ({
        order: globalThis.packageOrder, beforeBody: globalThis.packageBeforeBody,
        handler: typeof document.querySelector('#details').onclick,
        sources: [...document.querySelectorAll('script[src]')].map(el => ({src:el.src.slice(0, 33), defer:el.defer})),
      }));
      assert.deepEqual(state.order, ['blocking', 'dependency', 'app', 'DOMContentLoaded']);
      assert.equal(state.beforeBody, true, 'Blocking script must retain parser ordering');
      assert.equal(state.handler, 'function');
      assert.deepEqual(state.sources.map(script => script.defer), [false, true, true]);
      assert.ok(state.sources.every(script => script.src.startsWith('data:text/javascript;base64,')));
    };
    await waitForInitialization();
    await human.locator('h1').waitFor();
    assert.equal(await human.locator('h1').innerText(),'문서 전달 명세');
    assert.equal(await human.locator('h1').evaluate(el=>getComputedStyle(el).color),'rgb(12, 34, 56)');
    assert.equal(await human.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(240, 241, 242)');
    await human.locator('#logo').evaluate(img=>img.decode());
    await human.locator('#details').click();
    assert.equal(await human.locator('#flow').isVisible(),true);
    assert.equal(await human.locator('#diagram rect').count(),2);
    await human.locator('#attacks').click();
    await human.locator('#security').filter({hasText:'fetch'}).waitFor();
    assert.equal(await human.locator('#security').innerText(),'cookie,fetch,parent,storage,top');
    await human.locator('#next').click();
    await human.locator('h1').filter({hasText:'다음 문서 내용'}).waitFor();
    await human.locator('a').click();
    await waitForInitialization();
    await human.locator('#navigate').click();
    await page.waitForTimeout(300);
    assert.deepEqual(networkEscapes, [], 'No external request may reach interception, including child self-navigation');
    assert.ok([...policyFailures].some(([request, failure]) =>
      request.url() === 'https://blocked.invalid/image' && failure === 'csp'),
      'The image probe must fail specifically because of CSP, not DNS or interception');
    for (const [request, attemptedURL] of externalAttempts) {
      assert.equal(policyFailures.get(request), 'csp', `External attempt must be rejected by CSP: ${attemptedURL}`);
    }
    // Chromium may reject fetch/frame navigation before emitting a request event.
    // Require their policy diagnostics as well as the fixture's rejected-fetch flag.
    for (const directive of ['connect-src', 'img-src', 'frame-src']) {
      assert.ok(policyMessages.some(message => message.includes(directive)),
        `Expected CSP rejection for the ${directive} probe: ${JSON.stringify(policyMessages)}`);
    }
    assert.equal(page.url(), url);
    assert.equal(await page.evaluate(()=>localStorage.getItem('secret')), 'parent-secret');
    assert.equal(await page.locator('.de-package-preview').getAttribute('sandbox'),'allow-scripts');
    await page.evaluate(()=>editor.disposeTab(testTab));
    assert.equal(await page.locator('.de-package-preview').count(),0);
    console.log('Cloud package readability, relative resources, tabs, diagrams and isolation assertions completed');
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
