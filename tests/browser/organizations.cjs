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
 const grants=['organization.read','organization.update','member.read','member.invite','member.cancel_invite','member.update_role','member.suspend','member.remove','role.read','role.create','role.update','role.delete','role.assign','team.read','team.create','team.update','team.delete','team.manage_members'];
 const roles=[{id:'owner',name:'organization_owner',scope:'organization',is_system:true,permissions:grants},{id:'reader',name:'열람',scope:'workspace',is_system:false,permissions:['workspace.read','document.read']}];
 const members=[{user_id:'user',name:'테스터',email:'test@example.com',role_id:'owner',role_name:'organization_owner',status:'active'}];
 const mutations=[];
 let organizations=[{id:org,name:'개발 조직',is_personal:true},{id:second,name:'다른 조직',is_personal:false}];
 await page.route('**/api/**',async route=>{
  const req=route.request(),url=new URL(req.url()).pathname;
  const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(req.method()!=='GET'){
   const body=req.postData()?req.postDataJSON():null;mutations.push({url,method:req.method(),body});
   if(req.method()==='DELETE'&&url===`/api/organizations/${second}`){organizations=organizations.filter(o=>o.id!==second);return reply({ok:true});}
   if(url.endsWith('/roles')&&req.method()==='POST'){roles.push({id:'custom',...body,is_system:false});return reply({id:'custom'},201);}
   return reply({ok:true},url.endsWith('/invitations')?201:200);
  }
  if(url==='/api/auth/me')return reply({user:{id:'user',display_name:'테스터',email:'test@example.com',is_platform_admin:false}});
  if(url==='/api/account/organizations')return reply(organizations);
  if(url.endsWith('/workspaces')||url.endsWith('/recent'))return reply([]);
  if(url.endsWith('/members/user'))return reply({...members[0],organization_sources:[{role_name:'organization_owner',permissions:['member.invite']}],teams:[],workspaces:[{workspace_id:'space',name:'개발 공간',permissions:['document.read'],sources:[{source:'team',team_name:'개발팀',permissions:['document.read']}]}]});
  if(url.endsWith('/members'))return reply(members);
  if(url.endsWith('/roles'))return reply(roles);
  if(url.endsWith('/permission-catalog'))return reply([{key:'document.read',label:'문서 조회',resource:'document',resource_label:'문서',scope:'workspace',description:'역할이 배정된 작업공간에서 문서를 조회합니다.'},{key:'document.delete',label:'문서 삭제',resource:'document',scope:'workspace'},{key:'member.read',label:'구성원 조회',resource:'member',scope:'organization'}]);
  if(url.endsWith('/workspace-options'))return reply([{id:'space',name:'개발 공간'}]);
  if(url.endsWith('/teams'))return reply([{id:'team',name:'개발팀',description:'',members:['user'],workspaces:[]}]);
  if(url.endsWith('/events')||url.endsWith('/invitations'))return reply([]);
  if(url===`/api/organizations/${org}`||url===`/api/organizations/${second}`)return reply({id:url.endsWith(second)?second:org,name:'조직',is_personal:false,is_owner:true,revision:1,permissions:grants});
  return reply({error:{message:'unexpected '+url}},404);
 });
 await page.goto(`http://127.0.0.1:${server.address().port}/workspace/`);
 await page.locator('[data-open-organizations]').click();
 assert.equal(await page.locator('[data-organization-code]').textContent(),org);
 assert.equal(await page.locator('[data-header-organization]').textContent(),'개인');
 await page.locator('[data-organization-content]').getByRole('button',{name:'테스터',exact:true}).click();
 await page.getByRole('heading',{name:'작업공간 및 적용 권한'}).waitFor();
 assert.ok(await page.locator('.organization-detail').getByText('팀: 개발팀').isVisible());
 assert.ok(await page.locator('.organization-detail').getByText('member.invite',{exact:true}).isVisible());
 await page.locator('[data-org-view="roles"]').click();
 await page.getByRole('button',{name:'역할 만들기',exact:true}).click();
 const editor=page.locator('.organization-form').filter({has:page.getByRole('heading',{name:'역할 만들기',exact:true})});
 await editor.getByLabel('이름',{exact:true}).fill('문서 검토자');
 await editor.getByLabel('문서 조회',{exact:true}).check();
 assert.ok(await editor.getByText('역할이 배정된 작업공간에서 문서를 조회합니다.').isVisible());
 await editor.getByRole('button',{name:'만들기',exact:true}).click();
 await page.getByRole('button',{name:'문서 검토자',exact:true}).waitFor();
 assert.deepEqual(mutations.find(m=>m.url.endsWith('/roles')).body,{name:'문서 검토자',scope:'workspace',permissions:['document.read']});
 await page.locator('[data-org-view="teams"]').click();
 await page.getByRole('button',{name:'개발팀',exact:true}).click();
 await page.getByRole('heading',{name:'작업공간 배정',exact:true}).waitFor();
 await page.locator('[data-org-view="members"]').click();
 const invite=page.locator('.organization-form').filter({has:page.getByRole('heading',{name:'구성원 초대',exact:true})});
 await invite.getByLabel('이메일',{exact:true}).fill('invite@example.com');
 await invite.getByRole('button',{name:'초대 보내기'}).click();
 await page.waitForFunction(()=>!!document.querySelector('[data-organization-content] table'));
 assert.equal(mutations.find(m=>m.url.endsWith('/invitations')).body.email,'invite@example.com');
 await page.locator('[data-organization-select]').selectOption(second);
 await page.locator('[data-workspace-shell][data-mode="organization"]').waitFor();
 await page.getByRole('heading',{name:'구성원',exact:true}).waitFor();
 assert.equal(await page.locator('[data-organization-code]').textContent(),second);
 assert.equal(await page.locator('[data-header-organization]').textContent(),'다른 조직');
 await page.locator('[data-org-view="settings"]').click();
 const deletion=page.locator('.organization-form').filter({has:page.getByRole('heading',{name:'조직 삭제',exact:true})});
 await deletion.getByLabel('삭제할 조직 이름').fill('틀린 이름');
 await deletion.getByRole('button',{name:'조직 삭제',exact:true}).click();
 await deletion.getByText('조직 이름이 일치하지 않습니다.').waitFor();
 assert.ok(!mutations.some(m=>m.method==='DELETE'&&m.url===`/api/organizations/${second}`));
 await deletion.getByLabel('삭제할 조직 이름').fill('조직');
 await deletion.getByRole('button',{name:'조직 삭제',exact:true}).click();
 await page.waitForFunction(id=>document.querySelector('[data-organization-code]').textContent===id,org);
 assert.equal(await page.locator('[data-header-organization]').textContent(),'개인');
 assert.equal(await page.locator('[data-organization-select] option').count(),1);
 assert.deepEqual(errors,[]);
 console.log('Organization browser flows passed');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
