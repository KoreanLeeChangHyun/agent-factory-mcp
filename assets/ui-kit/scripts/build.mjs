import './build-material-icons.mjs';
import { build } from 'esbuild';
import { readFile, writeFile, mkdir, readdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'generated');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir(output, { recursive: true });
const iconDirectory = path.join(root, 'vendor/tabler');
const iconNames = (await readdir(iconDirectory)).filter(name => name.endsWith('.svg')).sort();
const icons = {};
const iconFiles = [];
for (const name of iconNames) {
  const bytes = await readFile(path.join(iconDirectory, name));
  const source = bytes.toString();
  if (/<(?:script|foreignObject|image)\b|\bon\w+\s*=|\bhref\s*=/i.test(source)) throw new Error('Unsafe SVG: ' + name);
  icons[name.slice(0,-4)] = source;
  iconFiles.push({ name, sha256:hash(bytes), source:'https://raw.githubusercontent.com/tabler/tabler-icons/8ac7d81b72ece11072ef25ea9fd92e80c6f3c9fc/icons/outline/' + name });
}
await writeFile(path.join(output,'icons.js'), 'export const icons = ' + JSON.stringify(icons) + ';\n');
await writeFile(path.join(output,'icons.provenance.json'), JSON.stringify({ version:'3.46.0', license:'../vendor/tabler/LICENSE', files:iconFiles },null,2) + '\n');
const result = await build({
  absWorkingDir: root,
  entryPoints: ['src/vendors.js'],
  outfile: 'generated/vendors.js',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
  legalComments: 'linked',
  metafile: true,
});
const lockBytes = await readFile(path.join(root, 'package-lock.json'));
const lock = JSON.parse(lockBytes);
const packages = new Map();
for (const input of Object.keys(result.metafile.inputs)) {
  const index = input.lastIndexOf('node_modules/');
  if (index < 0) continue;
  const pieces = input.slice(index + 13).split('/');
  const name = pieces[0].startsWith('@') ? pieces.slice(0, 2).join('/') : pieces[0];
  const folder = input.slice(0, index + 13) + name;
  packages.set(folder, name);
}
const inventory = [];
for (const [folder, name] of [...packages].sort()) {
  const packageRoot = path.join(root, folder);
  const metadata = JSON.parse(await readFile(path.join(packageRoot, 'package.json')));
  const licenseFiles = (await readdir(packageRoot)).filter(name => /^(licen[cs]e|copying|notice)([.-]|$)/i.test(name));
  // These published packages carry their copyright/license notices in README.
  const readmeNotices = new Set(['@orchidjs/sifter', 'mime-match', 'wildcard']);
  if (!licenseFiles.length && readmeNotices.has(name)) licenseFiles.push('README.md');
  if (!licenseFiles.length) throw new Error('Missing license file: ' + name);
  const notices = [];
  for (const filename of licenseFiles) {
    const bytes = await readFile(path.join(packageRoot, filename));
    const destination = path.join('licenses', name.replace('/', '__'), filename);
    await mkdir(path.dirname(path.join(output, destination)), { recursive: true });
    await copyFile(path.join(packageRoot, filename), path.join(output, destination));
    notices.push({ path: destination, sha256: hash(bytes) });
  }
  inventory.push({
    name, version: metadata.version, license: metadata.license,
    repository: metadata.repository, resolved: lock.packages[folder]?.resolved,
    integrity: lock.packages[folder]?.integrity, notices,
  });
}
await writeFile(path.join(output, 'provenance.json'), JSON.stringify({
  scope: 'Bundled third-party source; product integration deferred',
  packageLockSha256: hash(lockBytes), packages: inventory,
  outputs: await Promise.all(Object.keys(result.metafile.outputs).map(async name => ({
    path: path.relative('generated', name),
    sha256: hash(await readFile(path.join(root, name))),
  }))),
}, null, 2) + '\n');
console.log('Built vendors and preserved notices for ' + inventory.length + ' bundled packages.');
