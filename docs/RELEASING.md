# Component releases

Release Please tracks web, backend, and documentation independently. Each component
has its own version, changelog, Git tag, and GitHub release. All changed components
share one release PR so updates to `.release-please-manifest.json` land together.

| Component | Changes under | Version file | Changelog | Tag format |
| --- | --- | --- | --- | --- |
| Web | `frontend/` | `frontend/package.json` and `package-lock.json` | [Web changelog](../frontend/CHANGELOG.md) | `web-v0.1.0` |
| Backend | `backend/` | `backend/version.txt` | [Backend changelog](../backend/CHANGELOG.md) | `backend-v0.1.0` |
| Documentation | `docs/` | `docs/version.txt` | [Documentation changelog](CHANGELOG.md) | `docs-v0.1.0` |

The tag versions above are examples. All components start at `0.0.0`; Release Please
chooses the next version from their commits. Web releases update the npm lockfile
automatically. Backend uses the `simple` strategy because it is a Django service
without Python package version metadata. No npm or Python package is published.

## One-time GitHub setup

1. Enable GitHub Actions and allow it to create pull requests in repository
   **Settings → Actions → General → Workflow permissions**.
2. Add an Actions secret named `RELEASE_PLEASE_TOKEN` using a fine-grained PAT
   with access to this repository and **Contents**, **Issues**, and **Pull requests**
   read/write permissions. This lets bot-created PRs trigger normal validation.
   The workflow falls back to `GITHUB_TOKEN`, but GitHub suppresses workflows
   triggered by that token; CI on those PRs must then be triggered manually.
3. Merge this configuration into `dev` and promote it to `main` through the
   usual reviewed PR. The workflows become available on their respective branches.

The workflow's `issues: write` permission is used for release lifecycle labels.
Production publication uses the job's `GITHUB_TOKEN`, with `contents: write`,
`issues: write`, and `pull-requests: write`, to create releases and update labels
on release PRs. The optional `RELEASE_PLEASE_TOKEN` is used only to prepare PRs on
`dev`; its permissions do not control production publication.
These permissions do not grant automatic approval or merging. Required CI checks and both local
application suites must pass before a merge.

## Release flow

```mermaid
flowchart TD
  Changes[Conventional commits on dev] --> RP[Release Please]
  RP --> Combined[Combined release PR into dev]
  Combined --> Review[Review component versions and changelogs]
  Review --> Dev[Merge release PR into dev]
  Dev --> Promote[Reviewed dev to main PR]
  Promote --> Check[Verify release commits are ancestors of main]
  Check --> Publish[Publish independent tags and GitHub releases]
```

1. Merge Conventional Commits into `dev`. Release Please runs on every push and
   opens or updates one combined PR for all changed components.
2. Review and merge that release PR. It contains independent component version
   bumps and changelogs, and one shared update to `.release-please-manifest.json`.
   Components without releasable changes retain their current versions.
3. Promote `dev` to `main` using a **merge commit**, preserving the release commits.
   Do not squash or rebase this promotion: the publisher verifies commit ancestry.
   The existing rule allowing only `dev` PRs into `main` remains in force.
4. The `main` workflow finds merged Release Please PRs still labelled
   `autorelease: pending`. It publishes only those whose merge commits are reachable
   from the workflow's production commit. Newer work on `dev` remains unpublished.
5. For each changed manifest version, the publisher creates a component tag at
   that release commit and a GitHub release with that version's changelog entry.
   Successful PRs become `autorelease: tagged`. Independent releases do not compete
   for the repository's single GitHub “latest release” designation.

Release Please pauses creation of further release PRs while merged release PRs
remain pending. Promote those PRs and publish them before preparing the next cycle.
Components need not share version numbers, and a documentation-only release does
not increment either application version. Promotion still deploys everything
included in `dev`; this automation separates release metadata, not deployment jobs.

## Commit conventions and changelogs

Release Please assigns commits by changed paths, not commit scopes. A commit that
changes both application directories can appear in both component changelogs.
Use the existing Conventional Commit conventions: features increment minor,
fixes increment patch, and breaking changes increment major (minor while below
`1.0.0`). Documentation, build/dependency, refactor, test, CI, and maintenance
commits are visible in changelogs and can produce patch releases.

Keep documentation in `docs/` to include it in documentation releases. Changes only
to root files, `.github/`, or agent tooling do not trigger a component release.
Preserve Conventional Commit messages when merging feature work. The human-readable
Release Please PR title is generated metadata; its merged commit is excluded from
future component notes by the release boundary.

`bootstrap-sha` in `release-please-config.json` marks the existing commit immediately
before this automation was introduced. Initial changelogs start after that point;
historical releases, including the `2526-sem2` tag, are retained. Later cycles use
the published component tags as their release boundaries. Do not move the bootstrap
SHA forward during normal maintenance.

## Verification and recovery

### Migrating from separate release PRs

After merging the combined-PR configuration into `dev`, close any remaining
unmerged component release PRs and run **Release Please** manually on `dev`.
The replacement PR uses branch `release-please--branches--dev`. Review its diff
to confirm it contains the outstanding component changes. Do not merge the old
conflicting PRs or copy their complete manifest over the current one.

Already merged component PRs remain eligible for publication after promotion to
`main`; the publisher accepts both combined and legacy component PR branches.
If a merged release is still `autorelease: pending`, promote and publish it before
expecting the next release PR. Keep its pending label until publication succeeds.

### Checks and publication recovery

Run from the repository root:

```sh
node --test .github/scripts/publish-releases.test.cjs
```

The Release Automation Tests workflow runs the same tests for relevant PR changes.
The tests cover component isolation, commit ancestry, changelog extraction, partial
failures, retries, and rejection of unrelated PRs. Before merging, also run
`python manage.py test` from an activated backend virtual environment and
`npm run test -- --run` from `frontend/`, and inspect required CI results.

To recover a failed publication, rerun the failed workflow or manually run
**Release Please** with branch `main` selected. Existing releases are skipped;
the pending label stays until every component in that PR has published. Never
remove that label manually to bypass an error. A manual run on `dev` refreshes
release PRs; it does not publish production releases. No workflow auto-merges PRs
or changes deployment settings.

If a release was published but updating its PR labels returned HTTP 403, correct
the publication job's token permissions, promote that workflow fix to `main`,
then run **Release Please** on `main` again. A rerun of the old failed run still
uses the old workflow revision. The publisher skips the existing release and
retries the label updates; do not delete or recreate the release or its tag.

Upstream references: [Release Please Action](https://github.com/googleapis/release-please-action)
and [manifest configuration](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md).
