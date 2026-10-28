---
name: git-commit
description: Structure and create atomic Git commits using Conventional Commit subjects and messages. Use when staging changes, committing code, or drafting commit messages; use git-pr for pull request titles and descriptions.
---

# Git Commits

## Scope and staging

- Inspect the working tree and staged diff before choosing commit boundaries. Preserve unrelated user changes.
- Group changes by logical concern. Separate unrelated documentation, feature code, refactors, and dependency updates.
- Stage explicit files or selected hunks with `git add <file>` or `git add -p`.
- Follow the repository's branch conventions or the user's exact branch name. Never prepend `codex/`.

## Conventional Commit messages

Use Conventional Commits for every commit subject (title) and message:

```text
<type>[optional scope][!]: <description>

[optional body]

[optional footer(s)]
```

| Type | Use |
|---|---|
| `feat` | User-facing functionality |
| `fix` | Bug fixes |
| `docs` | Documentation and skills |
| `style` | Formatting without behavior changes |
| `refactor` | Code restructuring without behavior changes |
| `perf` | Performance improvements |
| `test` | Test additions and corrections |
| `build` | Build system and dependency changes |
| `ci` | CI configuration and workflows |
| `chore` | Other maintenance |
| `revert` | Reverting a previous commit |

- Write the description in imperative, present tense, beginning with a lowercase letter and ending without a period.
- Use a scope when it helps identify the affected domain, such as `evaluations` or `auth`.
- Explain non-obvious motivation or consequences in the body. Include issue references only when known.
- Mark breaking changes with `!` before the colon or a `BREAKING CHANGE:` footer; explain the impact and migration.

Examples:

```text
fix(evaluations): scope assignments to the active organization
docs(skills): separate commit and pull request guidance
feat(api)!: require organization context for membership updates
```

## Verification and completion

- Run both test suites required by `AGENTS.md` before considering the work complete, with the backend virtual environment activated. Use `npm run test -- --run` for a frontend run that exits.
- Inspect the staged diff and `git diff --cached --check` before committing. Verify the resulting commit and remaining working tree afterward.
- Report actual verification results, including failures or blockers.
- A local commit request does not by itself request a push. Publish when it is part of the user's requested workflow; use [git-pr](../git-pr/SKILL.md) for PR preparation and publishing.