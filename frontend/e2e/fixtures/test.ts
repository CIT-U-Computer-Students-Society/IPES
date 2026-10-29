import { test as base, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { seed, snapshot, type Fixture, type Snapshot } from '../helpers/database';
import { escapeHtml } from '../../scripts/e2e-common.mjs';
import { registerCoverage } from '../helpers/coverage';

export const test = base.extend<{
  fixture: Fixture;
  evidence: (name: string, expectations?: unknown) => Promise<Snapshot>;
}>({
  page: async ({ page, browserName }, provide, testInfo) => {
    const collect = browserName === 'chromium';
    const session = collect ? await page.context().newCDPSession(page) : null;
    const save = async () => {
      if (!session || page.isClosed()) return;
      const { result: entries } = await session.send('Profiler.takePreciseCoverage');
      const dir = path.join(process.env.IPES_E2E_REPORT_DIR!, 'browser-raw');
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, randomUUID() + '.json'), JSON.stringify(entries));
    };
    if (session) {
      await session.send('Profiler.enable');
      await session.send('Profiler.startPreciseCoverage', { detailed: true, callCount: true });
      registerCoverage(page, save);
      const goto = page.goto.bind(page), reload = page.reload.bind(page);
      page.goto = async (...args) => { await save(); return goto(...args); };
      page.reload = async (...args) => { await save(); return reload(...args); };
    }
    // Third-party font availability must not stall the isolated test stack.
    await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
    try { await provide(page); } finally {
      try {
        await page.unrouteAll({ behavior: 'wait' });
        await save();
        if (session) { await session.send('Profiler.stopPreciseCoverage'); await session.detach(); }
      } catch (error) {
        await testInfo.attach('coverage-error', { body: String(error), contentType: 'text/plain' });
        expect.soft(error, 'Browser coverage capture failed').toBeUndefined();
      }
    }
  },
  fixture: async ({ browserName }, provide, testInfo) => {
    const scenario = /S\d{2}/.exec(testInfo.title)?.[0];
    if (!scenario) throw new Error('Every browser scenario needs a stable Sxx ID.');
    await provide(await seed(scenario, testInfo.project.name + '-' + scenario + '-' + randomUUID()));
  },
  evidence: async ({ page, browser, fixture }, provide, testInfo) => {
    let previous: Snapshot | null = null;
    await provide(async (name, expectations = null) => {
      const data = await snapshot(fixture.organization.id);
      expect(data.engine).toBe('postgresql');
      const json = testInfo.outputPath(name + '-database.json');
      const changedTables = (Object.keys(data) as (keyof Snapshot)[]).filter(key => Array.isArray(data[key]) &&
        JSON.stringify(previous?.[key]) !== JSON.stringify(data[key]));
      await writeFile(json, JSON.stringify({ before: previous, actual: data, expectations, changedTables }, null, 2));
      previous = data;
      await testInfo.attach(name + '-database', { path: json, contentType: 'application/json' });
      const ui = testInfo.outputPath(name + '-screen.png');
      await page.screenshot({ path: ui, fullPage: true, timeout: 5000 });
      await testInfo.attach(name + '-screen', { path: ui, contentType: 'image/png' });
      // A distinct context keeps this renderer out of application execution coverage.
      const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
      try {
        const table = await context.newPage();
        const sections = Object.entries(data).flatMap(([key, value]) =>
          Array.isArray(value) ? [[key, value] as [string, Record<string, unknown>[]]] : []);
        await table.setContent('<!doctype html><meta charset="utf-8"><style>body{font:14px system-ui;padding:24px}table{border-collapse:collapse;margin-bottom:24px}td,th{border:1px solid #aaa;padding:6px;text-align:left;max-width:500px;overflow-wrap:anywhere}h1{font-size:24px}</style>' +
          '<h1>Actual PostgreSQL snapshot: ' + escapeHtml(name) + '</h1><p>Organization ' + fixture.organization.id +
          ' · ' + escapeHtml(data.capturedAt) + ' · PostgreSQL ' + escapeHtml(data.serverVersion) +
          '</p><h2>Expected assertions</h2><pre>' + escapeHtml(JSON.stringify(expectations, null, 2)) + '</pre>' +
          sections.map(([key, rows]) => '<h2>' + escapeHtml(key) + '</h2><table>' +
            (rows.length ? '<tr>' + Object.keys(rows[0]).map(key => '<th>' + escapeHtml(key) + '</th>').join('') + '</tr>' +
              rows.map(row => '<tr>' + Object.values(row).map(value => '<td>' + escapeHtml(JSON.stringify(value)) + '</td>').join('') + '</tr>').join('') : '<tr><td>No rows</td></tr>') + '</table>').join(''));
        const png = testInfo.outputPath(name + '-database.png');
        await table.screenshot({ path: png, fullPage: true });
        await testInfo.attach(name + '-database-table', { path: png, contentType: 'image/png' });
      } finally { await context.close(); }
      return data;
    });
  },
});
test.afterEach(async ({ evidence }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    try { await evidence('failure'); } catch (error) {
      await testInfo.attach('missing-evidence', { body: String(error), contentType: 'text/plain' });
    }
  }
});
export { expect };
