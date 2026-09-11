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
    const counts = await page.evaluate(async () => {
      const p = await import('./src/components/primitives.js'), l = await import('./src/components/layouts.js');
      const fixture = p.element('section'); fixture.id = 'layout-audit'; document.querySelector('main').append(fixture);
      const long = '매우 긴 한글 리소스 이름과 설명 '.repeat(12);
      fixture.append(l.stack(p.sectionHeader(long,p.button({label:'작업'})),l.divider(),l.grid(p.element('p','',long),p.element('p','',long),p.element('p','',long))));
      const group = document.querySelector('#navigation-example [role=group]');
      const controls = document.querySelectorAll('#primitive-example .af-input');
      return {group:group.getAttribute('aria-label'),controls:controls.length,sections:document.querySelectorAll('.af-section-header').length};
    });
    assert.ok(counts.group); assert.equal(counts.controls,4); assert.ok(counts.sections);
    const sidebarBinding = await page.evaluate(async () => {
      const {bindSidebarHost} = await import('./src/components/sidebar-host.js');
      const host = document.createElement('aside');
      const header = document.createElement('header'), title = document.createElement('span');
      const body = document.createElement('div'); header.append(title); host.append(header,body);
      const first = document.createElement('div'), second = document.createElement('div');
      first.innerHTML = '<section class="app-sidebar__section"><nav class="app-sidebar__nav"><button class="app-sidebar__row">조직</button></nav></section>';
      second.hidden = true; body.append(first,second); document.body.append(host);
      const sidebar = bindSidebarHost(host,{header,body,title,defaultTitle:'기본',items:[
        {id:'organization',title:'조직',element:first},
        {id:'workspace',title:'작업공간',element:second},
      ]});
      sidebar.select('workspace');
      const bound = sidebar.selected === 'workspace' && title.textContent === '작업공간'
        && first.hidden && !second.hidden && host.matches('.af-kit.af-sidebar-host')
        && host.querySelectorAll('.af-sidebar-view').length === 2
        && host.querySelectorAll('.af-sidebar-section,.af-sidebar-navigation,.af-sidebar-navigation__item').length === 3
        && host.querySelectorAll('.af-sidebar-navigation__marker').length === 1;
      const dynamic = document.createElement('p'); dynamic.className = 'app-sidebar__state'; second.append(dynamic);
      await new Promise(resolve=>queueMicrotask(resolve));
      const adopted = dynamic.matches('.af-sidebar-state');
      sidebar.select(null);
      const cleared = title.textContent === '기본' && first.hidden && second.hidden;
      sidebar.destroy();
      const destroyed = !host.matches('.af-kit,.af-sidebar-host') && !first.matches('.af-sidebar-view')
        && !host.querySelector('.af-sidebar-navigation__marker');
      host.remove();
      return bound && adopted && cleared && destroyed;
    });
    assert.equal(sidebarBinding,true);
    for (const width of [1280,768,390]) {
      await page.setViewportSize({width,height:900});
      const geometry = await page.evaluate(() => {
        const rect = selector => document.querySelector(selector).getBoundingClientRect();
        const button = rect('#primitive-example button');
        const input = rect('#primitive-example input.af-input');
        const columns = getComputedStyle(document.querySelector('.af-grid')).gridTemplateColumns.split(' ').length;
        const overflow = document.documentElement.scrollWidth > innerWidth;
        return {buttonHeight:button.height,inputHeight:input.height,columns,overflow};
      });
      assert.equal(geometry.overflow,false);
      assert.equal(geometry.buttonHeight,30);
      assert.equal(geometry.inputHeight,30);
      assert.equal(geometry.columns,width <= 700 ? 1 : 3);
    }
    const tooltipDisposal = await page.evaluate(async () => {
      const {tooltip} = await import('./src/components/web-components.js');
      const {explorerTree} = await import('./src/components/explorer-tree.js');
      const {button} = await import('./src/components/primitives.js');
      const trigger = button({label:'툴팁 제거 검증'}); document.body.append(trigger);
      const tip = tooltip(trigger,'도움말');
      await tip.root.updateComplete;
      let renderedRows = 0, toggled = '';
      const hierarchy = explorerTree({
        label:'리소스 탐색',
        items:[
          {id:'organization',label:'조직',expanded:true,selectable:false,children:[{id:'workspace',label:'작업공간'}]},
          {id:'schedule',label:'일정',expanded:true,toggleOnClick:false,children:[{id:'task',label:'작업'}]},
        ],
        multiSelect:false,
        onToggle:(id,expanded)=>{toggled=`${id}:${expanded}`;},
        onRender:rows=>{renderedRows=rows.length;},
        renderIcon:()=>null,
      });
      document.body.append(hierarchy.root);
      const genericTree = hierarchy.root.getAttribute('role') === 'tree'
        && hierarchy.root.getAttribute('aria-multiselectable') === 'false'
        && !hierarchy.root.querySelector('[data-key="organization"]').hasAttribute('aria-selected')
        && hierarchy.root.querySelectorAll('.af-explorer-icon-slot:empty').length === 4;
      hierarchy.root.querySelector('[data-key="schedule"] > .af-explorer-line .af-explorer-name').click();
      const separatedToggle = hierarchy.root.querySelector('[data-key="schedule"]').getAttribute('aria-expanded') === 'true';
      hierarchy.root.querySelector('[data-key="organization"] > .af-explorer-line').click();
      const integrationHooks = renderedRows === 3 && toggled === 'organization:false';
      tip.destroy();
      const restored = !trigger.id;
      hierarchy.destroy(); trigger.remove();
      return restored && genericTree && separatedToggle && integrationHooks;
    });
    assert.equal(tooltipDisposal,true);
    const additional = await page.evaluate(async () => {
      const {button} = await import('./src/components/primitives.js');
      const {createSplitPane} = await import('./src/components/components.js');
      const busy = button({label:'저장'}); busy.setBusy(true);
      const busyState = busy.disabled && busy.getAttribute('aria-busy') === 'true';
      busy.setBusy(false);
      const restored = !busy.disabled && busy.textContent === '저장';
      const root = document.createElement('div');
      root.style.cssText = 'width:300px;height:300px';
      root.innerHTML = '<div data-af-panel>상단</div><div data-af-resizer></div><div data-af-panel>하단</div>';
      document.body.append(root);
      const pane = createSplitPane(root,{id:'vertical-audit',orientation:'vertical'});
      await new Promise(resolve => setTimeout(resolve,50));
      pane.setSizes([40,60]);
      await new Promise(resolve => setTimeout(resolve,50));
      const resized = Number(root.querySelector('[role=separator]').getAttribute('aria-valuenow')) === 40;
      pane.destroy(); root.remove();
      return {busyState,restored,resized};
    });
    assert.deepEqual(additional,{busyState:true,restored:true,resized:true});
    assert.deepEqual(errors,[]);
    console.log('PASS: layout primitives, shared sidebar host, responsive grid, explorer tree, tooltip disposal');
  } finally {await browser.close();}
})().catch(error => {console.error(error);process.exitCode=1;});
