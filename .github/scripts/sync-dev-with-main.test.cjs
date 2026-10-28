const assert = require('node:assert/strict');
const { test } = require('node:test');
const sync = require('./sync-dev-with-main.cjs');

function fixture({ ahead = 1, existing = [], failure } = {}) {
  const calls = [];
  const outputs = {};
  const comparison = {
    ahead_by: ahead,
    permalink_url: 'https://github.com/org/repo/compare/org:dev-sha...org:main-sha',
  };
  const api = (name, data) => async (args) => {
    calls.push({ name, args });
    if (failure === name) throw new Error(`${name} failed`);
    return { data };
  };
  return {
    calls,
    outputs,
    github: {
      rest: {
        repos: { compareCommitsWithBasehead: api('compare', comparison) },
        pulls: {
          list: api('list', existing),
          create: api('create', { html_url: 'https://github.com/org/repo/pull/1' }),
        },
      },
    },
    context: { repo: { owner: 'org', repo: 'repo' } },
    core: {
      info() {},
      setOutput(name, value) { outputs[name] = value; },
    },
  };
}

test('does nothing when dev already contains main, even with dev-only commits', async () => {
  const f = fixture({ ahead: 0 });
  await sync(f);
  assert.deepEqual(f.calls, [{
    name: 'compare',
    args: { owner: 'org', repo: 'repo', basehead: 'dev...main' },
  }]);
  assert.deepEqual(f.outputs, {});
});

test('opens main into dev for a release merge commit even with identical file trees', async () => {
  // No file diff is needed: ahead_by includes ancestry-only merge commits.
  const f = fixture();
  await sync(f);
  const { args } = f.calls.find(({ name }) => name === 'create');
  assert.equal(args.base, 'dev');
  assert.equal(args.head, 'main');
  assert.equal(args.owner, 'org');
  assert.equal(args.repo, 'repo');
  assert.match(args.body, /Create a merge commit/);
  assert.match(args.body, /dev-sha/);
  assert.match(args.body, /main-sha/);
  assert.match(args.body, /Backend suite.*NOT RUN/);
  assert.equal(f.outputs['pull-request-url'], 'https://github.com/org/repo/pull/1');
});

test('reuses an open PR without creating duplicates or rewriting its description', async () => {
  const f = fixture({ existing: [{ html_url: 'existing-pr' }] });
  await sync(f);
  assert.deepEqual(f.calls.map(({ name }) => name), ['compare', 'list']);
  assert.deepEqual(f.calls[1].args, {
    owner: 'org', repo: 'repo', state: 'open', base: 'dev', head: 'org:main', per_page: 1,
  });
  assert.equal(f.outputs['pull-request-url'], 'existing-pr');
});

test('opens a PR when main and dev have both advanced', async () => {
  const f = fixture({ ahead: 3 });
  await sync(f);
  assert.match(f.calls[2].args.body, /Main has 3 commit\(s\)/);
  assert.equal(f.calls[2].args.base, 'dev');
});

for (const failure of ['compare', 'list', 'create']) {
  test(`surfaces ${failure} API failures instead of reporting a successful sync`, async () => {
    const f = fixture({ failure });
    await assert.rejects(sync(f), new RegExp(`${failure} failed`));
    assert.deepEqual(f.outputs, {});
    assert.equal(f.calls.at(-1).name, failure);
  });
}
