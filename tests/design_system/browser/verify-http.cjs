const assert = require('node:assert/strict');
const http = require('node:http');
const { chromium } = require('playwright');
(async () => {
  let received = '';
  const server = http.createServer((req,res) => {
    res.setHeader('Access-Control-Allow-Origin','http://127.0.0.1:8765');
    if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Methods','POST'); res.end(); return; }
    const chunks = [];
    req.on('data',chunk => chunks.push(chunk));
    req.on('end',() => {
      received = Buffer.concat(chunks).toString();
      const reply = () => {
        res.statusCode = req.url === '/error' ? 403 : 201;
        res.setHeader('Content-Type','application/json');
        res.end(JSON.stringify({accepted:req.url !== '/error'}));
      };
      if (req.url === '/slow') setTimeout(reply,500); else reply();
    });
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const endpoint = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:8765/assets/ui-kit/');
    await page.waitForFunction(() => !!window.afCatalog);
    const result = await page.evaluate(async endpoint => {
      const {xhrTransport} = await import('./src/components/transport.js');
      const {createUploadQueue} = await import('./src/components/uploads.js');
      const host = document.createElement('div'); document.body.append(host);
      const queue = createUploadQueue(host,{transport:xhrTransport({endpoint:endpoint + '/ok'})});
      const transfer = new DataTransfer();
      transfer.items.add(new File(['fixture-data'],'drop.txt',{type:'text/plain'}));
      host.dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:transfer}));
      await queue.uppy.upload();
      const complete = queue.uppy.getFiles()[0].progress.uploadComplete;
      const file = new File(['data'],'test.txt');
      const errors = [];
      try { await xhrTransport({endpoint:endpoint + '/error'})(file,{signal:new AbortController().signal,onProgress(){}}); }
      catch(error) { errors.push(error.message); }
      const controller = new AbortController();
      const pending = xhrTransport({endpoint:endpoint + '/slow'})(file,{signal:controller.signal,onProgress(){}});
      controller.abort();
      try { await pending; } catch(error) { errors.push(error.name); }
      queue.destroy(); host.remove();
      return {complete,errors};
    },endpoint);
    assert.equal(result.complete,true);
    assert.match(result.errors[0],/403/);
    assert.equal(result.errors[1],'AbortError');
    assert.ok(received.includes('filename='));
    console.log('PASS: real loopback HTTP multipart upload/drop, server success/error, abort');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode=1; });
