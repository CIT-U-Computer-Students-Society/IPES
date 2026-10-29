import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import v8toIstanbul from 'v8-to-istanbul';
import libCoverage from 'istanbul-lib-coverage';
import libReport from 'istanbul-lib-report';
import reports from 'istanbul-reports';
import { frontend } from './e2e-common.mjs';

export async function reportBrowserCoverage(report) {
  const map = libCoverage.createCoverageMap({});
  let mapped = 0;
  for (const file of await readdir(resolve(report, 'browser-raw'))) {
    const entries = JSON.parse(await readFile(resolve(report, 'browser-raw', file), 'utf8'));
    for (const entry of entries) {
      if (!entry.url.startsWith('http://127.0.0.1:5175/assets/') || !entry.url.endsWith('.js')) continue;
      const jsPath = resolve(frontend, 'dist-e2e/assets', basename(new URL(entry.url).pathname));
      const source = await readFile(jsPath, 'utf8');
      const sourcemap = JSON.parse(await readFile(jsPath + '.map', 'utf8'));
      const converter = v8toIstanbul(jsPath, 0, { source, sourceMap: { sourcemap } },
        path => !path.replaceAll('\\', '/').includes('/src/') || path.includes('node_modules'));
      await converter.load(); converter.applyCoverage(entry.functions); map.merge(converter.toIstanbul());
      mapped++;
    }
  }
  if (!mapped || !map.files().length) throw new Error('No original frontend application sources mapped from browser coverage.');
  const dir = resolve(report, 'frontend-coverage');
  await mkdir(dir, { recursive: true });
  const context = libReport.createContext({ dir, coverageMap: map });
  for (const type of ['html', 'lcovonly', 'json-summary', 'json']) reports.create(type).execute(context);
  await writeFile(resolve(dir, 'scope.json'), JSON.stringify({
    scope: 'loaded application code only', browser: 'chromium', sources: map.files().length,
    note: 'Unloaded source files are outside this denominator. No whole-application coverage gate is applied.',
  }, null, 2));
}
