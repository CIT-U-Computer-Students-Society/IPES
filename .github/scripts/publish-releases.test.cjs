const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const publish = require('./publish-releases.cjs');

const root = path.resolve(__dirname, '../..');
const config = JSON.parse(readFileSync(path.join(root, 'release-please-config.json')));

function fixture({ status = 'ahead', changed = ['frontend'], existing = [], failTag } = {}) {
  const calls = { created: [], labelled: [], removed: [], read: [] };
  const before = { frontend: '0.0.0', backend: '0.0.0', docs: '0.0.0' };
  const after = { ...before, ...Object.fromEntries(changed.map(key => [key, '0.1.0'])) };
  const pr = {
    merged_at: '2026-10-28T00:00:00Z', merge_commit_sha: 'release-sha',
    base: { ref: 'main' },
    head: { ref: 'release-please--branches--main', repo: { full_name: 'org/IPES' } },
  };
  const issues = [{ number: 12, pull_request: {} }];
  const args = {
    context: { ref: 'refs/heads/main', sha: 'production-sha', repo: { owner: 'org', repo: 'IPES' } },
    core: { info() {} },
    read(ref, file) {
      calls.read.push([ref, file]);
      if (file === 'release-please-config.json') return JSON.stringify(config);
      if (file === '.release-please-manifest.json') return JSON.stringify(ref.endsWith('^1') ? before : after);
      return '# Changelog\n\n## [0.1.0](https://example.com/compare) (2026-10-28)\n\n### Features\n\n* added feature\n\n## 0.0.0\n\nOld notes\n';
    },
    github: {
      async paginate() { return issues; },
      rest: {
        pulls: { async get() { return { data: pr }; } },
        repos: {
          async compareCommitsWithBasehead(input) {
            assert.equal(input.basehead, 'release-sha...production-sha');
            return { data: { status } };
          },
          async getReleaseByTag({ tag }) {
            if (existing.includes(tag)) return { data: {} };
            throw Object.assign(new Error('Not found'), { status: 404 });
          },
          async createRelease(input) {
            if (input.tag_name === failTag) throw new Error('GitHub unavailable');
            calls.created.push(input);
          },
        },
        issues: {
          listForRepo() {},
          async addLabels(input) { calls.labelled.push(input); },
          async removeLabel(input) { calls.removed.push(input); },
        },
      },
    },
  };
  return { args, calls, pr, issues };
}

test('configuration keeps independent components and synchronized starting versions', () => {
  const manifest = JSON.parse(readFileSync(path.join(root, '.release-please-manifest.json')));
  assert.equal(config['separate-pull-requests'], false);
  assert.equal(config['group-pull-request-title-pattern'], 'Release components on ${branch}');
  assert.equal(config['include-component-in-tag'], true);
  assert.equal(config['tag-separator'], '-');
  assert.deepEqual(Object.keys(config.packages).sort(), ['backend', 'docs', 'frontend']);
  assert.deepEqual(Object.values(config.packages).map(pkg => pkg.component).sort(), ['backend', 'docs', 'web']);
  for (const [directory, pkg] of Object.entries(config.packages)) {
    const version = pkg['release-type'] === 'node'
      ? JSON.parse(readFileSync(path.join(root, directory, 'package.json'))).version
      : readFileSync(path.join(root, directory, 'version.txt'), 'utf8').trim();
    assert.equal(manifest[directory], version);
    assert.ok(readFileSync(path.join(root, directory, pkg['changelog-path']), 'utf8').startsWith('# '));
  }
  const lock = JSON.parse(readFileSync(path.join(root, 'frontend/package-lock.json')));
  assert.equal(lock.version, manifest.frontend);
  assert.equal(lock.packages[''].version, manifest.frontend);
  assert.ok(config['changelog-sections'].some(section => section.type === 'docs' && !section.hidden));
});

test('release PRs target main after publication and validation covers main', () => {
  const workflow = readFileSync(path.join(root, '.github/workflows/release-please.yml'), 'utf8');
  assert.match(workflow, /branches: \[main\]/);
  assert.match(workflow, /release-prs:\s+needs: publish-releases\s+if: github.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /target-branch: main/);
  assert.doesNotMatch(workflow, /target-branch: dev/);
  assert.match(config['pull-request-header'], /PR into `main`/);
  const validation = readFileSync(path.join(root, '.github/workflows/pr-validate.yml'), 'utf8');
  assert.match(validation, /branches:\s+- dev\s+- main/);
});

test('main branch policy admits same-repository promotion and release PRs only', () => {
  const workflow = readFileSync(path.join(root, '.github/workflows/pr-branch-check.yml'), 'utf8');
  const script = workflow.split('script: |')[1];
  const check = new Function('context', 'core', script);
  for (const [branch, repo, allowed] of [
    ['dev', 'org/IPES', true],
    ['release-please--branches--main', 'org/IPES', true],
    ['feat/unrelated', 'org/IPES', false],
    ['release-please--branches--dev', 'org/IPES', false],
    ['release-please--branches--main--unexpected', 'org/IPES', false],
    ['release-please--branches--main', 'fork/IPES', false],
    ['dev', 'fork/IPES', false],
  ]) {
    let failed = false;
    check({ payload: { pull_request: {
      head: { ref: branch, repo: { full_name: repo } },
      base: { repo: { full_name: 'org/IPES' } },
    } } }, { setFailed() { failed = true; }, info() {} });
    assert.equal(!failed, allowed, `${repo}:${branch}`);
  }
});

test('already merged combined dev releases remain publishable after promotion', async () => {
  const { args, calls, pr } = fixture();
  pr.base.ref = 'dev';
  pr.head.ref = 'release-please--branches--dev';
  await publish(args);
  assert.equal(calls.created.length, 1);
});

test('publishes only the changed web component at its promoted release commit', async () => {
  const { args, calls } = fixture();
  await publish(args);
  assert.deepEqual(calls.created.map(release => release.tag_name), ['web-v0.1.0']);
  assert.equal(calls.created[0].target_commitish, 'release-sha');
  assert.equal(calls.created[0].make_latest, 'false');
  assert.equal(calls.created[0].body, '### Features\n\n* added feature');
  assert.equal(calls.removed.length, 1);
});

test('backend and documentation can publish without releasing web', async () => {
  for (const component of ['backend', 'docs']) {
    const { args, calls } = fixture({ changed: [component] });
    await publish(args);
    assert.deepEqual(calls.created.map(release => release.tag_name), [`${component}-v0.1.0`]);
  }
});

test('multiple promoted version changes produce separate releases', async () => {
  const { args, calls } = fixture({ changed: ['frontend', 'backend', 'docs'] });
  await publish(args);
  assert.deepEqual(calls.created.map(release => release.tag_name), ['web-v0.1.0', 'backend-v0.1.0', 'docs-v0.1.0']);
});

test('legacy component PRs remain publishable during migration to a combined PR', async () => {
  const { args, calls, pr } = fixture({ changed: ['docs'] });
  pr.base.ref = 'dev';
  pr.head.ref = 'release-please--branches--dev--components--docs';
  await publish(args);
  assert.deepEqual(calls.created.map(release => release.tag_name), ['docs-v0.1.0']);
  assert.equal(calls.removed.length, 1);
});

test('ahead-of-main and diverged dev releases remain pending', async () => {
  for (const status of ['behind', 'diverged']) {
    const { args, calls } = fixture({ status });
    await publish(args);
    assert.equal(calls.created.length, 0);
    assert.equal(calls.labelled.length, 0);
  }
});

test('a release commit identical to main is publishable', async () => {
  const { args, calls } = fixture({ status: 'identical' });
  await publish(args);
  assert.equal(calls.created.length, 1);
});

test('reruns recover partial publication without duplicating existing releases', async () => {
  const { args, calls } = fixture({ changed: ['frontend', 'docs'], existing: ['web-v0.1.0'] });
  await publish(args);
  assert.deepEqual(calls.created.map(release => release.tag_name), ['docs-v0.1.0']);
  assert.deepEqual(calls.labelled[0].labels, ['autorelease: tagged']);
});

test('API failures keep pending labels for retry', async () => {
  const { args, calls } = fixture({ changed: ['frontend', 'docs'], failTag: 'docs-v0.1.0' });
  await assert.rejects(publish(args), /GitHub unavailable/);
  assert.equal(calls.created.length, 1);
  assert.equal(calls.labelled.length, 0);
  assert.equal(calls.removed.length, 0);
});

test('a retry after label permission failure reuses the release and finalizes labels', async () => {
  const first = fixture();
  first.args.github.rest.issues.addLabels = async () => {
    throw Object.assign(new Error('Resource not accessible by integration'), { status: 403 });
  };
  await assert.rejects(publish(first.args), /Resource not accessible/);
  assert.deepEqual(first.calls.created.map(release => release.tag_name), ['web-v0.1.0']);
  assert.equal(first.calls.removed.length, 0);

  const retry = fixture({ existing: ['web-v0.1.0'] });
  await publish(retry.args);
  assert.equal(retry.calls.created.length, 0);
  assert.deepEqual(retry.calls.labelled[0].labels, ['autorelease: tagged']);
  assert.equal(retry.calls.removed[0].name, 'autorelease: pending');
});

test('permission and server errors are not treated as absent releases', async () => {
  const { args, calls } = fixture();
  args.github.rest.repos.getReleaseByTag = async () => {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  };
  await assert.rejects(publish(args), /Forbidden/);
  assert.equal(calls.created.length, 0);
  assert.equal(calls.removed.length, 0);
});

test('ignores issues, unmerged PRs, foreign branches, forks and other targets', async () => {
  for (const mutation of [
    f => { delete f.issues[0].pull_request; },
    f => { f.pr.merged_at = null; },
    f => { f.pr.base.ref = 'feature'; },
    f => { f.pr.head.ref = 'feat/unrelated'; },
    f => { f.pr.head.ref = 'release-please--branches--development'; },
    f => { f.pr.head.ref = 'release-please--branches--dev'; },
    f => { f.pr.head.repo.full_name = 'fork/IPES'; },
  ]) {
    const f = fixture();
    mutation(f);
    await publish(f.args);
    assert.equal(f.calls.created.length, 0);
    assert.equal(f.calls.labelled.length, 0);
  }
});

test('refuses production publication from dev', async () => {
  const { args } = fixture();
  args.context.ref = 'refs/heads/dev';
  await assert.rejects(publish(args), /must run on main/);
});

test('invalid manifests and absent release notes fail before any publication', async () => {
  for (const bad of ['version', 'changelog', 'unchanged']) {
    const { args, calls } = fixture({ changed: bad === 'unchanged' ? [] : ['frontend', 'docs'] });
    const original = args.read;
    args.read = (ref, file) => {
      if (bad === 'changelog' && file === 'docs/CHANGELOG.md') return '# No releases';
      if (bad === 'version' && ref === 'release-sha' && file === '.release-please-manifest.json') {
        return JSON.stringify({ frontend: '0.1.0', backend: '0.0.0', docs: 'invalid' });
      }
      return original(ref, file);
    };
    await assert.rejects(publish(args), /Invalid release version|Missing changelog entry|no version changes/);
    assert.equal(calls.created.length, 0);
    assert.equal(calls.removed.length, 0);
  }
});

test('parses major, minor and initial release headings without leaking older notes', () => {
  for (const heading of ['# [1.0.0](https://example.com)', '## [1.0.0](https://example.com)', '## 1.0.0 (2026-10-28)']) {
    assert.equal(publish.releaseNotes(`${heading}\n\n### Features\n\n* change\n\n## 0.1.0\n\n* old`, '1.0.0'), '### Features\n\n* change');
  }
  assert.throws(() => publish.releaseNotes('## 1.0.00\n\n* wrong version', '1.0.0'), /Missing/);
  assert.throws(() => publish.releaseNotes('## 1.0.0\n\n## 0.1.0\n\n* old', '1.0.0'), /Empty/);
});
