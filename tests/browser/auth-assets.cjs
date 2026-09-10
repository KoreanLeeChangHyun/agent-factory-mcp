const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try {
  for(const prefix of ['', '/factory']) {
   const page=await browser.newPage({viewport:{width:390,height:844}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('http://auth.test/**',async route=>{
    const pathname=new URL(route.request().url()).pathname.slice(prefix.length);
    if(pathname==='/workspace/')return route.fulfill({contentType:'text/html',body:'<h1>Workspace destination</h1>'});
    const file=pathname==='/join/'?'template/join/index.html':pathname.slice(1);
    return route.fulfill({body:await fs.readFile(path.join(root,file)),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});
   });
   await page.goto(`http://auth.test${prefix}/join/`);
   await page.getByRole('alert').filter({hasText:'올바른 초대 링크'}).waitFor();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert.equal(await page.evaluate(()=>typeof agentFactoryAuthUI.fieldFor),'function');
   assert.equal(await page.evaluate(()=>typeof window.agentFactoryUI),'undefined');
   const org='11111111-1111-4111-8111-111111111111';
   await page.goto(`http://auth.test${prefix}/join/?organization_invite=${org}#invitation=fixture-token`);
   await page.waitForURL(`http://auth.test${prefix}/workspace/`);
   assert.deepEqual(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('agentFactoryPendingInvitation'))),{organizationId:org,token:'fixture-token'});
   await page.addInitScript(()=>{Storage.prototype.setItem=function(){throw new Error('storage unavailable');};});
   await page.goto(`http://auth.test${prefix}/join/?organization_invite=${org}#invitation=fixture-token`);
   await page.getByRole('alert').filter({hasText:'초대를 보관할 수 없습니다.'}).waitFor();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert.deepEqual(errors,[]);
   await page.close();
  }
  console.log('PASS auth assets: invalid invite, storage failure, scoped redirect/session handoff, narrow layout, lightweight bundle');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
