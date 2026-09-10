import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = name => readFile(path.join(root,name));
const provenance = JSON.parse(await read('generated/provenance.json'));
assert.equal(hash(await read('package-lock.json')),provenance.packageLockSha256);
const manifest = JSON.parse(await read('package.json'));
const lock = JSON.parse(await read('package-lock.json'));
for (const [name,version] of Object.entries(manifest.dependencies)) {
  assert.match(version,/^\d+\.\d+\.\d+$/);
  assert.equal(lock.packages['node_modules/' + name].version,version);
  assert.ok(provenance.packages.some(item => item.name === name),'Missing bundled dependency: ' + name);
}
for (const item of provenance.packages) {
  assert.ok(item.resolved?.startsWith('https://registry.npmjs.org/'));
  assert.ok(item.integrity?.startsWith('sha512-'));
  assert.ok(item.notices.length);
  for (const notice of item.notices) assert.equal(hash(await read('generated/' + notice.path)),notice.sha256);
}
for (const file of provenance.outputs) assert.equal(hash(await read('generated/' + file.path)),file.sha256);
const iconProvenance = JSON.parse(await read('generated/icons.provenance.json'));
const icons = (await import(pathToFileURL(path.join(root,'generated/icons.js')))).icons;
const iconFiles = (await readdir(path.join(root,'vendor/tabler'))).filter(name => name.endsWith('.svg')).sort();
assert.deepEqual(iconFiles,iconProvenance.files.map(item => item.name).sort());
for (const file of iconProvenance.files) {
  const bytes = await read('vendor/tabler/' + file.name);
  assert.equal(hash(bytes),file.sha256);
  assert.equal(icons[file.name.slice(0,-4)],bytes.toString());
}
assert.match((await read('vendor/tabler/LICENSE')).toString(),/Paweł Kuna/);
console.log('PASS: fixed dependencies, lock integrity, all bundled notices/output hashes, SVG source/registry parity');
