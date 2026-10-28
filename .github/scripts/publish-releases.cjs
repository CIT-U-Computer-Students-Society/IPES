const { execFileSync } = require('node:child_process');

const MANIFEST = '.release-please-manifest.json';

function readAtCommit(ref, path) {
  return execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8' });
}

function releaseNotes(changelog, version) {
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Release Please uses # for major releases and ## for other releases.
  const heading = new RegExp(`^#{1,2} \\[?${escaped}(?:\\]|\\s|$)[^\\n]*\\n`, 'm');
  const match = heading.exec(changelog);
  if (!match) throw new Error(`Missing changelog entry for ${version}`);
  const rest = changelog.slice(match.index + match[0].length);
  const next = rest.search(/^#{1,2} /m);
  const notes = (next < 0 ? rest : rest.slice(0, next)).trim();
  if (!notes) throw new Error(`Empty changelog entry for ${version}`);
  return notes;
}

async function publish({ github, context, core, read = readAtCommit }) {
  if (context.ref !== 'refs/heads/main') {
    throw new Error('Production releases must run on main');
  }
  const repo = context.repo;
  const config = JSON.parse(read(context.sha, 'release-please-config.json'));
  const pending = await github.paginate(github.rest.issues.listForRepo, {
    ...repo, state: 'closed', labels: 'autorelease: pending', per_page: 100,
  });

  for (const issue of pending) {
    if (!issue.pull_request) continue;
    const { data: pr } = await github.rest.pulls.get({ ...repo, pull_number: issue.number });
    if (!pr.merged_at || pr.base.ref !== 'dev' ||
        pr.head.repo?.full_name !== `${repo.owner}/${repo.repo}` ||
        !pr.head.ref.startsWith('release-please--branches--dev--components--')) continue;

    const sha = pr.merge_commit_sha;
    // Comparing release commit...main proves the release commit is in production.
    const { data: comparison } = await github.rest.repos.compareCommitsWithBasehead({
      ...repo, basehead: `${sha}...${context.sha}`,
    });
    if (!['ahead', 'identical'].includes(comparison.status)) {
      core.info(`Release PR #${issue.number} is waiting for promotion to main`);
      continue;
    }

    const before = JSON.parse(read(`${sha}^1`, MANIFEST));
    const after = JSON.parse(read(sha, MANIFEST));
    const releases = [];
    // Prepare every entry before writing anything to GitHub.
    for (const [path, pkg] of Object.entries(config.packages)) {
      const version = after[path];
      if (version === before[path]) continue;
      if (!/^\d+\.\d+\.\d+$/.test(version)) {
        throw new Error(`Invalid release version for ${path}: ${version}`);
      }
      releases.push({
        tag: `${pkg.component}-v${version}`,
        name: `${pkg.component}: v${version}`,
        notes: releaseNotes(read(sha, `${path}/${pkg['changelog-path'] || 'CHANGELOG.md'}`), version),
      });
    }
    if (releases.length === 0) throw new Error(`Release PR #${issue.number} has no version changes`);

    for (const release of releases) {
      try {
        await github.rest.repos.getReleaseByTag({ ...repo, tag: release.tag });
        core.info(`Release ${release.tag} already exists`);
      } catch (error) {
        if (error.status !== 404) throw error;
        await github.rest.repos.createRelease({
          ...repo, tag_name: release.tag, target_commitish: sha,
          name: release.name, body: release.notes, make_latest: 'false',
        });
        core.info(`Published ${release.tag}`);
      }
    }

    // Keep pending on failures so a rerun can finish publishing without duplicates.
    await github.rest.issues.addLabels({ ...repo, issue_number: issue.number, labels: ['autorelease: tagged'] });
    await github.rest.issues.removeLabel({ ...repo, issue_number: issue.number, name: 'autorelease: pending' });
  }
}

module.exports = publish;
module.exports.releaseNotes = releaseNotes;
