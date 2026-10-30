import type { Reporter, TestCase, TestResult, FullResult } from '@playwright/test/reporter';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { escapeHtml } from '../../scripts/e2e-common.mjs';

type Requirement = { id: string; text: string; scenarios: string[]; coverage: string; lifecycle: string };

export default class RequirementsReporter implements Reporter {
  private results: { scenario: string; title: string; project: string; status: string; attachments: string[]; error?: string }[] = [];
  onTestEnd(test: TestCase, result: TestResult) {
    this.results.push({
      scenario: /S\d{2}/.exec(test.title)?.[0] || 'unknown', title: test.title,
      project: test.parent.project()!.name, status: result.status,
      attachments: result.attachments.filter(item => item.path).map(item => item.path!),
      error: result.error?.message,
    });
  }
  onEnd(result: FullResult) {
    const dir = process.env.IPES_E2E_REPORT_DIR;
    if (!dir) return;
    mkdirSync(dir, { recursive: true });
    const raw = readFileSync(path.resolve('../docs/testing/requirements.json'), 'utf8');
    const registry: { requirements: Requirement[] } = JSON.parse(raw);
    const requirements = registry.requirements.map(requirement => {
      const attempts = this.results.filter(item => requirement.scenarios.includes(item.scenario));
      const executed = requirement.scenarios.every(scenario => attempts.some(item => item.scenario === scenario));
      const status = !attempts.length ? 'unverified' : attempts.some(item => ['failed', 'timedOut', 'interrupted'].includes(item.status)) ? 'failed' :
        attempts.some(item => item.status === 'skipped') ? 'skipped' :
          executed && requirement.coverage === 'complete' ? 'satisfied' : 'partial';
      return { ...requirement, status, attempts };
    });
    const summary = {
      verdict: result.status, registryHash: createHash('sha256').update(raw).digest('hex'),
      projects: [...new Set(this.results.map(item => item.project))],
      total: requirements.length, mapped: requirements.filter(item => item.scenarios.length).length,
      executed: requirements.filter(item => item.attempts.length).length,
      satisfied: requirements.filter(item => item.status === 'satisfied').length,
      requirements,
    };
    writeFileSync(path.join(dir, 'requirements-results.json'), JSON.stringify(summary, null, 2));
    writeFileSync(path.join(dir, 'requirements.html'), '<!doctype html><meta charset="utf-8"><title>IPES requirements</title><h1>Requirements evidence</h1>' +
      '<p>Selected browser projects: ' + escapeHtml(summary.projects.join(', ')) + '. Whole-browser support is not inferred.</p>' +
      '<p>All listed requirements: ' + summary.total + '; mapped: ' + summary.mapped + '; executed: ' + summary.executed +
      '; satisfied: ' + summary.satisfied + '. Partial coverage is not satisfaction.</p><table border="1" cellpadding="8"><tr><th>ID</th><th>Requirement</th><th>Status</th><th>Evidence</th></tr>' +
      requirements.map(item => '<tr><td>' + escapeHtml(item.id) + '</td><td>' + escapeHtml(item.text) + '</td><td>' + item.status +
        '</td><td>' + item.attempts.map(attempt => escapeHtml(attempt.scenario + ' / ' + attempt.project + ': ' + attempt.status) + '<br>' +
          attempt.attachments.map(file => '<a href="' + escapeHtml(path.relative(dir, file).replaceAll('\\', '/')) + '">' +
            escapeHtml(path.basename(file)) + '</a>').join('<br>')).join('<hr>') + '</td></tr>').join('') + '</table>');
  }
}
