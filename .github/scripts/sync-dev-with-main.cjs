// Called by actions/github-script; uses the API without modifying either branch.
module.exports = async function syncDevWithMain({ github, context, core }) {
  const { owner, repo } = context.repo;
  const { data: comparison } = await github.rest.repos.compareCommitsWithBasehead({
    owner,
    repo,
    basehead: 'dev...main',
  });

  // Compare ancestry, not file differences: release merge commits need syncing too.
  if (comparison.ahead_by === 0) {
    core.info('dev already contains main; no sync PR needed.');
    return;
  }

  const { data: existing } = await github.rest.pulls.list({
    owner,
    repo,
    state: 'open',
    base: 'dev',
    head: `${owner}:main`,
    per_page: 1,
  });

  if (existing.length > 0) {
    core.info(`Reusing sync PR: ${existing[0].html_url}`);
    core.setOutput('pull-request-url', existing[0].html_url);
    return;
  }

  const { data: pullRequest } = await github.rest.pulls.create({
    owner,
    repo,
    base: 'dev',
    head: 'main',
    title: 'Sync main back into dev',
    body: buildBody(comparison),
  });

  core.info(`Created sync PR: ${pullRequest.html_url}`);
  core.setOutput('pull-request-url', pullRequest.html_url);
};

function buildBody(comparison) {
  return `## Description

Bring main's release history and changes back into dev while preserving ongoing development.
Compared dev and main: [commit comparison](${comparison.permalink_url}).
Main has ${comparison.ahead_by} commit(s) that dev does not contain.

### Change overview

\`\`\`mermaid
flowchart LR
    main["Push to main"] --> compare["Compare dev...main"]
    compare --> pr["Open or reuse main to dev PR"]
    pr --> review["Review and required checks"]
    review --> merge["Merge commit into dev"]
\`\`\`

Use **Create a merge commit** when merging this PR so dev records main's ancestry.
Squashing or rebasing would leave main's original commits unsynced. Resolve any
conflicts through the normal review process; the automation does not merge or push.

## Type of change

- [x] Branch synchronization (release history and changes from main)

## How Has This Been Tested?

The sync job compares Git history only; it does not run application tests.
Run both suites and inspect this PR's CI before merging. A default-token PR may
require approval of its workflow runs; approve them in Actions if prompted.

| Category | Suite or scenario | Command or steps | Result | Evidence |
|---|---|---|---|---|
| Automated | Backend suite | Activate backend/.venv; run python manage.py test from backend/ | NOT RUN | Sync job does not execute tests |
| Automated | Frontend suite | npm run test -- --run from frontend/ | NOT RUN | Sync job does not execute tests |
| Regression | Application behavior | Review changes and run applicable regression checks | NOT RUN | Maintainer verification required |
| Other checks | Commit ancestry | Compare dev...main using GitHub API | PASS | Main has ${comparison.ahead_by} unsynced commit(s) in the linked comparison |
| Other checks | PR validation CI | Inspect checks on this PR | NOT RUN | Separate from the sync job; may require workflow approval |

### Testing charts

\`\`\`mermaid
flowchart TB
    subgraph automated["Automated"]
        backend["Backend: NOT RUN"]
        frontend["Frontend: NOT RUN"]
    end
    subgraph regression["Regression"]
        behavior["Application checks: NOT RUN"]
    end
    subgraph other["Other checks"]
        ancestry["Unsynced ancestry detected: PASS"]
        ci["PR validation CI: NOT RUN"]
    end
\`\`\`

## Checklist:

- [ ] I have performed a self-review of the sync diff
- [ ] Both application test suites pass locally
- [ ] Required CI checks pass
- [ ] Conflicts are resolved and this PR will be merged using a merge commit
`;
}
