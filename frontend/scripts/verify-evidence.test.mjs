import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { verifyEvidence } from './verify-evidence.mjs';

async function fixture(run) {
  const dir = await mkdtemp(path.join(tmpdir(), 'ipes-evidence-'));
  try {
    await mkdir(path.join(dir, 'backend-coverage/html'), { recursive: true });
    await mkdir(path.join(dir, 'frontend-coverage'), { recursive: true });
    const json = async (name, value) => writeFile(path.join(dir, name), JSON.stringify(value));
    await json('backend-coverage/coverage.json', { meta: { branch_coverage: true }, totals: { covered_lines: 10 } });
    await json('frontend-coverage/scope.json', { sources: 2, scope: 'loaded application code only' });
    for (const file of ['backend-coverage/html/index.html', 'frontend-coverage/index.html', 'requirements.html']) {
      await writeFile(path.join(dir, file), '<h1>Unit-test artifact</h1>');
    }
    await json('requirements-results.json', { requirements: [] });
    await json('actual.json', { actual: { engine: 'postgresql' } });
    const png = Buffer.from('89504e470d0a1a0a', 'hex');
    await writeFile(path.join(dir, 'screen.png'), png);
    await writeFile(path.join(dir, 'table.png'), png);
    const attachments = [
      { name: 'checkpoint-screen', path: path.join(dir, 'screen.png'), contentType: 'image/png' },
      { name: 'checkpoint-database', path: path.join(dir, 'actual.json'), contentType: 'application/json' },
      { name: 'checkpoint-database-table', path: path.join(dir, 'table.png'), contentType: 'image/png' },
    ];
    const results = { suites: [{ specs: [{ title: 'S03 unit-fixture', tests: [{ results: [{ status: 'passed', attachments }] }] }] }], stats: { unexpected: 0 } };
    await json('playwright-results.json', results);
    await run(dir, json, results);
  } finally {
    if (path.dirname(path.resolve(dir)) !== path.resolve(tmpdir()) || !path.basename(dir).startsWith('ipes-evidence-')) {
      throw new Error('Refusing cleanup outside the dedicated temporary test directory.');
    }
    await rm(dir, { recursive: true, force: true });
  }
}
test('complete PostgreSQL evidence is accepted', () => fixture(async dir => {
  assert.deepEqual(await verifyEvidence(dir), { passedScenariosWithEvidence: 1, backendCoveredLines: 10 });
}));
test('passing status cannot hide a missing database table image', () => fixture(async (dir, json, result) => {
  result.suites[0].specs[0].tests[0].results[0].attachments.pop();
  await json('playwright-results.json', result);
  await assert.rejects(verifyEvidence(dir), /missing -database-table/);
}));
test('a different database engine cannot satisfy the PostgreSQL contract', () => fixture(async (dir, json) => {
  await json('actual.json', { actual: { engine: 'sqlite' } });
  await assert.rejects(verifyEvidence(dir), /not PostgreSQL/);
}));
test('zero executed scenarios cannot be reported as a pass', () => fixture(async (dir, json) => {
  await json('playwright-results.json', { suites: [], stats: { unexpected: 0 } });
  await assert.rejects(verifyEvidence(dir), /No scenarios executed/);
}));
test('empty backend coverage cannot satisfy the report gate', () => fixture(async (dir, json) => {
  await json('backend-coverage/coverage.json', { meta: { branch_coverage: true }, totals: { covered_lines: 0 } });
  await assert.rejects(verifyEvidence(dir), /coverage is empty/);
}));
test('a skipped core scenario cannot satisfy the report gate', () => fixture(async (dir, json, result) => {
  result.suites[0].specs[0].title += ' @core';
  result.suites[0].specs[0].tests[0].results[0].status = 'skipped';
  await json('playwright-results.json', result);
  await assert.rejects(verifyEvidence(dir), /core scenario was skipped/);
}));
