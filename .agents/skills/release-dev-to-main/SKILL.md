---
name: release-dev-to-main
description: Skill for preparing a release pull request from dev into main. Covers changelog generation, PR title format, and description structure. Use whenever merging dev into main for a production release.
---

# Skill: Releasing `dev` → `main`

Use this skill whenever you are asked to merge `dev` into `main`. This is a **release event** — not a regular feature PR. The title, description, and changelog must reflect the full scope of changes being promoted to production.

Also apply [git-pr](../git-pr/SKILL.md) for descriptive titles, a Mermaid change diagram, and testing charts covering automated suites, regression scenarios, and other applicable checks. Prefer Mermaid pie charts for measured test outcomes, following the [few-shot examples](../git-pr/references/chart-examples.md); keep failures/skips visible and regression subsets separate from parent-suite totals. Use the release body structure below in place of the standard PR template, while retaining those shared evidence requirements.

> [!IMPORTANT]
> CI permits ordinary promotion PRs into `main` only from `dev`. The same-repository `release-please--branches--main` branch is also allowed for automated component version and changelog PRs; see [the release guide](../../../docs/RELEASING.md). Other branches must go through `dev`.

---

## 1. Pre-Flight Checklist

Before opening the PR, verify all of the following:

- [ ] Both test suites pass locally on `dev`:
  ```bash
  # Backend (from backend/)
  python manage.py test

  # Frontend (from frontend/)
  npm run test
  ```
- [ ] `dev` is fully up-to-date with `origin/dev` (no unpushed commits):
  ```bash
  git fetch origin
  git status
  ```
- [ ] The `dev` branch has been pushed to `origin`:
  ```bash
  git push origin dev
  ```

---

## 2. Generate the Changelog

Run the following command to list every commit on `dev` that is not yet on `main`:

```bash
git log main..dev --oneline
```

Then group the output by Conventional Commit type. Use this mapping:

| Prefix | Changelog Section |
|---|---|
| `feat` | ✨ New Features |
| `fix` | 🐛 Bug Fixes |
| `refactor` | ♻️ Refactors |
| `perf` | ⚡ Performance |
| `build` / `build(deps)` | 📦 Dependency Updates |
| `docs` | 📝 Documentation |
| `test` | 🧪 Tests |
| `ci` | ⚙️ CI / Tooling |
| `chore` | 🔧 Chores |

- Omit merge commits (lines starting with `Merge pull request`).
- Omit bot-generated Dependabot bumps from the main changelog body — group them together under **Dependency Updates** as a single collapsed block.
- List items as bullet points using the commit subject (strip the type prefix).

---

## 3. PR Title Format

Use the following format for the PR title:

```
Release <short summary of the release> (YYYY-MM-DD)
```

The summary should be a **2–5 word description** of the dominant theme of this release — what most of the changes are about.

Use a descriptive title in ordinary language. Conventional Commit prefixes apply to the underlying commits, not the PR title.

**Examples:**
```
Release evaluation engine and analytics (2026-07-02)
Release member dashboard and portfolio (2026-06-15)
Release dependency updates and CI improvements (2026-07-01)
```

---

## 4. PR Description Structure

Use this exact structure for the PR body. Fill in every section — do not leave placeholder text.

```markdown
## 🚀 Release — <short summary> (<YYYY-MM-DD>)

> Promotes `dev` → `main`. Lists the changes proposed for production.

## Change overview

<Mermaid diagram of the release's main workflow or component changes, with a brief explanation>

---

## ✨ New Features
- <feat commit subject>
- <feat commit subject>

## 🐛 Bug Fixes
- <fix commit subject>
- <fix commit subject>

## ♻️ Refactors
- <refactor commit subject>

## 📝 Documentation
- <docs commit subject>

## ⚙️ CI / Tooling
- <ci or chore commit subject>

<details>
<summary>📦 Dependency Updates (<N> bumps)</summary>

- <dep bump 1>
- <dep bump 2>

</details>

---

## ✅ Pre-Release Verification

- [ ] `python manage.py test` — all backend tests pass
- [ ] `npm run test` — all frontend tests pass
- [ ] No regressions observed on the dev environment

### Testing evidence

<Evidence table covering automated suites, named regression scenarios, and other applicable checks; include commands or steps, observed results, and available logs or CI links>

### Testing charts

<Mermaid pie charts of measured suite outcomes, with Automated, Regression, and Other checks explained in captions/table; use a status chart for uncounted checks and explicitly show failures, skipped, blocked, unrun, or inapplicable checks>

## Type of change

- [ ] New feature (non-breaking change which adds functionality)
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Refactor (changes that do not add functionality or fix a bug)
- [ ] This change requires a documentation update
```

---

## 5. Omit Sections That Don't Apply

If there are no commits for a particular section (e.g., no `perf` commits), **omit that section entirely** from the PR body. Do not leave empty sections.


