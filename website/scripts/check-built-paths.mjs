import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const output = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const origin = 'https://cit-u-computer-students-society.github.io';
const base = '/IPES/';
const failures = [];
let pages = 0;
let references = 0;

async function* walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

for await (const path of walk(output)) {
  if (!path.endsWith('.html')) continue;
  pages += 1;
  const relative = path.slice(output.length + 1).replaceAll('\\', '/');
  const pageUrl = new URL(base + relative, origin);
  const html = await readFile(path, 'utf8');
  for (const match of html.matchAll(/\b(?:href|src|component-url|renderer-url)=["']([^"']+)["']/g)) {
    const value = match[1].replaceAll('&amp;', '&');
    if (value.startsWith('#') || /^(?:data|mailto|tel|javascript):/.test(value)) continue;
    const url = new URL(value, pageUrl);
    if (url.origin !== origin) continue;
    references += 1;
    if (!url.pathname.startsWith(base)) {
      failures.push(`${relative}: URL escapes the Pages base: ${value}`);
      continue;
    }
    const relativeTarget = decodeURIComponent(url.pathname.slice(base.length));
    // Astro emits its not-found page as a file rather than a route directory.
    const target = join(output, relativeTarget === '404/' ? '404.html' : relativeTarget);
    try {
      const targetStat = await stat(target);
      if (targetStat.isDirectory()) await stat(join(target, 'index.html'));
    } catch {
      failures.push(`${relative}: missing published target: ${value}`);
    }
  }
}

if (pages === 0) failures.push('No built HTML pages found.');
if (failures.length) {
  for (const failure of failures) console.error(failure);
  process.exitCode = 1;
} else {
  console.log(`Verified ${references} local references across ${pages} built pages under ${base}.`);
}
