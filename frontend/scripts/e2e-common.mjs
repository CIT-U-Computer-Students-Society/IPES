import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const backend = resolve(frontend, '../backend');
export const python = process.env.IPES_TEST_PYTHON || (existsSync(resolve(backend, '.venv/Scripts/python.exe'))
  ? resolve(backend, '.venv/Scripts/python.exe') : existsSync(resolve(backend, '.venv/bin/python'))
    ? resolve(backend, '.venv/bin/python') : process.platform === 'win32' ? 'python' : 'python3');

export function execute(command, args, { cwd = backend, env = process.env, output, signal } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, env, signal, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; if (output) output.write(chunk); });
    child.stderr.on('data', chunk => { stderr += chunk; if (output) output.write(chunk); });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolvePromise(stdout) : reject(new Error(
      command + ' ' + args.join(' ') + ' exited ' + code + '\n' + stderr + (output ? '' : '\n' + stdout))));
  });
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
