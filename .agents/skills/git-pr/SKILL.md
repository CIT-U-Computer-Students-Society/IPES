---
name: git-pr
description: Draft, create, and update pull requests with descriptive titles, change diagrams, and evidence-based testing charts. Use when preparing or editing a PR title or body; use git-commit for commit messages.
---

# Pull Requests

## Establish the scope

- Inspect the diff and commits against the intended base branch. Describe the final change, including its reason and resulting behavior.
- Follow the repository's branch conventions; feature PRs target `dev`. For a `dev` to `main` release, also use [release-dev-to-main](../release-dev-to-main/SKILL.md) for the release changelog and body structure. The diagram and testing requirements below apply to releases too.
- Use [git-commit](../git-commit/SKILL.md) when commits are needed. Keep PR title conventions separate from commit message conventions.

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

Include a testing Mermaid chart with clearly labeled groups for **Automated**, **Regression**, and **Other checks**. Show the status of each reported suite or scenario. A single chart may cover all three groups; split it only when readability benefits. See [chart examples](references/chart-examples.md) when choosing the diagram structure.

- Derive every status, count, duration, and percentage from captured output or observed manual results. Never copy example results as evidence.
- Use `PASS`, `FAIL`, `SKIPPED`, `BLOCKED`, `NOT RUN`, or `N/A` accurately. Explain `BLOCKED`, `NOT RUN`, and `N/A` in the evidence table; unexecuted checks are not passing checks.
- For regressions, identify the scenario and test reference, and include before/after evidence if available. State when the original failure was not reproduced; do not claim a verified fix from an assumed baseline.
- Include pass/fail/skipped counts when the runner reports them. Distinguish test cases from test files or suites. If counts are unavailable, use a qualitative status chart.
- Regression tests can be part of an automated suite. Label that overlap and avoid counting them again in a combined total. Keep manual checks and CI job results distinct from test-case totals.
- Use numeric graphs only for comparable, measured values with clear units and a named baseline. Do not infer coverage or performance gains from passing tests, and do not use a pie chart that hides failures or unrun checks.
- Keep results tied to the tested revision and environment. After changes that affect a result, rerun the affected checks and update the table and chart together.

## Publishing and final verification

- When PR creation is requested, push the verified branch to `origin` and create the PR against the intended base. Confirm the published title and body match the prepared content and that Mermaid blocks have valid fences.
- When using `gh`, put multiline bodies in a UTF-8 file and pass `--body-file` to preserve newlines and literal text.
- Distinguish local verification from CI. Inspect actual workflows and check results for the PR revision; do not assume CI runs a suite just because it passed locally.
- Attach the created or updated PR to the chat when the app provides that capability.
- Report the PR link and material verification gaps. Merge only when requested and the required checks pass.
- If squash-merging is requested, explicitly give the resulting commit a Conventional Commit subject using the git-commit skill; keep the descriptive PR title.