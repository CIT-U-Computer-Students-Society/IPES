---
name: git-pr
description: Draft, create, and update focused pull requests, using stacks for dependent concerns, descriptive titles, change diagrams, and evidence-based testing charts. Use when preparing or editing PRs or PR stacks; use git-commit for commit messages.
---

# Pull Requests

## Establish the scope

- Inspect the diff and commits against the intended base branch. Describe the final change, including its reason and resulting behavior.
- Follow the repository's branch conventions; feature PRs target `dev`. For a `dev` to `main` release, also use [release-dev-to-main](../release-dev-to-main/SKILL.md) for the release changelog and body structure. The diagram and testing requirements below apply to releases too.
- Use [git-commit](../git-commit/SKILL.md) when commits are needed. Keep PR title conventions separate from commit message conventions.

## Separate concerns with stacked PRs

Prefer a focused PR for each reviewable concern. When one concern depends on another, use stacked PRs rather than putting all concerns into one PR with separate commits. Keep atomic commits within each layer. Independent changes should be sibling PRs targeting `dev`; a small cohesive change can remain a single PR.

- Put the lowest layer against `dev`, and each dependent layer against the branch immediately below it: `dev ← ci/release-automation ← docs/release-guide`. The `dev` → `main` production release remains a separate promotion governed by the release skill.
- Plan branch boundaries before publishing. Inspect `git log <parent>..<layer>` and `git diff <parent>...<layer>` so each PR contains only its own concern. Preserve existing work when splitting an already-published branch; use explicit `--force-with-lease` checks for any necessary history update.
- Use GitHub's official `gh-stack` CLI extension for native stack tracking. Check `gh stack --help` and the installed subcommand help before relying on flags. If missing, install with `gh extension install github/gh-stack` when authorized; otherwise use explicit parent bases with `gh pr create` and report that native stack linking is unavailable.
- Keep the local trunk current with `origin/dev` without discarding local commits. Adopt existing layer branches, in bottom-to-top order, with `gh stack init --base dev <lower-branch> <upper-branch>`.
- Prepare each PR's descriptive title, template body, diagrams, and evidence separately. Publish with `gh pr create --base <parent-branch> --head <layer-branch> --title <title> --body-file <utf8-file>`, then link the resulting PR numbers bottom-to-top with `gh stack link --base dev <lower-pr> <upper-pr>`. This preserves authored descriptions instead of relying on generated commit subjects as PR titles.
- For an existing tracked stack, use `gh stack submit` to publish additions or `gh stack sync` to fetch, rebase, push, and refresh existing PR state as appropriate to the authorized task. Inspect the result rather than assuming a zero exit status means remote stack synchronization completed. Review generated titles and bodies before marking PRs ready.
- Identify the stack order, parent PR, and dependencies in each body, with links once available. Describe and diagram the current layer's changes; do not repeat lower-layer changes as new work. Update links and bases when the stack changes.
- Validate each layer's tree and name its tested revision. Reuse evidence only for checks whose relevant source and configuration are unchanged, explicitly stating the reuse. Inspect actual CI for every PR: upper layers can have different workflow triggers from a PR targeting `dev`.
- After lower-layer edits or merges, restack remaining branches with the installed `gh stack rebase`/`sync` commands, inspect the per-layer diffs, and rerun affected checks. Account for squash/rebase merges so already-landed lower commits do not reappear in upper PRs.
- Report every created PR in dependency order and attach each to the chat. Stack creation does not authorize merging; merge only when requested and all required checks and local suites pass.

Reference: [GitHub stacked PR CLI commands](https://docs.github.com/en/pull-requests/reference/stacked-prs-cli-commands).

## Descriptive titles

Write a concise, descriptive title that names the outcome and affected area. Use ordinary language, without Conventional Commit prefixes such as `feat:` or `fix(scope):`.

Examples:

- `Prevent duplicate evaluation assignments when members rejoin`
- `Show verified accomplishments in member portfolios`
- `Separate commit and pull request authoring skills`

Rewrite the title and body when the final scope changes. Avoid vague titles such as `Update code` or a list of commit subjects.

## PR body

Follow [the repository PR template](../../../.github/PULL_REQUEST_TEMPLATE.md), retaining its Description, Type of change, How Has This Been Tested?, and Checklist sections. Use the release skill's body structure for releases.

- Lead with the concrete problem and the resulting behavior. Include a before/after example when it clarifies the change.
- Link relevant issues; use closing keywords only for issues the PR actually resolves.
- Include a Mermaid diagram of the changed workflow, component relationships, or before/after behavior. For documentation or tooling changes, diagram the actual authoring or tooling flow. Keep labels understandable without reading the implementation.
- Include testing charts as described below. Provide adjacent text and tables so the PR remains understandable if diagrams do not render.
- Keep descriptions proportional to the change. Collapse long logs with `<details>` and link available CI runs or artifacts.
- Check only checklist items supported by completed work. Explain unmet requirements and limitations.

## Testing evidence and charts

Run both required suites before opening a PR or considering it complete:

```text
backend/ (activate .venv first): python manage.py test
frontend/: npm run test -- --run
```

The frontend command runs the required `npm run test` suite once instead of entering watch mode. Run additional checks appropriate to the actual change.

Record evidence in a table with **Category**, **Suite or scenario**, **Command or steps**, **Result**, and **Evidence** columns. Cover each category explicitly:

| Category | Evidence to report |
|---|---|
| Automated | Backend and frontend suites, with runner summaries and exit status |
| Regression | The bug reproduction or existing behavior protected, the relevant tests or manual steps, and the observed result |
| Other checks | Checks actually applicable to the change, such as build, lint, type checking, manual UI, accessibility, or migration checks |

Prefer Mermaid **pie charts** for testing results when the runner reports counts. Use a separate pie per suite or a clearly labeled set of mutually exclusive test cases. Cover **Automated**, **Regression**, and **Other checks** in the evidence table and adjacent chart captions; use a small status flowchart for checks without meaningful counts. Read the [few-shot chart examples](references/chart-examples.md) when authoring testing charts: they cover passing suites, mixed outcomes, and regression subsets.

- Derive every status, count, duration, and percentage from captured output or observed manual results. Never copy example results as evidence.
- Use `PASS`, `FAIL`, `SKIPPED`, `BLOCKED`, `NOT RUN`, or `N/A` accurately. Explain `BLOCKED`, `NOT RUN`, and `N/A` in the evidence table; unexecuted checks are not passing checks.
- For regressions, identify the scenario and test reference, and include before/after evidence if available. State when the original failure was not reproduced; do not claim a verified fix from an assumed baseline.
- Include pass/fail/skipped counts when the runner reports them. Distinguish test cases from test files or suites. If counts are unavailable, use a qualitative status chart.
- Regression tests can be part of an automated suite. Label that overlap and avoid counting them again in a combined total. Keep manual checks and CI job results distinct from test-case totals.
- Pie slices must use the same unit and form disjoint parts of one stated total. Include observed failures and skips. Keep blocked/unrun checks visible in adjacent text or a status chart; never invent test counts for them. Do not add regression subsets to their parent suite total, and do not infer coverage or performance gains from passing tests. Comparisons across runs must name their baselines.
- Keep results tied to the tested revision and environment. After changes that affect a result, rerun the affected checks and update the table and chart together.

## Publishing and final verification

- When PR creation is requested, push the verified branch to `origin` and create the PR against the intended base. Confirm the published title and body match the prepared content and that Mermaid blocks have valid fences.
- When using `gh`, put multiline bodies in a UTF-8 file and pass `--body-file` to preserve newlines and literal text.
- Distinguish local verification from CI. Inspect actual workflows and check results for the PR revision; do not assume CI runs a suite just because it passed locally.
- Attach the created or updated PR to the chat when the app provides that capability.
- Report the PR link and material verification gaps. Merge only when requested and the required checks pass.
- If squash-merging is requested, explicitly give the resulting commit a Conventional Commit subject using the git-commit skill; keep the descriptive PR title.
