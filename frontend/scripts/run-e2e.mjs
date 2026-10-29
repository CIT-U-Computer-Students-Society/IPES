import { spawn, execFileSync } from 'node:child_process';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, writeFile, readFile, rm, cp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import net from 'node:net';
import { backend, frontend, python, execute, escapeHtml } from './e2e-common.mjs';
import { reportBrowserCoverage } from './report-browser-coverage.mjs';
import { verifyEvidence } from './verify-evidence.mjs';

const runId = Date.now().toString(36) + '_' + randomBytes(4).toString('hex');
const database = 'ipes_e2e_' + runId;
const token = randomBytes(16).toString('hex');
const projectArgument = process.argv.find(arg => arg.startsWith('--project='));
const projectIndex = process.argv.indexOf('--project');
const requestedProject = projectArgument?.slice('--project='.length) || (projectIndex >= 0 ? process.argv[projectIndex + 1] : 'chromium');
const expectBrowserCoverage = process.argv.includes('--all') || requestedProject.includes('chromium');
const runtime = resolve(backend, '.e2e', database);
const report = resolve(frontend, 'e2e-artifacts', runId);
const env = { ...process.env, IPES_E2E: '1', IPES_E2E_DATABASE: database, IPES_E2E_TOKEN: token,
  IPES_TEST_RUN_ID: runId, IPES_E2E_REPORT_DIR: report, IPES_E2E_RUNTIME: runtime,
  DJANGO_SETTINGS_MODULE: 'IPES.settings_e2e', VITE_API_BASE_URL: '/api' };
if (process.argv.includes('--all')) env.IPES_E2E_EXPANDED = '1';
let server, preview, provisioned = false, failed = false;
const failures = [];
const streams = [];
const cancellation = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => cancellation.abort(new Error('Run interrupted by ' + signal)));
}
const ended = child => !child || child.exitCode !== null || child.signalCode !== null;
await mkdir(report, { recursive: true });
const log = name => { const stream = createWriteStream(resolve(report, name + '.log')); streams.push(stream); return stream; };
function start(command, args, cwd, stream) {
  const child = spawn(command, args, { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.pipe(stream, { end: false }); child.stderr.pipe(stream, { end: false });
  child.on('error', error => { failures.push(error.message); failed = true; });
  return child;
}
async function waitFor(url, child) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('Server exited before readiness: ' + url);
    try { if ((await fetch(url)).ok) return; } catch { /* startup */ }
    await new Promise(resolvePromise => setTimeout(resolvePromise, 250));
  }
  throw new Error('Server readiness timed out: ' + url);
}
async function freePort(port) {
  await new Promise((resolvePromise, reject) => {
    const socket = net.createServer();
    socket.once('error', reject);
    socket.listen(port, '127.0.0.1', () => socket.close(resolvePromise));
  });
}
async function stopped(child, timeout = 15000) {
  if (ended(child)) return;
  await new Promise((resolvePromise, reject) => {
    const timer = setTimeout(() => reject(new Error('Process did not stop; database retained for exact-run cleanup')), timeout);
    child.once('exit', () => { clearTimeout(timer); resolvePromise(); });
  });
}
try {
  await freePort(8001); await freePort(5175);
  // Provisioning must not import E2E settings before the database exists.
  const provisionEnv = { ...env, DJANGO_SETTINGS_MODULE: 'IPES.settings_test' };
  await execute(python, ['scripts/test_database.py', 'create', '--name', database, '--token', token], { env: provisionEnv });
  provisioned = true;
  await mkdir(runtime, { recursive: true });
  await writeFile(resolve(runtime, 'owner'), token, { flag: 'wx' });
  await writeFile(resolve(report, 'provenance.json'), JSON.stringify({
    runId, database, engine: 'postgresql', revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: backend }).toString().trim(),
    dirtyWorktree: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: backend }).toString().trim()),
    startedAt: new Date().toISOString(),
  }, null, 2));
  await execute(python, ['manage.py', 'migrate', '--noinput'], { env, output: log('migrate'), signal: cancellation.signal });
  await execute(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--mode', 'e2e'], { cwd: frontend, env, output: log('build'), signal: cancellation.signal });
  server = start(python, ['manage.py', 'run_e2e_server', '--runtime', runtime], backend, log('backend'));
  preview = start(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--mode', 'e2e', '--host', '127.0.0.1',
    '--port', '5175', '--strictPort'], frontend, log('preview'));
  await Promise.all([waitFor('http://127.0.0.1:8001/api/', server), waitFor('http://127.0.0.1:5175/', preview)]);
  const forwarded = process.argv.slice(2).filter(arg => arg !== '--all');
  if (!process.argv.includes('--all') && !forwarded.some(arg => arg.startsWith('--project'))) forwarded.push('--project=chromium');
  await execute(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', ...forwarded], { cwd: frontend, env, output: process.stdout, signal: cancellation.signal });
} catch (error) {
  failed = true; failures.push(error.message); console.error(error.message);
} finally {
  const stoppedProcesses = await Promise.allSettled([
    (async () => { if (server) { await writeFile(resolve(runtime, 'stop'), 'stop'); await stopped(server); } })(),
    (async () => { if (preview) { preview.kill(); await stopped(preview); } })(),
  ]);
  for (const result of stoppedProcesses) if (result.status === 'rejected') {
    failed = true; failures.push('Shutdown: ' + result.reason.message);
  }
  try {
    if (server) {
      const coverage = resolve(runtime, 'coverage/coverage.json');
      if (!existsSync(coverage)) throw new Error('Backend E2E coverage was not saved.');
      await cp(resolve(runtime, 'coverage'), resolve(report, 'backend-coverage'), { recursive: true });
    }
    if (existsSync(resolve(report, 'browser-raw'))) await reportBrowserCoverage(report);
    else if (server && expectBrowserCoverage) throw new Error('Browser coverage is missing.');
    else if (server) {
      await mkdir(resolve(report, 'frontend-coverage'), { recursive: true });
      await writeFile(resolve(report, 'frontend-coverage/index.html'),
        '<!doctype html><h1>Frontend execution coverage unavailable</h1><p>Native coverage is collected only for Chromium. Behavioral checks still run for this browser.</p>');
    }
    if (server) {
      const integrity = await verifyEvidence(report, { chromium: expectBrowserCoverage });
      await writeFile(resolve(report, 'evidence-integrity.json'), JSON.stringify(integrity, null, 2));
    }
  } catch (error) { failed = true; failures.push(error.message); }
  try {
    if (provisioned && ended(server)) {
      await execute(python, ['scripts/test_database.py', 'drop', '--name', database, '--token', token],
        { env: { ...env, DJANGO_SETTINGS_MODULE: 'IPES.settings_test' } });
      if (existsSync(resolve(runtime, 'owner')) && (await readFile(resolve(runtime, 'owner'), 'utf8')) === token
          && resolve(runtime).startsWith(resolve(backend, '.e2e') + (process.platform === 'win32' ? '\\' : '/'))) {
        await rm(runtime, { recursive: true });
      }
    } else if (provisioned) throw new Error('Active server: database retained; run marker preserved.');
  } catch (error) { failed = true; failures.push('Cleanup: ' + error.message); }
  await writeFile(resolve(report, 'run-status.json'), JSON.stringify({ runId, failed, failures }, null, 2));
  const links = ['playwright/index.html', 'requirements.html', 'backend-coverage/html/index.html', 'frontend-coverage/index.html'];
  await writeFile(resolve(report, 'index.html'), '<!doctype html><meta charset="utf-8"><title>IPES test evidence</title>' +
    '<h1>IPES test evidence</h1><p>Run ' + escapeHtml(runId) + ': ' + (failed ? 'FAILED' : 'PASSED') +
    '</p><ul>' + links.map(href => '<li><a href="' + href + '">' + escapeHtml(href) + '</a></li>').join('') +
    '</ul><pre>' + escapeHtml(failures.join('\n')) + '</pre>');
  for (const stream of streams) stream.end();
  console.log('Evidence: ' + resolve(report, 'index.html'));
  process.exitCode = failed ? 1 : 0;
}
