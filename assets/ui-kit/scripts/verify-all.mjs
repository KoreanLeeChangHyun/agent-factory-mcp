import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let server;
const run = file => new Promise((resolve,reject) => {
  const child = spawn(process.execPath,[path.join(root,file)],{cwd:root,stdio:'inherit'});
  child.on('error',reject);
  child.on('exit',code => code === 0 ? resolve() : reject(new Error(file + ' failed: ' + code)));
});
async function available() {
  try {
    const response = await fetch('http://127.0.0.1:8765/assets/ui-kit/index.html',{signal:AbortSignal.timeout(1000)});
    return response.ok && (await response.text()).includes('Agent Factory 공통 에셋');
  } catch { return false; }
}
try {
  if (!await available()) {
    server = spawn('python3',['-m','http.server','8765','--bind','127.0.0.1'],{cwd:path.resolve(root,'../..'),stdio:'ignore'});
    server.on('error',error => { console.error(error); });
    for (let attempt = 0; attempt < 20 && !await available(); attempt++) await new Promise(resolve => setTimeout(resolve,100));
    if (!await available()) throw new Error('Cannot serve catalog on loopback port 8765.');
  }
  for (const file of [
    'scripts/verify-provenance.mjs','tests/verify-interactions.cjs','tests/verify-uploads.cjs',
    'tests/verify-navigation.cjs','tests/verify-compositions.cjs','tests/verify-inputs.cjs',
    'tests/verify-web-components.cjs','tests/verify-states.cjs','tests/verify-http.cjs','tests/verify-layouts.cjs',
  ]) await run(file);
  console.log('All asset verification suites passed.');
} finally { server?.kill('SIGTERM'); }
