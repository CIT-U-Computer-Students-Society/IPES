# Contributing to IPES

Thank you for contributing to the Individual Performance Evaluation System (IPES)! This guide details the development workflows, branching policies, and coding standards for this project.

---

## 🌿 Branching Policy

To ensure release stability, we enforce a strict branching protocol:

1. **`main` Branch**:
   - Production branch.
   - Direct commits to `main` are strictly prohibited.
   - `main` can ONLY be updated by merging the `dev` branch via pull request.
2. **`dev` Branch**:
   - Active development branch. All feature branches should branch off of `dev`.
3. **Feature Branches**:
   - Created for specific tasks (e.g. `feat/new-evaluations` or `fix/user-login`).
   - Merged back into `dev` via pull requests after reviews and CI checks pass.

### Keeping dev in sync with main

The **Sync dev with main** workflow runs after each push to `main`, including
release merges, and can also be run manually from Actions on `main`. It opens a
`main` → `dev` PR when main contains commits missing from dev, reuses an existing
open sync PR, and skips creation when dev already contains main. This includes
release merge commits even when the branches have identical files.

Review the sync PR, resolve conflicts if present, run both application test suites,
and wait for required CI checks. Merge it using **Create a merge commit** so dev
records main's history; squash and rebase merges do not preserve that ancestry.
The automation never merges, force-pushes, or resets either branch. New pushes to
main appear automatically in the open PR, while dev's own work stays on dev.

For setup, enable **Allow GitHub Actions to create and approve pull requests** in
**Settings → Actions → General → Workflow permissions**. The workflow requests
only contents read and pull requests write access. Organization policy must also
allow PR creation. With the default `GITHUB_TOKEN`, GitHub may require approval
before running validation on an automatically created PR; approve those runs in
Actions if prompted. See [GitHub's token documentation](https://docs.github.com/en/actions/concepts/security/github_token).

Optionally set the repository Actions secret `DEV_SYNC_TOKEN` to a GitHub App
installation token or fine-grained personal access token with **Contents: Read**
and **Pull requests: Read and write** for this repository to trigger validation
without the default-token approval requirement. Token expiration or revocation
will fail the run visibly; refresh the secret and rerun the workflow.

The workflow becomes active after it reaches `main` through the normal release
process. Test its API behavior locally without credentials or branch changes:

```bash
node --test .github/scripts/sync-dev-with-main.test.cjs
```

---

## 💬 Conventional Commits

We follow the Conventional Commits specification to maintain a clean git history:

### Message Format:
```text
<type>(<optional scope>): <description>

[optional body]
```

### Allowable Types:
- **`feat`**: A new feature for the user.
- **`fix`**: A bug fix for the user.
- **`docs`**: Changes to documentation or guidelines.
- **`style`**: Code formatting, missing semi-colons, etc. (no behavior changes).
- **`refactor`**: Code changes that neither fix a bug nor add a feature.
- **`perf`**: Performance optimizations.
- **`test`**: Adding missing tests or correcting existing tests.
- **`build`**: Changes affecting the build system or external dependencies.
- **`ci`**: CI workflow configuration adjustments.
- **`chore`**: Maintenance tasks.

### Guidelines:
- Write descriptions in the **imperative, present tense** (e.g., "fix bug", not "fixed bug").
- Keep descriptions in lowercase, and do not end them with a period.

---

## 🛠️ Staging and Committing Guidelines

- **Separate Concerns**: Do not stage unrelated edits in a single massive commit. Stage and commit in small, logical chunks (e.g. separate the settings adjustments from test fixes).
- **Run Local Verification**: Before committing or pushing, verify that backend and frontend test suites pass:
  - Run `python manage.py test` inside `backend/`.
  - Run `npm run test` inside `frontend/`.

## Component releases

Release Please prepares separate web, backend, and documentation release PRs into
`dev`. After those PRs are reviewed and merged, promote `dev` to `main` with a merge
commit to publish their independent tags and GitHub releases. See the
[release guide](RELEASING.md) for setup, changelogs, validation, and recovery.
