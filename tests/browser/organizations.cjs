// NODE_PATH=/tmp/af-pw/node_modules node tests/browser/organizations.cjs
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const http=require('node:http');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const server=http.createServer(async(req,res)=>{
  const file=req.url==='/workspace/'?'/template/workspace/index.html':req.url;
  if(!file.startsWith('/static/')&&!file.startsWith('/template/'))return res.writeHead(404).end();
  try{const data=await fs.readFile(path.join(root,file));res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(data);}catch{res.writeHead(404).end();}
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const org='11111111-1111-4111-8111-111111111111', second='22222222-2222-4222-8222-222222222222';
 const grants=['organization.read','organization.update','workspace.create','member.read','member.invite','member.cancel_invite','member.update_role','member.suspend','member.remove','role.read','role.create','role.update','role.delete','role.assign','team.read','team.create','team.update','team.delete','team.manage_members'];
 const roles=[{id:'owner',name:'organization_owner',scope:'organization',is_system:true,permissions:grants},{id:'org-member',name:'organization_member',scope:'organization',is_system:true,permissions:['organization.read']},{id:'viewer',name:'viewer',scope:'workspace',is_system:true,permissions:['workspace.read','document.read']}];
 const members=[{user_id:'user',name:'테스터',email:'test@example.com',role_id:'owner',role_name:'organization_owner',status:'active'},{user_id:'maintainer',name:'메인테이너',email:'maintainer@example.com',role_id:'org-member',role_name:'organization_member',status:'active'},{user_id:'paused',name:'정지 사용자',email:'paused@example.com',role_id:'org-member',role_name:'organization_member',status:'suspended'}];
 const mutations=[];
 const reads=[];
 let organizations=[{id:org,name:'개발 조직',slug:'dev-org',is_personal:false},{id:second,name:'다른 조직',slug:'other-org',is_personal:false}];
 const spaces=[{id:'space',organization_id:org,name:'개발 공간',slug:'dev-space',status:'active',revision:1,created_at:'2026-01-01T00:00:00Z',updated_at:'2026-01-01T00:00:00Z'}];
 await page.route('**/api/**',async route=>{
  const req=route.request(),url=new URL(req.url()).pathname;
  const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(req.method()!=='GET'){
   const body=req.postData()?req.postDataJSON():null;mutations.push({url,method:req.method(),body});
   if(req.method()==='DELETE'&&url===`/api/organizations/${second}`){organizations=organizations.filter(o=>o.id!==second);return reply({ok:true});}
   if(url.endsWith('/roles')&&req.method()==='POST'){roles.push({id:'custom',...body,is_system:false});return reply({id:'custom'},201);}
   return reply({ok:true},url.endsWith('/invitations')?201:200);
  }
  reads.push(url);
  if(url==='/api/auth/me')return reply({user:{id:'user',display_name:'테스터',email:'test@example.com',is_platform_admin:false}});
  if(url==='/api/account/organizations')return reply(organizations);
  if(url.endsWith('/recent'))return reply([]);
  if(url.endsWith('/workspaces'))return reply(spaces);
  if(url.endsWith('/members/user'))return reply({...members[0],organization_sources:[{role_name:'organization_owner',permissions:['member.invite']}],teams:[],workspaces:[{workspace_id:'space',name:'개발 공간',permissions:['document.read'],sources:[{source:'team',team_name:'개발팀',permissions:['document.read']}]}]});
  if(url.endsWith('/members'))return reply(members);
  if(url.endsWith('/roles'))return reply(roles);
  if(url.endsWith('/permission-catalog'))return reply([{key:'document.read',label:'문서 조회',resource:'document',resource_label:'문서',scope:'workspace',description:'역할이 배정된 작업공간에서 문서를 조회합니다.'},{key:'document.delete',label:'문서 삭제',resource:'document',scope:'workspace'},{key:'member.read',label:'구성원 조회',resource:'member',scope:'organization'}]);
  if(url.endsWith('/workspace-options'))return reply([{id:'space',name:'개발 공간'}]);
  if(url.endsWith('/teams'))return reply([{id:'team',name:'개발팀',description:'',members:['user'],workspaces:[]}]);
  if(url.endsWith('/events')||url.endsWith('/invitations'))return reply([]);
  if(url===`/api/organizations/${org}`||url===`/api/organizations/${second}`){const row=organizations.find(item=>url.endsWith(item.id));return reply({...row,is_owner:true,revision:1,permissions:grants});}
  return reply({error:{message:'unexpected '+url}},404);
 });
 await page.goto(`http://127.0.0.1:${server.address().port}/workspace/`);
 // The product bridge must be ready before organization initialization, without
 // loading the catalog's vendor bundle. Existing native fields retain identity.
 assert.equal(await page.evaluate(()=>typeof window.agentFactoryUI.fieldFor),'function');
 assert.deepEqual(await page.evaluate(()=>{
   const action=document.createElement('button'); let clicks=0;
   action.addEventListener('click',()=>clicks++);
   const table=agentFactoryUI.resourceTable({headers:['이름','관리'],rows:[['<script>bad()</script>',action]]});
   table.querySelector('button').click();
   const empty=agentFactoryUI.resourceTable({headers:['이름','관리'],rows:[]});
   return {same:table.querySelector('button')===action,clicks,script:table.querySelectorAll('script').length,
     text:table.querySelector('td').textContent,scope:table.querySelector('th').scope,colspan:empty.querySelector('td').colSpan};
 }),{same:true,clicks:1,script:0,text:'<script>bad()</script>',scope:'col',colspan:2});
 assert.equal(await page.evaluate(()=>performance.getEntriesByType('resource').some(r=>/vendors\.js/.test(r.name))),false);
 assert.deepEqual(await page.evaluate(()=>{
   const form=document.createElement('form'), control=document.createElement('input');
   control.name='slug'; control.value='kept-value'; control.required=true; control.maxLength=39;
   control.setAttribute('aria-describedby','owner-help');
   let events=0; control.addEventListener('input',()=>events++);
   const field=agentFactoryUI.fieldFor({label:'식별자',control,help:'도움말'});
   form.append(field.root);document.body.append(form);
   control.dispatchEvent(new Event('input'));
   field.setError('잘못된 값');
   const invalid=control.getAttribute('aria-invalid');field.setError('');
   const result={same:field.control===control,value:new FormData(form).get('slug'),required:control.required,maxLength:control.maxLength,events,invalid,retained:control.getAttribute('aria-describedby').includes('owner-help'),label:field.root.querySelector('label').control===control};
   form.remove();return result;
 }),{same:true,value:'kept-value',required:true,maxLength:39,events:1,invalid:'true',retained:true,label:true});
 await page.locator('[data-open-organizations]').click();
 await page.getByRole('heading',{name:'개요',exact:true}).waitFor();
 assert.deepEqual(await page.locator('[data-organization-navigation] button').allTextContents(),['개요','작업공간','구성원','팀','설정']);
 assert.equal(await page.locator('[data-organization-slug]').textContent(),'@dev-org');
 assert.equal(await page.locator('[data-header-organization]').textContent(),'개발 조직');
 assert.ok(await page.locator('.organization-cards').getByRole('button',{name:'개발 공간'}).isVisible());
 const stat=page.locator('.organization-stats button').first();
 assert.equal(await stat.evaluate(el=>getComputedStyle(el).fontSize),'18px');
 assert.equal(await stat.evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
 for(const width of [1400,390]) {
   await page.setViewportSize({width,height:1000});
   assert.equal(await page.locator('.organization-cards').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),width===390?1:3);
   const identifier=page.locator('.organization-cards code').first();
   const original=await identifier.textContent();
   await identifier.evaluate(el=>el.textContent='긴-한국어-작업공간-식별자-'.repeat(20));
   assert(await page.locator('[data-organization-content]').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
   await identifier.evaluate((el,text)=>el.textContent=text,original);
   if(process.env.UI_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.UI_SCREENSHOT_DIR,`organization-${width}.png`)});
 }
 await page.setViewportSize({width:1400,height:1000});
 await page.locator('[data-org-view="workspaces"]').click();
 await page.locator('[data-organization-content] > h1').getByText('작업공간',{exact:true}).waitFor();
 await page.getByRole('button',{name:'새 작업공간',exact:true}).waitFor();
 await page.locator('[data-org-view="members"]').click();
 const membersPanel=page.locator('.organization-tab-panel').filter({has:page.getByLabel('이름 또는 이메일 검색')});
 await membersPanel.getByLabel('이름 또는 이메일 검색').fill('정지 사용자');
 assert.equal(await membersPanel.locator('tbody tr').count(),1);
 await membersPanel.getByLabel('이름 또는 이메일 검색').fill('');
 await membersPanel.getByLabel('조직 역할').selectOption('owner');
 assert.equal(await membersPanel.locator('tbody tr').count(),1);
 await membersPanel.getByLabel('조직 역할').selectOption('');
 await membersPanel.getByLabel('구성원 상태').selectOption('suspended');
 assert.ok(await membersPanel.getByText('정지 사용자',{exact:true}).isVisible());
 await membersPanel.getByLabel('구성원 상태').selectOption('');
 await page.locator('[data-organization-content]').getByRole('button',{name:'테스터',exact:true}).click();
 await page.getByRole('heading',{name:'작업공간 및 적용 권한'}).waitFor();
 assert.ok(await page.locator('.organization-detail').getByText('팀: 개발팀').isVisible());
 assert.ok(await page.locator('.organization-detail').getByText('member.invite',{exact:true}).isVisible());
 await page.locator('[data-org-view="settings"]').click();
 await page.locator('[data-organization-content] > h1').getByText('설정',{exact:true}).waitFor();
 await page.getByText(org,{exact:true}).waitFor();
 const createOrganization=page.locator('.organization-form').filter({has:page.getByRole('heading',{name:'새 조직 만들기',exact:true})});
 await createOrganization.getByLabel('조직 이름').fill('a'.repeat(38)+' b');
 assert.equal(await createOrganization.getByLabel('조직 식별자').inputValue(),'a'.repeat(38));
 await createOrganization.getByLabel('조직 이름').fill('Developer Tools');
 assert.equal(await createOrganization.getByLabel('조직 식별자').inputValue(),'developer-tools');
 await createOrganization.getByLabel('조직 식별자').fill('');
 await createOrganization.getByLabel('조직 식별자').pressSequentially('my-org');
 assert.equal(await createOrganization.getByLabel('조직 식별자').inputValue(),'my-org');
 assert.ok(await page.locator('.organization-danger').getByRole('heading',{name:'소유권 이전',exact:true}).isVisible());
 await page.locator('.organization-subnav').getByRole('button',{name:'역할 및 권한'}).click();
 await page.getByRole('button',{name:'역할 만들기',exact:true}).click();
 const editor=page.locator('.organization-form').filter({has:page.getByRole('heading',{name:'역할 만들기',exact:true})});
 await editor.getByLabel('이름',{exact:true}).fill('문서 검토자');
 await editor.getByLabel('기본 역할에서 시작').selectOption('viewer');
 await editor.getByText('세부 스코프 조정',{exact:true}).click();
 assert.ok(await editor.getByLabel('문서 조회',{exact:true}).isChecked());
 assert.ok(await editor.getByText('역할이 배정된 작업공간에서 문서를 조회합니다.').isVisible());
 await editor.getByRole('button',{name:'만들기',exact:true}).click();
 await page.getByRole('button',{name:'문서 검토자',exact:true}).waitFor();
 assert.deepEqual(mutations.find(m=>m.url.endsWith('/roles')).body,{name:'문서 검토자',scope:'workspace',permissions:['document.read']});
 await page.locator('.organization-subnav').getByRole('button',{name:'감사 로그'}).click();
 await page.getByText('조직의 구성원·팀·역할·소유권 변경 기록입니다.').waitFor();
 await page.locator('[data-org-view="teams"]').click();
 await page.getByRole('button',{name:'개발팀',exact:true}).click();
 await page.getByRole('heading',{name:'작업공간 배정',exact:true}).waitFor();
 const beforeConfirm=mutations.length;
 await page.getByRole('button',{name:'삭제',exact:true}).click();
 const confirmDialog=page.getByRole('dialog',{name:'작업 확인'});
 await confirmDialog.waitFor();
 assert.ok(await confirmDialog.getByRole('button',{name:'취소',exact:true}).evaluate(el=>el===document.activeElement));
 for(const width of [390,1400]) {
   await page.setViewportSize({width,height:1000});
   assert.ok(await confirmDialog.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&el.scrollWidth<=el.clientWidth+1;}));
   if(process.env.UI_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.UI_SCREENSHOT_DIR,`organization-confirm-${width}.png`)});
 }
 await page.keyboard.press('Shift+Tab');
 assert.ok(await confirmDialog.getByRole('button',{name:'확인',exact:true}).evaluate(el=>el===document.activeElement));
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'개발팀',exact:true}).waitFor();
 assert.equal(mutations.length,beforeConfirm);
 assert.ok(await page.getByRole('button',{name:'삭제',exact:true}).evaluate(el=>el===document.activeElement));
 await page.getByRole('button',{name:'삭제',exact:true}).click();
 await confirmDialog.getByRole('button',{name:'확인',exact:true}).click();
 await page.getByRole('button',{name:'개발팀',exact:true}).waitFor();
 assert.equal(mutations.filter(m=>m.method==='DELETE'&&m.url.endsWith('/teams/team')).length,1);
 await page.getByRole('button',{name:'삭제',exact:true}).click();
 await confirmDialog.waitFor();
 const beforeReset=mutations.length;
 await page.evaluate(()=>window.agentFactoryOrganizations.reset());
 assert.equal(await page.locator('dialog.af-confirm').count(),0);
 assert.equal(mutations.length,beforeReset);
 await page.locator('[data-org-view="members"]').click();
 await page.getByRole('tab',{name:'구성원',exact:true}).focus();
 await page.keyboard.press('ArrowRight');
 assert.equal(await page.getByRole('tab',{name:/대기 중인 초대/}).getAttribute('aria-selected'),'true');
 assert.equal(await page.locator('.organization-subnav [aria-selected="true"]').evaluate(el=>getComputedStyle(el).borderBottomWidth),'2px');
 await page.keyboard.press('Home');
 assert.equal(await page.getByRole('tab',{name:'구성원',exact:true}).getAttribute('aria-selected'),'true');
 await page.keyboard.press('End');
 const invite=page.locator('.organization-form').filter({has:page.getByRole('heading',{name:'구성원 초대',exact:true})});
 await invite.getByLabel('이메일',{exact:true}).fill('invite@example.com');
 await invite.getByRole('button',{name:'초대 보내기'}).click();
 await page.waitForFunction(()=>!!document.querySelector('[data-organization-content] table'));
 assert.equal(mutations.find(m=>m.url.endsWith('/invitations')).body.email,'invite@example.com');
 await page.locator('[data-organization-select]').selectOption(second);
 await page.locator('[data-workspace-shell][data-mode="organization"]').waitFor();
 await page.getByRole('heading',{name:'개요',exact:true}).waitFor();
 assert.equal(await page.locator('[data-organization-slug]').textContent(),'@other-org');
 assert.equal(await page.locator('[data-header-organization]').textContent(),'다른 조직');
 await page.locator('[data-org-view="settings"]').click();
 const deletion=page.locator('.organization-form').filter({has:page.getByRole('heading',{name:'조직 삭제',exact:true})});
 await deletion.getByLabel('삭제할 조직 이름').fill('틀린 이름');
 await deletion.getByRole('button',{name:'조직 삭제',exact:true}).click();
 await deletion.getByText('조직 이름이 일치하지 않습니다.').waitFor();
 assert.ok(!mutations.some(m=>m.method==='DELETE'&&m.url===`/api/organizations/${second}`));
 await deletion.getByLabel('삭제할 조직 이름').fill('다른 조직');
 await deletion.getByRole('button',{name:'조직 삭제',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[data-organization-slug]').textContent==='@dev-org');
 assert.equal(await page.locator('[data-header-organization]').textContent(),'개발 조직');
 assert.equal(await page.locator('[data-organization-select] option').count(),2);
 grants.splice(0);
 for(const [view,label,endpoint] of [['members','구성원','members'],['teams','팀','teams'],['roles','역할','roles']]) {
   const start=reads.length;
   await page.evaluate(view=>agentFactoryOrganizations.open(undefined,view),view);
   await page.locator('[data-organization-content] .af-status[data-kind="permission"]').filter({hasText:`${label} 조회 권한이 없습니다.`}).waitFor();
   assert.ok(!reads.slice(start).some(url=>url.endsWith('/'+endpoint)));
 }
 spaces.splice(0);
 await page.evaluate(()=>agentFactoryOrganizations.open(undefined,'workspaces'));
 await page.locator('[data-organization-content] .af-status[data-kind="empty"]').filter({hasText:'접근 가능한 작업공간이 없습니다.'}).waitFor();
 assert.deepEqual(errors,[]);
 console.log('Organization browser flows passed');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
