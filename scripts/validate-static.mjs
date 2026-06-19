import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const ignored = new Set(['.git', 'node_modules', 'coverage', 'test-results', 'playwright-report']);
const files = [];

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    if (ignored.has(entry)) {
      continue;
    }

    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      walk(path);
    } else {
      files.push(path);
    }
  }
}

walk(root);

const jsFiles = files.filter((file) => ['.js', '.mjs'].includes(extname(file)));
const jsonFiles = files.filter((file) => extname(file) === '.json');

for (const file of jsFiles) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
}

for (const file of jsonFiles) {
  JSON.parse(readFileSync(file, 'utf8'));
}

const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
if (manifest.version !== '1.0.0') {
  throw new Error(`Expected manifest version 1.0.0, received ${manifest.version}.`);
}

console.log(`Static validation passed (${jsFiles.length} scripts, ${jsonFiles.length} JSON files).`);
console.log(`Manifest: ${manifest.name} ${manifest.version}`);
