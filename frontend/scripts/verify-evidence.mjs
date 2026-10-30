import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export async function verifyEvidence(report, { chromium = true } = {}) {
  const required = ['playwright-results.json', 'requirements-results.json', 'requirements.html',
    'backend-coverage/coverage.json', 'backend-coverage/html/index.html', 'frontend-coverage/index.html'];
  for (const file of required) {
    if (!(await stat(path.join(report, file))).size) throw new Error('Empty evidence: ' + file);
  }
  const result = JSON.parse(await readFile(path.join(report, 'playwright-results.json'), 'utf8'));
  let completed = 0;
  async function inspect(suite) {
    for (const spec of suite.specs || []) for (const test of spec.tests) for (const attempt of test.results) {
      if (attempt.status === 'skipped' && spec.title.includes('@core')) {
        throw new Error('A required core scenario was skipped: ' + spec.title);
      }
      if (attempt.status !== 'passed') continue;
      completed++;
      for (const suffix of ['-screen', '-database', '-database-table']) {
        const attachments = attempt.attachments.filter(item => item.name.endsWith(suffix) && item.path);
        if (!attachments.length) throw new Error('Passed test has missing ' + suffix + ' evidence: ' + spec.title);
        for (const item of attachments) {
          const bytes = await readFile(item.path);
          if (!bytes.length) throw new Error('Empty attachment: ' + item.path);
          if (suffix === '-database' && JSON.parse(bytes).actual.engine !== 'postgresql') {
            throw new Error('Database evidence is not PostgreSQL.');
          }
          if (item.contentType === 'image/png' && bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
            throw new Error('Invalid PNG attachment: ' + item.path);
          }
        }
      }
    }
    for (const nested of suite.suites || []) await inspect(nested);
  }
  for (const suite of result.suites) await inspect(suite);
  if (!completed && !result.stats.unexpected) throw new Error('No scenarios executed; this is not a passing run.');
  const backend = JSON.parse(await readFile(path.join(report, 'backend-coverage/coverage.json'), 'utf8'));
  if (!backend.meta.branch_coverage || !backend.totals.covered_lines) throw new Error('Backend branch coverage is empty.');
  if (chromium) {
    const scope = JSON.parse(await readFile(path.join(report, 'frontend-coverage/scope.json'), 'utf8'));
    if (!scope.sources || scope.scope !== 'loaded application code only') throw new Error('Frontend coverage scope is invalid.');
  }
  return { passedScenariosWithEvidence: completed, backendCoveredLines: backend.totals.covered_lines };
}
