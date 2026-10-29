import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { frontend, execute } from './e2e-common.mjs';

const schema = z.object({
  schemaVersion: z.literal(1), source: z.string(), sourceHash: z.string().length(64),
  requirements: z.array(z.object({
    id: z.string().regex(/^(F\d{2}|X|A)-(FR|NFR)\d{2}$/), text: z.string().min(1),
    lifecycle: z.enum(['proposed', 'approved', 'advertised-unconfirmed']),
    coverage: z.enum(['complete', 'partial', 'unmapped']),
    scenarios: z.array(z.string().regex(/^S\d{2}$/)),
    criteria: z.array(z.object({ id: z.string(), scenario: z.string(), expected: z.string().min(1) })),
  })).min(1),
});
const registry = schema.parse(JSON.parse(await readFile(resolve(frontend, '../docs/testing/requirements.json'), 'utf8')));
const source = (await readFile(resolve(frontend, '..', registry.source), 'utf8')).replaceAll('\r\n', '\n');
if (createHash('sha256').update(source).digest('hex') !== registry.sourceHash) throw new Error('Requirement source changed; reconcile the registry.');
const ids = registry.requirements.map(item => item.id);
if (new Set(ids).size !== ids.length) throw new Error('Duplicate requirement IDs.');
const listed = JSON.parse(await execute(process.execPath, [
  'node_modules/@playwright/test/cli.js', 'test', '--list', '--project=chromium', '--grep=@core|@expanded', '--reporter=json',
], { cwd: frontend, env: { ...process.env, IPES_E2E_EXPANDED: '1' } }));
const discovered = new Set();
function inspect(suite) {
  for (const spec of suite.specs || []) {
    const id = /S\d{2}/.exec(spec.title)?.[0];
    if (!id) throw new Error('A browser test has no scenario ID: ' + spec.title);
    discovered.add(id);
  }
  for (const child of suite.suites || []) inspect(child);
}
for (const suite of listed.suites) inspect(suite);
for (const item of registry.requirements) {
  if ((item.coverage === 'unmapped') !== !item.scenarios.length) throw new Error('Inconsistent mapping: ' + item.id);
  if (new Set(item.criteria.map(criterion => criterion.id)).size !== item.criteria.length) throw new Error('Duplicate criteria: ' + item.id);
  for (const scenario of item.scenarios) {
    if (!discovered.has(scenario)) throw new Error('Undiscoverable scenario ' + scenario + ' for ' + item.id);
    if (!item.criteria.some(criterion => criterion.scenario === scenario)) throw new Error('Missing criterion for ' + scenario);
  }
}
for (const id of discovered) {
  if (!registry.requirements.some(item => item.scenarios.includes(id))) throw new Error('Unmapped browser scenario: ' + id);
}
console.log('Validated ' + ids.length + ' requirements and ' + discovered.size + ' discoverable scenarios.');
