// Sets the app version everywhere it is recorded: node .github/scripts/set-version.mjs 0.3.0
import { readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  console.error(`Version must look like 1.2.3, got "${version}"`);
  process.exit(1);
}

const edit = (path, fn) => writeFileSync(path, fn(readFileSync(path, 'utf8')));

edit('package.json', (s) => s.replace(/("version":\s*")[^"]+(")/, `$1${version}$2`));
edit('package-lock.json', (s) => {
  const lock = JSON.parse(s);
  lock.version = version;
  lock.packages[''].version = version;
  return JSON.stringify(lock, null, 2) + '\n';
});
edit('extension/manifest.json', (s) => s.replace(/("version":\s*")[^"]+(")/, `$1${version}$2`));
edit('src-tauri/Cargo.toml', (s) => s.replace(/^version = "[^"]+"/m, `version = "${version}"`));
edit('src-tauri/Cargo.lock', (s) => s.replace(/(name = "didebaan"\nversion = ")[^"]+(")/, `$1${version}$2`));
console.log(`Version set to ${version}`);
