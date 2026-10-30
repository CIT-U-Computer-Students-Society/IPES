# Follow-up review of PRs #323–#326 — 2026-10-30

> **Later verification:** The actor-name search finding recorded below was fixed in [#325](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/325) at `392c27dda28d8ffc07e7c3c9aa0ae64703f74876`. On the then-restacked [#326](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/326) at `674645c75321324c72acdb4b317e2af5cbd73768`, 256 backend tests, 70 frontend tests, and all nine release and name-search probes passed. GitHub reported no checks on those heads. These hashes are historical test references; later restacks can change PR head hashes without changing the tested code.

The fixes for **#266, #268 and #272 are verified on the new stack**. The original seven release-review probes now pass. At review time, one further search regression remained: actor first/last-name queries and CSV exports filtered by those names returned no matching events.

The PR descriptions for #323, #324, #325 and #326 were updated with independent verification evidence. Existing closing keywords remain appropriate for the three verified issues. No issue state, PR draft status, branch history or source code was changed by this review.

## Reviewed revisions and results

| PR | Revision | Independent result |
|---|---|---|
| [#323](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/323) | `d8a61b63e63fe2a510219927c1f2b3429d6e0d55` | Historical snapshot retained; subsequent fixes verified separately. |
| [#324](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/324) | `57dd8750487458f67973d7caf134ceb881529f2f` | **PASS**, 18 date-boundary/filter tests on this exact head. #266 is fixed. |
| [#325](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/325) | `a97d30fcf85e5ccfb35d2c8a1d9c7f2e44275e4e` | **PASS**, 22 catalog/search/calendar/tenant-read tests on this exact head. #268 is fixed; actor-name search remains incomplete. |
| [#326](https://github.com/CIT-U-Computer-Students-Society/IPES/pull/326) | `dbd26b40f936e98bd032cbd76b9da7014072fafb` | **PASS**, all 253 committed backend tests (86.466 s), including the repaired readiness fixture. #272 is fixed. |

The stack order is #323 → #324 → #325 → #326. All four remain open drafts. The current dev branch is still `c89460e65133daee8b422555115547476d791e1d`, so these verified fixes are **not yet part of the dev-to-main promotion**. No open dev-to-main release PR was found. The original [dev review](dev_to_main_review.md) and [release description](release_pr_description.md) remain snapshots of that dev revision, with their hold still applicable until the fixes reach dev.

Once the fixes are included in the promotion, #266, #268 and #272 can join the existing 20 supported issue references for a total of 23. The actor-name search finding is separate from the verified tenant-read defect in #268.

## Finding at review time (subsequently fixed)

**[P2] Restore actor-name search predicates in #325.** In `backend/apps/audit/views.py:163-169`, the restored general keyword filter checks action text, IP address and email, but omits `user_id__first_name` and `user_id__last_name`. Both predicates exist in main's version of the list filter.

A synthetic event by **Zinnia Quartz**, whose email and action text contain neither name, produces:
- `GET /api/audit/?q=Zinnia` → HTTP 200, count=0.
- `GET /api/audit/?q=Quartz` → HTTP 200, count=0.
- `GET /api/audit/export_csv/?q=Zinnia` → HTTP 200, header only.

The audit UI can filter locally by user name and sends its search text to CSV export, so name matching must remain consistent. Restore both predicates in the shared tenant-scoped queryset, and add list/CSV regression cases using names absent from email/action. [PR source](https://github.com/CIT-U-Computer-Students-Society/IPES/blob/a97d30fcf85e5ccfb35d2c8a1d9c7f2e44275e4e/backend/apps/audit/views.py#L163).

These probes ran on #326; its audit view is unchanged from #325, verified by an empty diff. The tests on main itself were not executed; the earlier name support is established from the main source.

## Independent verification evidence

Environment: Windows PowerShell, existing activated backend virtual environment, native isolated PostgreSQL 18.1 on localhost:55432. The marker and restricted role were validated. Every database-backed run created and destroyed its own disposable database. CI config uses PostgreSQL 17.

| Category | Command / scenario | Result |
|---|---|---|
| Automated | `python manage.py test --verbosity 2` on #326 | **PASS** — 253 tests, no failures/skips, 86.466 s. |
| Automated | `npm run test -- --run` | **PASS** — fresh run, 70 tests in 14 files. No frontend source/config changes across the stack; this result applies to the identical frontend tree. |
| Regression | #324 calendar bounds and filter tests | **PASS** — 18 tests. |
| Regression | #325 catalog/search/calendar/tenant-read tests | **PASS** — 22 tests. |
| Regression | Original release-review probes on #326 | **PASS** — all 7 probes; separate from the 253 committed tests. |
| Regression | Additional actor-name list/CSV probes | **FAIL** — 2 methods, 3 failure records because first/last names are separate subtests. |
| Other checks | Changed Python syntax/name lint (`flake8 --select=E9,F63,F7,F82`) | **PASS**, exit 0. Full style lint was not rerun. |
| Other checks | `git diff --check c89460e..dbd26b4` | **PASS**, exit 0. |
| Other checks | Check rollups of #323–#326 at review time | **NOT REPORTED**, all empty. CI success is not inferred from local results. |
| Other checks | Browser E2E, deployment smoke checks and release publication | **NOT RUN** in this follow-up. |

The full-suite fixture failures reported in the lower-layer PR descriptions remain accurately tied to their earlier revisions. Only the top stack includes the fixture correction. Regression counts overlap with the full committed suite and must not be added to it.

Django emitted staticfiles.W004 because the isolated review checkout has no frontend build, and an unordered organization pagination warning.

Local logs and probes:
- [#324 targeted log](../../../../backend/.e2e/review-pr324-targeted.log)
- [#325 targeted log](../../../../backend/.e2e/review-pr325-targeted.log)
- [#326 full backend log](../../../../backend/.e2e/review-pr326-backend.log)
- [Original probes, now passing](../../../../backend/.e2e/review-pr326-original-probes.log)
- [Name-search failure log](../../../../backend/.e2e/review-pr325-name-search.log)
- [Name-search probe source](../../../../backend/.e2e/review_name_search_probe.py)
- [Fresh frontend test log](../../../../frontend/release-20261030-stack-vitest.log)
