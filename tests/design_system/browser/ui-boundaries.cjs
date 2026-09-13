const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try {
  const page=await browser.newPage();
  await page.setContent('<main></main>');
  await page.addScriptTag({path:path.resolve(__dirname,'../../../static/ui/core.js')});
  const selections=await page.evaluate(()=>{
    const original=new Set(['a']);
    const pick=options=>{const result=agentFactoryUI.selectKeys({keys:['a','b','c'],selected:original,anchor:'a',...options});return {selected:[...result.selected],anchor:result.anchor};};
    return {single:pick({key:'b'}),range:pick({key:'c',range:true}),reverse:pick({key:'a',anchor:'c',range:true}),
      toggle:pick({key:'a',toggle:true}),hiddenAnchor:pick({keys:['b','c'],key:'c',range:true}),
      unknown:pick({key:'missing'}),original:[...original]};
  });
  assert.deepEqual(selections,{single:{selected:['b'],anchor:'b'},range:{selected:['a','b','c'],anchor:'a'},
    reverse:{selected:['a','b','c'],anchor:'c'},toggle:{selected:[],anchor:'a'},
    hiddenAnchor:{selected:['c'],anchor:'c'},unknown:{selected:['a'],anchor:'a'},original:['a']});
  const dialogResult=await page.evaluate(()=>{
    const opener=document.createElement('button');opener.textContent='편집';
    const root=document.createElement('dialog');root.setAttribute('aria-label','공통 편집');
    const input=document.createElement('input');input.name='name';input.value='유지할 입력';root.append(input);
    document.body.append(opener,root);opener.focus();
    const dialog=agentFactoryUI.bindNativeDialog(root);dialog.open({initialFocus:input});
    const opened=root.open && document.activeElement===input && root.matches(':modal');
    dialog.close();const restored=document.activeElement===opener;
    dialog.open();dialog.destroy();let rejected=false;try{dialog.open();}catch{rejected=true;}
    const result={opened,restored,closed:!root.open,rejected,same:root.firstElementChild===input,value:input.value};
    root.remove();opener.remove();return result;
  });
  assert.deepEqual(dialogResult,{opened:true,restored:true,closed:true,rejected:true,same:true,value:'유지할 입력'});
  await page.evaluate(()=>{
    const handle=document.createElement('div');handle.id='pixel-resize';handle.tabIndex=0;
    handle.style.cssText='width:10px;height:100px;touch-action:none';document.body.append(handle);
    window.pixelState={value:200,dragging:false,changes:0};
    window.pixelResize=agentFactoryUI.bindResizeHandle(handle,{
      getValue:()=>pixelState.value,
      onChange:value=>{pixelState.value=Math.max(180,Math.min(520,value));pixelState.changes++;},
      onDragging:dragging=>{pixelState.dragging=dragging;},step:16,
    });
  });
  const pixel=page.locator('#pixel-resize');
  await pixel.focus();await pixel.press('ArrowRight');
  assert.equal(await page.evaluate(()=>pixelState.value),216);
  const pixelBox=await pixel.boundingBox();
  await page.mouse.move(pixelBox.x+3,pixelBox.y+20);await page.mouse.down();
  await page.mouse.move(pixelBox.x+53,pixelBox.y+20);await page.mouse.up();
  assert.equal(await page.evaluate(()=>pixelState.value),266);
  assert.equal(await page.evaluate(()=>pixelState.dragging),false);
  await page.mouse.move(pixelBox.x+3,pixelBox.y+20);await page.mouse.down();
  await page.evaluate(()=>pixelResize.destroy());
  const disposedPixel=await page.evaluate(()=>({...pixelState}));
  await page.mouse.move(pixelBox.x+70,pixelBox.y+20);await page.mouse.up();await pixel.press('ArrowLeft');
  assert.deepEqual(await page.evaluate(()=>pixelState),disposedPixel);
  assert.equal(disposedPixel.dragging,false);
  assert.equal(await pixel.getAttribute('class'),'');
  await pixel.evaluate(el=>el.remove());
  await page.evaluate(()=>{
    const root=document.createElement('div');root.id='native-tree-boundary';document.body.append(root);
    const rows=[{key:'folder',folder:true},{key:'child',parentKey:'folder'},{key:'empty',folder:true},{key:'sibling'}];
    rows.forEach(row=>{row.element=document.createElement('div');row.element.tabIndex=0;row.element.textContent=row.key;row.element.dataset.key=row.key;root.append(row.element);});
    window.treeEvents=[];
    window.treeBinding=agentFactoryUI.bindTreeKeyboard(root,{
      items:()=>rows,isExpanded:()=>true,onToggle:row=>treeEvents.push(['toggle',row.key]),
      onActivate:(row,event)=>treeEvents.push(['open',row.key,event.ctrlKey]),
      onToggleSelection:row=>treeEvents.push(['select',row.key]),onSelectAll:()=>treeEvents.push(['all']),
      onContextMenu:row=>treeEvents.push(['menu',row.key]),onMove:(row,event)=>treeEvents.push(['move',row.key,event.shiftKey]),
    });
  });
  const treeItem=key=>page.locator(`#native-tree-boundary [data-key="${key}"]`);
  await treeItem('folder').focus();await treeItem('folder').press('ArrowRight');
  assert(await treeItem('child').evaluate(el=>el===document.activeElement));
  await treeItem('child').press('ArrowLeft');assert(await treeItem('folder').evaluate(el=>el===document.activeElement));
  await treeItem('empty').focus();await treeItem('empty').press('ArrowRight');
  assert(await treeItem('empty').evaluate(el=>el===document.activeElement),'Empty expanded folder must not jump to a sibling');
  await treeItem('child').press('Control+Enter');await treeItem('child').press('Space');await treeItem('child').press('Control+a');
  const treeEvents=await page.evaluate(()=>window.treeEvents);
  assert(treeEvents.some(event=>event[0]==='open'&&event[1]==='child'&&event[2]===true));
  assert(treeEvents.some(event=>event[0]==='select'&&event[1]==='child'));
  assert(treeEvents.some(event=>event[0]==='all'));
  await page.evaluate(()=>treeBinding.destroy());
  await treeItem('child').press('ArrowDown');assert(await treeItem('child').evaluate(el=>el===document.activeElement));
  assert.deepEqual(await page.evaluate(()=>window.treeEvents),treeEvents);
  await page.locator('#native-tree-boundary').evaluate(el=>el.remove());
  const renderedTree=await page.evaluate(()=>{
    const root=document.createElement('div');document.body.append(root);
    let expanded=true;const clicks=[];
    const entries=[{key:'folder',folder:true,children:[{key:'child',name:'<script>safe</script>'}]},{key:'last',name:'마지막'}];
    const options={entries,childrenOf:row=>row.children||[],isExpanded:()=>expanded,
      renderRow:row=>{const el=document.createElement('div');el.textContent=row.name||row.key;el.addEventListener('click',()=>clicks.push(row.key));return el;}};
    let rows=agentFactoryUI.renderNativeTree(root,options);
    const levels=rows.map(row=>row.element.getAttribute('aria-level'));
    rows[1].element.focus();rows[1].element.click();
    rows=agentFactoryUI.renderNativeTree(root,options);
    const focused=document.activeElement.dataset.key;
    const tabStops=rows.filter(row=>row.element.tabIndex===0).length;
    const oldFirst=root.firstElementChild;let rejected=false;
    try{agentFactoryUI.renderNativeTree(root,{...options,entries:[entries[0],entries[0]]});}catch{rejected=true;}
    const preserved=oldFirst===root.firstElementChild;
    const unsafe=root.querySelectorAll('script').length;
    expanded=false;rows=agentFactoryUI.renderNativeTree(root,options);
    const result={levels,clicks,focused,tabStops,rejected,preserved,unsafe,collapsedRows:rows.length,expanded:rows[0].element.getAttribute('aria-expanded')};
    root.remove();return result;
  });
  assert.deepEqual(renderedTree,{levels:['1','2','1'],clicks:['child'],focused:'child',tabStops:1,rejected:true,preserved:true,unsafe:0,collapsedRows:2,expanded:'false'});
  const codeResult=await page.evaluate(()=>{
    const root=document.createElement('section');
    root.innerHTML='<header><label>설정</label><button type="button">복사</button></header><textarea id="boundary-code" readonly aria-describedby="existing-help"></textarea><p id="existing-help">기존 설명</p><p data-help>코드 도움말</p>';
    document.body.append(root);
    const control=root.querySelector('textarea'), button=root.querySelector('button');
    control.value='<private-value>';let clicks=0;button.addEventListener('click',()=>clicks++);
    const options={root,header:root.querySelector('header'),label:root.querySelector('label'),control,help:root.querySelector('[data-help]')};
    const adopted=agentFactoryUI.bindCodeOperation(options);agentFactoryUI.bindCodeOperation(options);button.click();
    const result={same:adopted.control===control,value:control.value,readOnly:control.readOnly,clicks,
      descriptions:control.getAttribute('aria-describedby'),label:control.labels[0].textContent,
      leaked:root.innerHTML.includes('<private-value>')};
    root.remove();return result;
  });
  assert.deepEqual(codeResult,{same:true,value:'<private-value>',readOnly:true,clicks:1,descriptions:'existing-help boundary-code-help',label:'설정',leaked:false});
  const result=await page.evaluate(()=>{
   let changes=0;
   const tabs=agentFactoryUI.tabs({label:'경계 상태',items:[{id:'a',label:'첫째',disabled:true},{id:'b',label:'둘째',disabled:true}],onChange:()=>changes++});
   document.querySelector('main').append(tabs.root);
   const allDisabled={visible:tabs.root.querySelectorAll('[role="tabpanel"]:not([hidden])').length,
     selected:tabs.selected??null,tabStops:[...tabs.root.querySelectorAll('[role="tab"]')].map(el=>el.tabIndex),changes};
   const second=tabs.root.querySelectorAll('button')[1];second.disabled=false;tabs.select(1);
   const enabled={selected:tabs.selected,changes};
   tabs.destroy();const first=tabs.root.querySelector('button');first.disabled=false;first.click();tabs.select(0);
   return {allDisabled,enabled,disposed:{selected:tabs.selected,changes}};
  });
  assert.deepEqual(result,{allDisabled:{visible:0,selected:null,tabStops:[-1,-1],changes:0},enabled:{selected:'b',changes:1},disposed:{selected:'b',changes:1}});
  await page.addScriptTag({path:path.resolve(__dirname,'../../../static/ui/splitter.js')});
  const splitResult=await page.evaluate(async()=>{
    const make=()=>{const root=document.createElement('div');root.style.cssText='width:500px;height:200px';root.innerHTML='<div data-af-panel></div><div data-af-resizer></div><div data-af-panel></div>';return root;};
    const root=make(), child=make();child.style.width='100%';root.firstElementChild.style.minWidth='0';root.firstElementChild.append(child);document.body.append(root);
    const outer=agentFactorySplitter.createSplitPane(root,{id:'outer',size:[50,50]});
    const inner=agentFactorySplitter.createSplitPane(child,{id:'inner',size:[35,65]});
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    outer.setSizes([25,75]);inner.setSizes([60,40]);
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const outerValue=root.querySelector(':scope > [data-af-resizer]').getAttribute('aria-valuenow');
    const innerValue=child.querySelector(':scope > [data-af-resizer]').getAttribute('aria-valuenow');
    const ids=[...root.querySelectorAll('[id]')].map(el=>el.id);
    inner.destroy();outer.destroy();root.remove();
    return {outerValue,innerValue,unique:new Set(ids).size===ids.length};
  });
  assert.deepEqual(splitResult,{outerValue:'25',innerValue:'60',unique:true});
  await page.evaluate(()=>{
    const root=document.createElement('div');root.dataset.lifecycleSplit='';root.style.cssText='width:500px;height:200px';
    root.innerHTML='<div data-af-panel></div><div data-af-resizer style="width:5px"></div><div data-af-panel></div>';
    document.body.append(root);
    window.lifecycleSplit=agentFactorySplitter.createSplitPane(root,{id:'lifecycle'});
  });
  const handle=page.locator('[data-lifecycle-split] > [data-af-resizer]');
  const box=await handle.boundingBox();
  await page.mouse.move(box.x+2,box.y+20);await page.mouse.down();
  await page.mouse.move(box.x+30,box.y+20);
  assert.equal(await page.locator('html').getAttribute('data-af-split-cursor'),'horizontal');
  await page.evaluate(()=>{window.lifecycleSplit.destroy();document.querySelector('[data-lifecycle-split]').remove();});
  assert.equal(await page.locator('html').getAttribute('data-af-split-cursor'),null,'Destroy during drag clears global cursor');
  await page.mouse.up();
  console.log('PASS shared boundaries: disabled tabs, destroyed callbacks, nested split ratios/IDs, split disposal during drag');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
