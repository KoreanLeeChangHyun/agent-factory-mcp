// NODE_PATH=/tmp/af-pw/node_modules node tests/browser/planning.cjs
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const http=require('node:http');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const server=http.createServer(async(req,res)=>{
  let file=req.url.replace(/^\/factory/,'');
  if(file==='/workspace/')file='/template/workspace/index.html';
  if(!file.startsWith('/static/')&&!file.startsWith('/template/'))return res.writeHead(404).end();
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; object-src 'none'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  try {const data=await fs.readFile(path.join(root,file));res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml'})[path.extname(file)]||'text/plain');res.end(data);}catch{res.writeHead(404).end();}
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const chooseWorkspace = async id => {
    await page.locator('[data-workspace-picker-toggle]').click();
    await page.locator('[data-workspace-list] [data-workspace-id="' + id + '"]').click();
  };
  let importApplied=false;
  const importPreview={id:'import-one',preview_digest:'a'.repeat(64),status:'preview',source:{label:'가져온 일정 <script>',read_scope:'개발 A1:F20',location:'local.xlsx'},can_apply:true,errors:[],warnings:['날짜 미정'],operations:[{id:'import-task',source_id:'row-1',kind:'domain',parent_id:null,action:'create',before:null,after:{name:'가져온 작업',description:'<img src=x onerror=alert(1)>'},source_location:'개발!A2',original_values:{이름:'원본 작업'},corrections:[{field:'name',original:'원본 작업',reason:'이름 정리'}],questions:[]}]};
  let items=[],settings={launch_date:null,revision:0},fail=false,readOnly=false,serial=0,mutations=0;
  const workspaces=[{id:'one',organization_id:'org',name:'계획 검증',status:'active'},{id:'two',organization_id:'org',name:'다른 공간',status:'active'}];
  const base=`http://127.0.0.1:${server.address().port}`;
  await context.addCookies([{name:'agent_factory_csrf',value:'csrf',url:base}]);
  await page.route('**/api/**',async route=>{
    const req=route.request(),url=new URL(req.url()),p=url.pathname.replace('/factory','');
    const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    if(p==='/api/auth/me')return reply({user:{id:'user',display_name:'테스터',email:'test@example.test',is_platform_admin:false}});
    if(p==='/api/account/organizations')return reply([{id:'org',name:'테스트',is_personal:true}]);
    if(p.endsWith('/workspaces'))return reply(workspaces);
    if(p.endsWith('/recent')||p.endsWith('/documents'))return reply([]);
    if(p.endsWith('/visits'))return route.fulfill({status:204});
    if(p.endsWith('/mcp-connections'))return reply({state:'verified',connections:[]});
    if(p.includes('/plan/imports')) {
      if(p.endsWith('/apply')) {assert.equal(req.postDataJSON().preview_digest,importPreview.preview_digest);assert.equal(req.postDataJSON().acknowledge_warnings,true);assert.equal(req.headers()['x-csrf-token'],'csrf');importApplied=true;return reply({...importPreview,status:'applied'});}
      if(p.endsWith('/imports'))return reply([{...importPreview,status:importApplied?'applied':'preview'}]);
      return reply({...importPreview,status:importApplied?'applied':'preview'});
    }
    if(p.includes('/plan')) {
      if(req.method()==='GET') {
        if(fail)return reply({error:{message:'테스트 연결 실패'}},503);
        return reply({items:p.includes('/two/')?[]:items.map(r=>{
          if(r.kind!=='domain')return r;
          const child=items.filter(c=>c.parent_id===r.id);
          const starts=child.map(c=>c.start_date).filter(Boolean).sort(),ends=child.map(c=>c.target_date).filter(Boolean).sort();
          const start=r.start_date||starts[0]||null,end=r.target_date||ends.at(-1)||null;
          return {...r,configured_start_date:r.start_date,configured_target_date:r.target_date,start_date:start,target_date:end,start_date_source:r.start_date?'explicit':start?'derived':'unspecified',target_date_source:r.target_date?'explicit':end?'derived':'unspecified',period_conflict:!!(start&&end&&start>end)};
        }),settings,can_edit:!readOnly});
      }
      assert.equal(req.headers()['x-csrf-token'],'csrf');mutations++;
      const body=req.method()==='DELETE'?null:req.postDataJSON();
      if(p.endsWith('/settings')){settings={...body,revision:body.revision+1};return reply(settings);}
      if(req.method()==='POST'){const row={id:`item-${++serial}`,workspace_id:'one',description:'',acceptance:'',assignee:'',blocked_reason:'',start_date:null,target_date:null,status:'pending',revision:1,...body};items.push(row);return reply(row,201);}
      const id=p.split('/').at(-1),row=items.find(r=>r.id===id);
      if(req.method()==='DELETE'){if(items.some(r=>r.parent_id===id))return reply({error:{message:'하위 항목을 먼저 삭제하세요.'}},409);items=items.filter(r=>r.id!==id);return route.fulfill({status:204});}
      if(body.revision!==row.revision)return reply({error:{message:'항목이 변경되었습니다.'}},409);
      Object.assign(row,body,{revision:row.revision+1});return reply(row);
    }
    return reply({});
  });
  const panel=page.locator('.planning-panel');
  const nav=page.locator('.planning-sidebar');
  async function create(kind,name,fields={}) {
    await page.getByRole('button',{name:`${kind} 추가`,exact:true}).click();
    const dialog=page.locator('.plan-dialog');await dialog.getByLabel('작업 이름',{exact:true}).fill(name);
    for(const [label,value] of Object.entries(fields))await dialog.getByLabel(label,{exact:true}).fill(value);
    await dialog.getByRole('button',{name:'추가',exact:true}).click();
    await dialog.waitFor({state:'hidden'});await panel.getByRole('status').filter({hasText:'저장했습니다.'}).waitFor();
  }
  try {
    await page.goto(base+'/factory/workspace/');
    await page.locator('[data-workspace-list]').getByRole('button',{name:'계획 검증'}).click();
    await page.locator('[data-activity="schedule"]').click();
    await panel.getByText('하위 작업에 목표 기간을 입력하면 전체 일정이 표시됩니다.').waitFor();
    await panel.getByRole('button',{name:'가져오기',exact:true}).click();
    await panel.getByRole('button',{name:'가져온 일정 <script>',exact:true}).click();
    await panel.getByText('원본 작업',{exact:false}).first().waitFor();
    assert.equal(await panel.locator('script,img').count(),0);
    await panel.getByRole('button',{name:'일정에 반영',exact:true}).click();
    assert.equal(importApplied,false);
    await panel.getByRole('checkbox').check();
    await panel.getByRole('button',{name:'일정에 반영',exact:true}).click();
    await panel.getByText('반영 완료',{exact:true}).waitFor();
    assert.equal(importApplied,true);
    await panel.getByRole('button',{name:'전체 일정',exact:true}).click();
    assert.equal(await page.locator('.primary-sidebar__header').getByRole('button',{name:'작업 추가',exact:true}).count(),1);
    assert.equal(await nav.getByRole('button',{name:'새로고침',exact:true}).count(),0);
    await create('작업','결제',{'시작일':'2025-12-01','목표일':'2027-12-31'});
    await panel.locator('.plan-origin').filter({hasText:'직접 지정'}).waitFor();
    assert.equal(await panel.locator('.plan-summary-bar').count(),1);
    assert.equal(await panel.locator('.plan-time-track').getByText('기간 미정',{exact:true}).count(),0);
    const ticks=await panel.locator('.plan-time-header > div > span').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right};}));
    assert(ticks.length>2);
    for(let i=1;i<ticks.length;i++)assert(ticks[i].left>=ticks[i-1].right,'Date ticks must not overlap under CSP');
    const headerGeometry=await panel.evaluate(el=>{const caption=el.querySelector('.plan-marker-caption').getBoundingClientRect();const group=el.querySelector('.plan-time-group').getBoundingClientRect();return {captionBottom:caption.bottom,groupTop:group.top,chartWidth:getComputedStyle(el.querySelector('.plan-timeline')).getPropertyValue('--plan-chart-width')};});
    assert(headerGeometry.captionBottom<=headerGeometry.groupTop);
    assert.equal(headerGeometry.chartWidth,'784px');

    await nav.getByRole('button',{name:'결제',exact:true}).click();
    await create('하위 작업','카드 결제',{'시작일':'2026-01-01','목표일':'2027-03-01','완료 조건':'카드 승인 성공'});
    await panel.getByRole('button',{name:'수정',exact:true}).click();
    const rootEditor=page.locator('.plan-dialog');
    assert.equal(await rootEditor.getByLabel('시작일',{exact:true}).inputValue(),'2025-12-01');
    assert.equal(await rootEditor.locator('input[required]').count(),1);
    assert.equal(await rootEditor.locator('label').filter({hasText:'작업 이름'}).innerText(),'작업 이름 *');
    assert.equal(await rootEditor.getByText('(선택)',{exact:false}).count(),0);
    await rootEditor.getByLabel('시작일',{exact:true}).fill('2026-02-01');
    await rootEditor.getByLabel('목표일',{exact:true}).fill('');
    await rootEditor.getByRole('button',{name:'저장',exact:true}).click();
    await rootEditor.waitFor({state:'hidden'});
    await panel.getByText('시작일: 직접 지정 · 목표일: 하위 작업에서 집계',{exact:true}).waitFor();
    await panel.getByText('상위 작업 기간 밖',{exact:true}).waitFor();
    await panel.getByRole('button',{name:'수정',exact:true}).click();
    assert.equal(await rootEditor.getByLabel('목표일',{exact:true}).inputValue(),'');
    await rootEditor.getByLabel('시작일',{exact:true}).fill('');
    await rootEditor.getByRole('button',{name:'저장',exact:true}).click();
    await rootEditor.waitFor({state:'hidden'});
    await panel.getByText('시작일: 하위 작업에서 집계 · 목표일: 하위 작업에서 집계',{exact:true}).waitFor();
    assert.equal(items.find(r=>r.kind==='domain').start_date,null);
    assert.equal(items.find(r=>r.kind==='domain').target_date,null);
    await nav.getByRole('button',{name:'카드 결제',exact:true}).click();
    await create('하위 작업','승인 API',{'담당자':'개발자','목표일':'2027-04-01'});
    await create('하위 작업','화면 구현');
    await panel.getByText('상위 작업 기간 밖',{exact:true}).waitFor();
    await panel.getByRole('button',{name:'승인 API',exact:true}).click();
    const first=panel.locator('[data-plan-form]').first();
    await first.getByLabel('설명',{exact:true}).fill('입력 유지 검증');
    await panel.getByRole('button',{name:'화면 구현',exact:true}).click();
    assert.equal(await panel.locator('[data-plan-form]').first().getByLabel('설명',{exact:true}).inputValue(),'입력 유지 검증');
    await first.getByLabel('상태',{exact:true}).selectOption('done');
    await first.getByRole('button',{name:'저장',exact:true}).click();
    await panel.getByRole('status').filter({hasText:'저장했습니다.'}).waitFor();
    assert.equal(items.find(r=>r.name==='승인 API').description,'입력 유지 검증');
    await panel.getByRole('button',{name:'상위 작업 기간 조정',exact:true}).click();
    assert.equal(await page.locator('.plan-dialog').getByLabel('시작일',{exact:true}).inputValue(),'2026-01-01');
    await page.locator('.plan-dialog').getByRole('button',{name:'취소',exact:true}).click();
    await nav.getByRole('button',{name:'전체 일정',exact:true}).click();
    await panel.getByRole('button',{name:'전체 맞춤',exact:true}).click();
    assert(await panel.locator('.plan-bar').count());
    assert.equal(await panel.locator('.plan-summary-bar').count(),1);
    assert(await panel.locator('.plan-bar').first().evaluate(el=>el.getBoundingClientRect().width>10));
    assert(await panel.locator('.plan-time-header span').count()<20);
    await panel.getByRole('button',{name:'출시 목표일',exact:true}).click();
    await page.locator('.plan-dialog').getByLabel('목표일',{exact:true}).fill('2027-03-10');
    await page.locator('.plan-dialog').getByRole('button',{name:'저장',exact:true}).click();
    await page.locator('.plan-dialog').waitFor({state:'hidden'});
    await panel.locator('.plan-marker.launch').waitFor();
    await page.screenshot({path:'/tmp/planning-timeline.png'});
    await panel.getByLabel('타임라인 단위').selectOption('month');
    assert((await panel.locator('.plan-time-header').innerText()).includes('월'));
    await page.setViewportSize({width:600,height:850});
    await panel.getByRole('button',{name:'전체 맞춤',exact:true}).click();
    const geometry=await panel.locator('.plan-timeline-scroll').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));
    assert(geometry.scroll<=geometry.client+1,JSON.stringify(geometry));
    await page.screenshot({path:'/tmp/planning-mobile.png'});
    await page.setViewportSize({width:1440,height:900});
    await nav.getByRole('button',{name:'카드 결제',exact:true}).click();
    await page.screenshot({path:'/tmp/planning-feature.png'});
    // Reload the shell and retrieve the same saved backend snapshot.
    await page.reload();
    await page.waitForFunction(()=>document.querySelector('[data-workspace-shell]').dataset.ready==='true');
    if(await page.locator('[data-workspace-shell]').getAttribute('data-mode')==='start') await page.locator('[data-workspace-list]').getByRole('button',{name:'계획 검증'}).click();
    await page.locator('[data-activity="schedule"]').click();
    await nav.getByRole('button',{name:'카드 결제',exact:true}).waitFor();
    fail=true;await page.locator('[data-plan-header-actions]').getByRole('button',{name:'새로고침',exact:true}).click();await panel.getByRole('alert').waitFor();
    fail=false;await panel.getByRole('button',{name:'다시 시도'}).click();await nav.getByRole('button',{name:'카드 결제',exact:true}).waitFor();
    readOnly=true;await page.locator('[data-plan-header-actions]').getByRole('button',{name:'새로고침'}).click();await page.waitForFunction(()=>!document.querySelector('[data-plan-header-actions] [data-plan-action="add"]:not([hidden])'));
    await nav.getByRole('button',{name:'카드 결제',exact:true}).click();assert.equal(await panel.getByRole('button',{name:'수정',exact:true}).count(),0);
    await chooseWorkspace('two');await page.locator('[data-activity="schedule"]').click();await panel.getByText('하위 작업에 목표 기간을 입력하면 전체 일정이 표시됩니다.').waitFor();assert.equal(await nav.getByRole('button',{name:'카드 결제',exact:true}).count(),0);
    assert.deepEqual(errors,[]);assert.equal(mutations,8); // Four creates, two domain updates, one issue update, one launch-date update.
    console.log('PASS planning browser: hierarchy CRUD entry, issue draft/save, bounds adjustment, timeline fit/week/month/launch, mobile, reload, errors/retry, viewer, tenant switching, CSRF, prefixed deployment.');
  } catch(error) { await fs.writeFile('/tmp/planning-failure.html',await page.content()); await page.screenshot({path:'/tmp/planning-failure.png'}); console.error(errors); throw error; } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1);});
