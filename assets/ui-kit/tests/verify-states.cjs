const assert = require('node:assert/strict');
const {chromium} = require('playwright');
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror',error => errors.push(error.message));
    await page.goto('http://127.0.0.1:8765/assets/ui-kit/');
    await page.waitForFunction(() => !!window.afCatalog);
    const state = await page.evaluate(async () => {
      const {createCombobox} = await import('./src/components/components.js');
      const multi = document.querySelector('#team-choice').tomselect;
      multi.addItem('design'); multi.addItem('frontend');
      const values = [...multi.getValue()];
      multi.removeItem('design');
      const remaining = multi.getValue();
      const host = document.createElement('div');
      host.innerHTML = '<label for="race-select">경합 예제</label><select id="race-select"></select>';
      document.body.append(host);
      const signals = [];
      const enhanced = createCombobox(host.querySelector('select'),{loadThrottle:0,load:async (query,{signal}) => {
        signals.push(signal);
        await new Promise(resolve => setTimeout(resolve,query === 'old' ? 100 : 10));
        return [{value:query,text:query}];
      }});
      enhanced.control.load('old'); enhanced.control.load('new');
      await new Promise(resolve => setTimeout(resolve,160));
      const oldLoaded = Object.hasOwn(enhanced.control.options,'old');
      const newLoaded = Object.hasOwn(enhanced.control.options,'new');
      enhanced.setDisabled(true);
      const disabled = enhanced.control.isDisabled;
      enhanced.setInvalid(true);
      const invalid = enhanced.control.control_input.getAttribute('aria-invalid');
      enhanced.destroy();
      const removed = !host.querySelector('.ts-wrapper');
      host.remove();
      return {values,remaining,oldLoaded,newLoaded,aborted:signals[0].aborted,disabled,invalid,removed};
    });
    assert.deepEqual(state.values,['design','frontend']);
    assert.deepEqual(state.remaining,['frontend']);
    assert.equal(state.oldLoaded,false); assert.equal(state.newLoaded,true);
    assert.equal(state.aborted,true); assert.equal(state.disabled,true);
    assert.equal(state.invalid,'true'); assert.equal(state.removed,true);
    const sash = page.locator('[data-scope="splitter"][data-part="resize-trigger"]');
    await sash.focus(); await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);
    assert.ok(Number(await sash.getAttribute('aria-valuenow')) > 35);
    await page.keyboard.press('Home'); await page.waitForTimeout(100);
    assert.equal(Number(await sash.getAttribute('aria-valuenow')),10);
    const time = await page.locator('relative-time').evaluate(async node => {
      await customElements.whenDefined('relative-time'); await new Promise(resolve => setTimeout(resolve,30));
      return {datetime:node.getAttribute('datetime'),text:node.shadowRoot?.textContent};
    });
    assert.ok(time.text?.trim()); assert.equal(time.datetime,'2026-09-08T15:00:00Z');
    assert.ok(await page.locator('time[datetime="2026-09-08T15:00:00Z"]').count());
    const controls = await page.locator('#primitive-example').evaluate(root => ({
      invalid:root.querySelector('[aria-invalid=true]')?.getAttribute('aria-describedby'),
      disabled:root.querySelector('input:disabled')?.disabled,
      statuses:[...root.querySelectorAll('.af-status')].map(node => ({kind:node.dataset.kind,text:node.textContent,role:node.getAttribute('role')})),
      skeleton:root.querySelector('.af-skeleton')?.getAttribute('aria-label'),
    }));
    assert.ok(controls.invalid); assert.equal(controls.disabled,true); assert.ok(controls.skeleton);
    assert.equal(controls.statuses.length,6);
    for (const item of controls.statuses) assert.ok(item.text && item.role);
    for (const width of [1280,768,390]) {
      await page.setViewportSize({width,height:900});
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: multiple select, async race/abort/disabled/error/disposal, split keyboard, time pair, field/status/skeleton semantics, responsive layouts');
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
