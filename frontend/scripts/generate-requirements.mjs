import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { frontend } from './e2e-common.mjs';

const source = 'docs/testing/requirements_traceability_matrix.md';
const document = (await readFile(resolve(frontend, '..', source), 'utf8')).replaceAll('\r\n', '\n');
const criteria = {
  S01: 'Sign in through the UI, read the current profile, select the expected organization, then sign out. The old session must receive 401/403 and the organization snapshot must contain zero active sessions.',
  S02: 'Create one form and rating question through the UI, activate it and generate exactly six unique non-self evaluator pairs for three members. Repeating generation must retain the same six pairs.',
  S03: 'Save ratings 2 and 4 as a draft, reload and retain them, then submit. Exactly two response rows, Completed status, a submission timestamp and weighted score 3.5 must be committed; the UI must become read-only.',
  S04: 'The evaluatee aggregate must be absent before release. An admin releases through the UI; PostgreSQL must record released/inactive flags, preserve score 3.5 and audit history, and the evaluatee UI must then show 3.5.',
  S05: 'A member creates an accomplishment in the UI with Pending state. An admin rejects it with feedback; PostgreSQL must retain the reviewer, Rejected status and exact feedback, and the member must find it in the Rejected tab.',
  S06: 'Organization switching must remove the other organization form from the screen. A member attempting a mutation in an unauthorized organization must receive 403/404 and leave that organization snapshot unchanged.',
  S07: 'An outsider submits a valid join code through the UI. Exactly one Pending join request for that user must be committed under the target organization.',
  S08: 'With 21 persisted forms, UI search must locate the oldest form beyond the first API page.',
  S09: 'UI deletion must hide the form while PostgreSQL retains its deleted/inactive row, questions, assignments and an additional audit event.',
  S10: 'Tab from the email input must focus the password input. The login screen must have zero violations in the selected automated WCAG 2.1 AA axe checks; this does not establish manual accessibility.',
  S11: 'Abort the real portfolio read deliberately. The UI must show a load error instead of an empty-state success, and persisted accomplishments must remain unchanged.',
};
const requirements = [];
for (const line of document.split('\n')) {
  const match = /^\| ((?:F\d{2}|X|A)-(?:FR|NFR)\d{2}) \|\s*(.*?)\s*\|/.exec(line);
  if (!match) continue;
  const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
  const id = match[1], scenarios = cells[2].match(/S\d{2}/g) || [];
  const advertised = id.startsWith('A-');
  requirements.push({
    id, text: match[2], lifecycle: advertised ? 'advertised-unconfirmed' : 'proposed',
    coverage: cells[3] === 'Complete' ? 'complete' : scenarios.length ? 'partial' : 'unmapped',
    scenarios,
    criteria: scenarios.map(scenario => ({ id: id + '-' + scenario, scenario,
      expected: criteria[scenario] })),
  });
}
if (!requirements.length) throw new Error('No requirement IDs found.');
const registry = { schemaVersion: 1, source, sourceHash: createHash('sha256').update(document).digest('hex'), requirements };
await mkdir(resolve(frontend, '../docs/testing'), { recursive: true });
await writeFile(resolve(frontend, '../docs/testing/requirements.json'), JSON.stringify(registry, null, 2) + '\n');
console.log('Wrote ' + requirements.length + ' requirements. Review criteria and mappings before committing.');
