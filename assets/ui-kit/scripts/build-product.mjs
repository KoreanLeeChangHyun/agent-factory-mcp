import './build-material-icons.mjs';
import { build } from 'esbuild';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(root, '../../static/ui');
const check = process.argv.includes('--check');
if (!check) await mkdir(output, { recursive: true });
const result = await build({
  absWorkingDir: root,
  entryPoints: [path.join(root, 'src/product-core.js')],
  outfile: path.join(output, 'core.js'),
  bundle: true, format: 'iife', globalName: 'agentFactoryUI',
  platform: 'browser', target: ['es2022'], legalComments: 'linked',
  write: !check,
});
const authResult = await build({
  absWorkingDir:root, entryPoints:[path.join(root,'src/product-auth.js')],
  outfile:path.join(output,'auth.js'), bundle:true, format:'iife',
  globalName:'agentFactoryAuthUI', platform:'browser', target:['es2022'], write:!check,
});
const positioningResult = await build({
  absWorkingDir:root, entryPoints:[path.join(root,'src/product-positioning.js')],
  outfile:path.join(output,'positioning.js'), bundle:true, format:'iife',
  globalName:'agentFactoryPositioning', platform:'browser', target:['es2022'], write:!check,
  legalComments:'linked',
});
const splitterResult = await build({
  absWorkingDir:root, entryPoints:[path.join(root,'src/components/splitter.js')],
  outfile:path.join(output,'splitter.js'), bundle:true, format:'iife', globalName:'agentFactorySplitter',
  platform:'browser', target:['es2022'], write:!check, legalComments:'linked', metafile:true,
  plugins:[{name:'splitter-only',setup(build) {
    build.onResolve({filter:/generated\/vendors\.js$/},() => ({path:path.join(root,'src/product-splitter-vendors.js')}));
  }}],
});
const toastResult = await build({
  absWorkingDir:root, entryPoints:[path.join(root,'src/components/toasts.js')],
  outfile:path.join(output,'toasts.js'), bundle:true, format:'iife', globalName:'agentFactoryToasts',
  platform:'browser', target:['es2022'], write:!check, legalComments:'linked', metafile:true,
  plugins:[{name:'toast-only',setup(build) {
    build.onResolve({filter:/generated\/vendors\.js$/},() => ({path:path.join(root,'src/product-toast-vendors.js')}));
  }}],
});
if (check) {
  for (const file of [...result.outputFiles,...authResult.outputFiles,...positioningResult.outputFiles,...splitterResult.outputFiles,...toastResult.outputFiles]) {
    if (!Buffer.from(file.contents).equals(await readFile(file.path))) throw new Error('Stale product asset: ' + file.path);
  }
  if (!(await readFile(path.join(root,'styles/theme.css'))).equals(await readFile(path.join(output,'theme.css')))) throw new Error('Stale product theme.');
} else await copyFile(path.join(root, 'styles/theme.css'), path.join(output, 'theme.css'));
const iconProvenance = JSON.parse(await readFile(path.join(root,'generated/icons.provenance.json'),'utf8'));
iconProvenance.license = './tabler-LICENSE';
const notices = [
  ['material-icon-theme-LICENSE',await readFile(path.join(root,'vendor/material-icon-theme/LICENSE'))],
  ['material-icons.provenance.json',await readFile(path.join(root,'vendor/material-icon-theme/provenance.json'))],
  ['tabler-LICENSE',await readFile(path.join(root,'vendor/tabler/LICENSE'))],
  ['icons.provenance.json',Buffer.from(JSON.stringify(iconProvenance,null,2)+'\n')],
];
const lock = JSON.parse(await readFile(path.join(root,'package-lock.json'),'utf8'));
const positioningPackages = [];
for (const name of ['dom','core','utils']) {
  const license = await readFile(path.join(root,'node_modules/@floating-ui',name,'LICENSE'));
  const notice = 'floating-ui-'+name+'-LICENSE';
  notices.push([notice,license]);
  const entry = lock.packages['node_modules/@floating-ui/'+name];
  positioningPackages.push({name:'@floating-ui/'+name,version:entry.version,resolved:entry.resolved,integrity:entry.integrity,
    license:notice,licenseSha256:createHash('sha256').update(license).digest('hex')});
}
notices.push(['positioning.provenance.json',Buffer.from(JSON.stringify({packages:positioningPackages},null,2)+'\n')]);
const inventory = JSON.parse(await readFile(path.join(root,'generated/provenance.json'),'utf8'));
for (const [bundle,built] of [['splitter',splitterResult],['toasts',toastResult]]) {
const names = new Set(Object.keys(built.metafile.inputs).map(input=>input.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/)?.[1]).filter(Boolean));
const splitterPackages=[];
for (const name of [...names].sort()) {
  const upstream=inventory.packages.find(entry=>entry.name===name);
  if (!upstream) throw new Error('Missing '+bundle+' source provenance: '+name);
  const copied=[];
  for (const notice of upstream.notices) {
    const bytes=await readFile(path.join(root,'generated',notice.path));
    const filename=bundle+'-'+name.replace('/','__')+'-'+path.basename(notice.path);
    notices.push([filename,bytes]); copied.push({path:filename,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
  splitterPackages.push({...upstream,notices:copied});
}
notices.push([bundle+'.provenance.json',Buffer.from(JSON.stringify({packages:splitterPackages},null,2)+'\n')]);
}
for (const [name, bytes] of notices) {
  const destination = path.join(output,name);
  if (check) { if (!bytes.equals(await readFile(destination))) throw new Error('Stale product notice: '+name); }
  else await writeFile(destination,bytes);
}
console.log((check ? 'Verified' : 'Built') + ' /static/ui core, auth, positioning, splitter, toasts, theme and source notices.');
