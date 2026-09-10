import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const vendor=path.join(root,'vendor/material-icon-theme');
const provenance=JSON.parse(await readFile(path.join(vendor,'provenance.json'),'utf8'));
for(const file of provenance.files) {
  const bytes=await readFile(path.join(vendor,file.path));
  if(createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw new Error('Changed Material source: '+file.path);
}
const manifest=JSON.parse(await readFile(path.join(vendor,'dist/material-icons.json'),'utf8'));
const names=['file','readme','markdown','javascript','typescript','json','python','html','css','yaml','pdf','image'];
for(const folder of ['folder','folder-test','folder-benchmark','folder-contract','folder-connection','folder-docs','folder-src'])names.push(folder,folder+'-open');
const icons={};
for(const name of names) {
  const source=await readFile(path.join(vendor,'icons',name+'.svg'),'utf8');
  if(/<(?:script|foreignObject|image)\b|\bon\w+\s*=|\bhref\s*=\s*["'](?!#)/i.test(source))throw new Error('Unsafe Material SVG: '+name);
  icons[name]=source;
}
const mappings={};
for(const key of ['folderNames','folderNamesExpanded','fileNames','fileExtensions'])
  mappings[key]=Object.fromEntries(Object.entries(manifest[key]).filter(([,name])=>Object.hasOwn(icons,name)));
const output='// Material Icon Theme '+provenance.version+' — MIT; original SVG colors and paths.\nexport const materialIcons = '+JSON.stringify(icons)+';\nexport const materialMappings = '+JSON.stringify(mappings)+';\n';
const target=path.join(root,'generated/material-icons.js');
if(process.argv.includes('--check')) {
  if(await readFile(target,'utf8')!==output)throw new Error('Stale Material icon registry');
} else await writeFile(target,output);
console.log('Verified '+provenance.files.length+' Material source files; '+names.length+' runtime icons.');
