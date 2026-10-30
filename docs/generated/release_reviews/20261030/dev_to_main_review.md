# Dev → main release review — 2026-10-30

> This report is a snapshot of the dev revision named below. A [follow-up stack review](pr_stack_followup_review.md) records later fixes and verification; the hold remains relevant until the fixes reach the release branch and release checks are satisfied.

**Decision: hold the release.** Twenty issues have supporting code and passing relevant regression tests. Three claimed fixes remain incomplete. The full backend suite fails and the release preflight is unmet.

Reviewed `dev` / `origin/dev` at `c89460e65133daee8b422555115547476d791e1d` against `origin/main` at `3a698d68fe3082cb4565c33e0727797ec337f79d`. The promotion contains 56 commits and changes 102 files. All 21 corresponding PRs are merged; every PR head is an ancestor of dev and is absent from main. Their review-thread lists are empty.

Scope: all 42 open issues returned by GitHub plus explicitly requested closed issues #233, #241, #252, #253 and #260. Twenty-three issues have corresponding merged fix PRs in this promotion. No GitHub issue state was changed.

## Findings that prevent a clean release

1. **[P1] Audit action catalog exposes cross-organization event metadata.** `backend/apps/audit/views.py:178-184` reads all AuditLog action strings directly rather than the authorized queryset. Both an administrator in A and an unrelated authenticated outsider received HTTP 200 with B's synthetic event, including its embedded email. This endpoint was introduced by [#314](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/314) and remains unscoped after [#316](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/316). The original header/list/detail fixes for [#268](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/268) pass, but audit reads are not consistently scoped; withhold its closing reference until this is addressed. Use the authorized queryset for every audit read and test administrator/member/outsider access. [Source](https://github.com/CIT-U-Computer-Students-Society/IPES/blob/c89460e65133daee8b422555115547476d791e1d/backend/apps/audit/views.py#L178).

2. **[P2] POST reactivation bypasses membership access validation.** `backend/apps/organizations/views/memberships.py:80-97` directly saves an inactive membership before serializer validation. A member with a revoked organization role was reactivated with HTTP 201; the equivalent PATCH correctly returns 400. Thus [#272](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/272) remains incomplete after [#318](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/318) interacting with [#320](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/320). Route reactivation through the same validated path as creation/PATCH, including account, tenant, unit, position and role checks, while preserving save signals. [Source](https://github.com/CIT-U-Computer-Students-Society/IPES/blob/c89460e65133daee8b422555115547476d791e1d/backend/apps/organizations/views/memberships.py#L80).

3. **[P2] Syntactically shaped but invalid dates still produce server errors.** `parse_audit_date_bound` does not catch date parser ValueError or next-day OverflowError. Verified HTTP 500 for `start_date=2026-02-30`, `start_date=2026-13-01T10:00:00Z`, and `end_date=9999-12-31`. [#266](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/266) remains incomplete after [#314](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/314). Catch parser/arithmetic failures and return field-specific HTTP 400. The existing tests cover `oops`, not these calendar-invalid/overflow inputs. [Source](https://github.com/CIT-U-Computer-Students-Society/IPES/blob/c89460e65133daee8b422555115547476d791e1d/backend/apps/audit/views.py#L35).

4. **[P2] Audit list search regressed.** The rewrite in [#314](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/314) removed the general `q` filter from `get_queryset`. A list request for a nonexistent keyword returned one seeded event instead of zero. The UI still sends `q` to this list route and filters the returned page locally, so losing server filtering can hide matching events beyond page one. Restore server keyword filtering alongside the validated filters. [Source](https://github.com/CIT-U-Computer-Students-Society/IPES/blob/c89460e65133daee8b422555115547476d791e1d/backend/apps/audit/views.py#L169).

5. **[P2] The full backend suite has an incompatible reactivation fixture.** `test_reactivation_triggers_auto_assignment_generation` creates an active form with no questions and expects an assignment. The new readiness guard from [#322](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/322) correctly prevents that assignment, causing the test from [#320](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/320) to fail. Add a real question to the ready-form test fixture while retaining the questionless-form rejection tests. A separate review probe confirmed that reactivation still generates the expected assignment when the form has a question. [Fixture](https://github.com/CIT-U-Computer-Students-Society/IPES/blob/c89460e65133daee8b422555115547476d791e1d/backend/apps/organizations/tests/test_membership_reactivation.py#L216).

## Automatic issue closure is also present in commit messages

Omitting an issue from the release PR body is insufficient to keep it open. These existing commits already carry closing keywords:

| Commit | Existing closing reference |
|---|---|
| `d009753` | `Fixes #266` (and `Fixes #267`) |
| `ed078d6` | `Fixes #268` |
| `d08bf31` | `Fixes #272` |

GitHub closes linked issues when the PR reaches the default branch, and also supports closing keywords in commit messages. The repository's default branch is main. Complete the affected fixes before promoting these commits. No history was rewritten. [GitHub's documented behavior](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue).

## Supported issue-to-PR mapping

Relevant committed regression tests passed in the full suite, except the incompatible fixture described above. The extra valid-reactivation probe passes. These observations support the specific fixes; they do not establish that all application defects are fixed. Original vulnerable baselines were not re-run during this release review.

| Issue | Corresponding PR | Decision | Code and regression evidence |
|---|---|---|---|
| [#233](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/233) | [#291](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/291) | Already closed; fix verified in dev | Incoming individual assignments are hidden before/after release; evaluator/admin access and released aggregates remain available. `test_assignment_visibility.py`. |
| [#235](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/235) | [#321](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/321) | Supported for closure | Manual, API and signal generation exclude revoked/missing/foreign organization roles; history is preserved. `test_assignment_generator_eligibility.py`. |
| [#238](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/238) | [#322](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/322) | Supported for closure | Questionless forms generate no assignments through signals, service calls or the API. `test_question_guard_assignments.py`. |
| [#240](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/240) | [#312](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/312) | Supported for closure | Dashboard counts Completed assignments for empty, partial and complete data. `frontend admin-dashboard.test.tsx`. |
| [#241](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/241) | [#293](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/293) | Already closed; fix verified in dev | PUT/PATCH require the active tenant's administrator, reject lifecycle bypass and audit authorized changes. `test_organization_updates.py`. |
| [#248](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/248) | [#313](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/313) | Supported for closure | Verification rejects conflicting selectors and logs under the accomplishment's organization. `test_audit_attribution.py`. |
| [#252](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/252) | [#295](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/295) | Already closed; fix verified in dev | Join requests are owner/tenant scoped; generic mutation and the retargeting attack chain are blocked. `test_join_request_visibility.py`. |
| [#253](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/253) | [#302](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/302) | Already closed; fix verified in dev | Revoked administrators and inactive organizations cannot approve/reject join requests. `test_join_request_approval_access.py`. |
| [#254](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/254) | [#304](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/304) | Supported for closure | Tenant administrators cannot mutate global identities, passwords or account availability. `test_global_account_authorization.py`. |
| [#255](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/255) | [#305](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/305) | Supported for closure | Managed-user list/detail memberships are tenant scoped; self-profile organization selection remains available. `test_tenant_membership_privacy.py`. |
| [#256](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/256) | [#307](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/307) | Supported for closure | Real failed audit inserts roll back only the savepoint; form creation and submission still persist. `test_transaction_safety.py`. |
| [#257](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/257) | [#308](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/308) | Supported for closure | Long titles and large event metadata persist without truncation and remain readable. `test_action_capacity.py`. |
| [#260](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/260) | [#292](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/292) | Already closed; fix verified in dev | Generic DELETE is rejected; confirmed soft-deactivation and protected audit history remain. `test_organization_deletion.py`. |
| [#261](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/261) | [#313](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/313) | Supported for closure | Audit writes use authoritative resource organizations, not an unverified header fallback. `test_audit_attribution.py`. |
| [#262](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/262) | [#310](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/310) | Supported for closure | Audit CSV export neutralizes tested formula prefixes and leading whitespace/control variants. `test_csv_export.py`. |
| [#263](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/263) | [#315](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/315) | Supported for closure | Activation and result release emit distinct audited action identifiers. `test_form_lifecycle_audit.py`. |
| [#267](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/267) | [#314](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/314) | Supported for closure | Normal calendar-date ranges include the complete end day; explicit datetime bounds are preserved. `test_filter_validation.py inclusive-date tests`. |
| [#270](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/270) | [#317](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/317) | Supported for closure | Approval validates inputs, runs atomically and locks/rechecks Pending; successful transitions pass. `test_join_request_atomic_approval.py`. |
| [#271](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/271) | [#320](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/320) | Supported for closure | Removed assignments can be re-added or PATCH-reactivated; a valid question-bearing form generates assignments. `test_membership_reactivation.py + release valid-reactivation probe`. |
| [#278](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/278) | [#311](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/311) | Supported for closure | Configured Django password validators reject weak/common/numeric/similar passwords at creation/reset. `test_password_validation.py`. |

For #270, invalid-input persistence and state transitions were executed; competing approve/reject transactions and injected-failure rollback were not independently exercised in this review. The atomic block and row lock were inspected. For #271, five committed reactivation tests pass, its questionless fixture fails, and the additional ready-form reactivation probe passes. For #267, ordinary full-day boundaries pass; the maximum-date overflow is recorded under #266.

## Issues withheld from closing keywords

| Issue | Corresponding PR | Reason |
|---|---|---|
| [#266](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/266) | [#314](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/314) | Invalid calendar dates and date overflow still return HTTP 500. |
| [#268](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/268) | [#316](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/316); action catalog introduced in [#314](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/314) | Header/detail/hooks are improved, but the new action catalog bypasses tenant scope and authorization. |
| [#272](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/272) | [#318](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/318) with [#320](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/320) | The direct POST reactivation path bypasses serializer access checks. |

## Other reviewed open issues

No corresponding merged fix was established for these issues in the promotion; they receive no closing keyword. #277 is only partially improved by organization-update logging; structure and positional membership logging are separate outstanding paths.

- [#163](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/163) — Proposal: instrument granular usage analytics as a handover artifact
- [#234](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/234) — Assignment screens and completion totals silently omit records after the first API page
- [#236](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/236) — Adding a required question through the single-question endpoint leaves existing evaluations completed
- [#237](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/237) — Closed evaluation forms remain in the member's actionable pending queue
- [#239](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/239) — A failure in a later assignment rule leaves a partially generated matrix behind an HTTP 500
- [#242](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/242) — Accomplishment submission allows nonmembers, removed members and inactive organizations
- [#243](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/243) — Owners can permanently delete verified accomplishments without an audit event
- [#244](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/244) — Overlapping accomplishment edits and reviews can erase verification decisions
- [#245](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/245) — Accomplishment review silently hides records and pending work after the first API page
- [#246](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/246) — Portfolio request failures are displayed as empty accomplishment lists
- [#247](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/247) — Canceled review notes are reused when reviewing another member's accomplishment
- [#249](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/249) — Malformed organization identifiers cause HTTP 500 in portfolio list and create
- [#250](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/250) — Member accomplishment queries ignore status and type filters
- [#251](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/251) — Approval comments entered in the accomplishment review dialog are silently discarded
- [#258](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/258) — The audit page hides records beyond the first API page and reports incomplete totals
- [#259](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/259) — Updating an evaluation form creates no audit event
- [#264](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/264) — The audit page removes form identities and role-change details from event text
- [#265](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/265) — Audit request failures are displayed as an empty audit history
- [#269](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/269) — Organization analytics omit tenant checks and mix assignments from different organizations
- [#273](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/273) — Member and organization structure screens silently stop after the first 20 API records
- [#274](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/274) — Dashboard analytics share cache keys across active organizations
- [#275](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/275) — Current membership remains stale when the current-user profile is refreshed
- [#276](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/276) — Member mutations leave directory data, unit counts and the open role dialog stale
- [#277](https://github.com/CIT-U-Computer-Students-Society/IPES/issues/277) — Organization edits, structure changes and positional membership changes create no audit events

## Captured verification

Environment: Windows PowerShell, existing backend virtual environment, isolated native PostgreSQL 18.1 on localhost:55432. The test-instance marker and restricted role were validated. CI's configured baseline is PostgreSQL 17. Every database-backed run created and destroyed its own disposable test database; no development or production database was used.

| Category | Command / scenario | Observed result |
|---|---|---|
| Automated | backend: activate virtualenv, set IPES_TEST_PORT=55432, `python manage.py test --verbosity 2` | **FAIL** — 237 tests, 236 passing, 1 failure, no skips; 99.748 seconds. |
| Automated | frontend: `npm run test -- --run` | **PASS** — 70 tests in 14 files. |
| Regression | Temporary release audit/membership probes | **FAIL** — 7 test methods, 2 passing, 5 failing; runner reports 7 failures because one method has 3 failing subtests. |
| Other checks | frontend: `npm run build` | **PASS**, large-chunk warning. |
| Other checks | frontend: `npm run lint` | **PASS**, 0 errors and 2 Fast Refresh warnings. |
| Other checks | backend: `flake8 . --exclude=.venv,.codex-tests,.e2e` | **FAIL**, 1,199 diagnostic lines. No baseline comparison was performed. |
| Other checks | test settings: `python manage.py makemigrations --check --dry-run` | **PASS**, No changes detected. |
| Other checks | `node --test .github/scripts/*.test.cjs` | **PASS**, 25 tests, no failures/skips. |
| CI | GitHub check rollups on all 21 corresponding PRs | **NOT REPORTED** — all empty; no PR-validation pass established. |
| CI | Commit statuses, check runs and PR-triggered workflow runs at release head | **NOT REPORTED** — all empty. |
| Browser / deployment | Local Playwright, deployed dev UI and production smoke checks | **NOT RUN** in this review. |
| Release automation | Existing Release Please run on current main | **FAIL** — publish-releases reports Resource not accessible by integration. [Run](https://github.com/CIT-U-Computer-Students-Society/IPES/actions/runs/40901951786). This is a separate existing failure, not a test of dev. |

Django also emitted an unordered organization pagination warning. No passing CI status is inferred from workflow configuration, unrelated historical runs, or author-written PR descriptions.

Local evidence:
- [Full backend log](../../../../backend/.e2e/release-20261030-backend.log)
- [Combined review probes](../../../../backend/.e2e/release-20261030-all-probes.log)
- [Probe source](../../../../backend/.e2e/release_review_probes.py)
- [Frontend test log](../../../../frontend/release-20261030-vitest.log)
- [Frontend build log](../../../../frontend/release-20261030-build.log)
- [Frontend lint log](../../../../frontend/release-20261030-lint.log)
- [Backend lint log](../../../../backend/.e2e/release-20261030-flake8.log)

To reproduce the temporary probes from backend with the virtual environment activated:

```powershell
$env:IPES_TEST_PORT = '55432'
$env:PYTHONPATH = Join-Path $PWD '.e2e'
python manage.py test release_review_probes.ReleaseAuditReviewProbes release_review_probes.ReleaseMembershipReviewProbes --verbosity 2
```

## Publication status

No existing open dev-to-main PR was found. A complete proposed title/body is saved in [release_pr_description.md](release_pr_description.md). No release PR was opened and no branch was merged: the repository release skill requires both local suites to pass before opening the release PR, and the merge rule also requires successful CI. No approval is needed to finish this review; product fixes, the fixture correction and final validation remain before release publication.
