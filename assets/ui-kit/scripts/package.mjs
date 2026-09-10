// Reproducible handoff archive. Does not modify production files.
import { mkdtemp, mkdir, readdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repository = path.resolve(root,'../..');
const stage = await mkdtemp(path.join(tmpdir(),'af-ui-package-'));
const files = [];
async function copy(source,relative) {
  const destination = path.join(stage,relative);
  await mkdir(path.dirname(destination),{recursive:true});
  await copyFile(source,destination);
  const bytes = await readFile(source);
  files.push({path:relative,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
async function collect(directory,relative) {
  for (const entry of (await readdir(directory,{withFileTypes:true})).sort((a,b) => a.name.localeCompare(b.name))) {
    if (['node_modules','release','.gitignore','README.md'].includes(entry.name)) continue;
    const source = path.join(directory,entry.name), target = path.join(relative,entry.name);
    if (entry.isDirectory()) await collect(source,target);
    else if (entry.isFile()) await copy(source,target);
  }
}
await collect(root,'assets/ui-kit');
await copy(path.join(repository,'static/css/ui.css'),'static/css/ui.css');
await writeFile(path.join(stage,'MANIFEST.json'),JSON.stringify({format:1,files},null,2) + '\n');
const release = path.join(root,'release');
await mkdir(release,{recursive:true});
const archive = path.join(release,'agent-factory-ui-assets.tar.gz');
const result = spawnSync('tar',['--sort=name','--mtime=@0','--owner=0','--group=0','--numeric-owner','-czf',archive,'-C',stage,'.'],{stdio:'inherit'});
if (result.status !== 0) throw new Error('Archive creation failed.');
const bytes = await readFile(archive);
await writeFile(path.join(release,'archive.json'),JSON.stringify({file:path.basename(archive),sha256:createHash('sha256').update(bytes).digest('hex'),files:files.length,bytes:bytes.length},null,2) + '\n');
console.log('Packaged ' + files.length + ' files: ' + archive);
console.log('Staging copy retained at ' + stage);
