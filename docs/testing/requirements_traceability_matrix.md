# Requirements Traceability Matrix

Testing scope only. Stable IDs describe the proposed baseline; execution results belong to test reports. **Complete/Partial/Gap** describes browser-scenario mapping, not a pass verdict. Non-browser checks remain explicit. Reminder scope is unconfirmed.

| ID | Requirement | Planned verification | E2E scope |
|---|---|---|---|
| F01-FR01 | Validate registration and create a session | UI / API checks | Gap |
| F01-FR02 | Sign in, read profile, and invalidate logout sessions | S01 + DB | Complete |
| F01-FR03 | Update own profile and validate avatar changes | UI / API checks | Gap |
| F01-FR04 | Limit account administration to authorized scope | UI / API checks | Gap |
| F01-NFR01 | Enforce configured password policies | API / DB checks | Gap |
| F01-NFR02 | Protect mutations with CSRF and secure session cookies | S01, S06 + DB | Partial |
| F01-NFR03 | Prevent cross-organization account takeover or deactivation | API / DB checks | Gap |
| F02-FR01 | Create organizations with unique codes and creator administration | UI / API checks | Gap |
| F02-FR02 | Persist authorized organization selection and role routing | S01, S06 + DB | Partial |
| F02-FR03 | Save current organization settings | UI / API checks | Gap |
| F02-FR04 | Deactivate organizations while retaining history | UI / API checks | Gap |
| F02-NFR01 | Authorize every organization mutation | API / DB checks | Gap |
| F02-NFR02 | Refresh membership and settings after changes | API / DB checks | Gap |
| F02-NFR03 | Retain history and attribute events to the correct organization | API / DB checks | Gap |
| F03-FR01 | Validate join codes and reject duplicate applications | S07 + DB | Partial |
| F03-FR02 | Approve or reject requests with valid membership details | UI / API checks | Gap |
| F03-FR03 | Restore access when removed members rejoin | UI / API checks | Gap |
| F03-FR04 | Restrict join-request visibility and controlled fields | UI / API checks | Gap |
| F03-NFR01 | Revoke inactive administrators' decision authority | API / DB checks | Gap |
| F03-NFR02 | Keep failed and concurrent decisions atomic | API / DB checks | Gap |
| F03-NFR03 | Audit decisions under the target organization | API / DB checks | Gap |
| F04-FR01 | Manage organization units, types, and ranked positions | UI / API checks | Gap |
| F04-FR02 | Search complete member and structure directories | UI / API checks | Gap |
| F04-FR03 | Add, remove, and restore positional memberships | UI / API checks | Gap |
| F04-FR04 | Change organization roles without altering global identity | UI / API checks | Gap |
| F04-FR05 | Refresh directories, counts, and open editors | UI / API checks | Gap |
| F04-NFR01 | Require valid active organization enrollment | API / DB checks | Gap |
| F04-NFR02 | Keep tenant directories confidential | API / DB checks | Gap |
| F04-NFR03 | Audit organization, structure, and membership changes | API / DB checks | Gap |
| F05-FR01 | Create and edit form details and dates | S02 + DB | Partial |
| F05-FR02 | Configure and reorder validated, weighted questions | S02 + DB | Partial |
| F05-FR03 | Duplicate forms into unreleased drafts | UI / API checks | Gap |
| F05-FR04 | Control activation, deactivation, release, and soft deletion | S02, S04, S09 + DB | Partial |
| F05-FR05 | Invalidate stale completions after required-question changes | UI / API checks | Gap |
| F05-NFR01 | Commit successful creation despite audit failures | API / DB checks | Gap |
| F05-NFR02 | Persist valid form metadata within PostgreSQL limits | API / DB checks | Gap |
| F05-NFR03 | Audit form updates with correct tenant context | API / DB checks | Gap |
| F06-FR01 | Configure assignment filters, wildcards, and self-exclusion | UI / API checks | Gap |
| F06-FR02 | Generate unique assignments while preserving completed work | S02 + DB | Partial |
| F06-FR03 | Generate eligible assignments on membership activation | UI / API checks | Gap |
| F06-FR04 | Expose complete assignments and accurate totals | UI / API checks | Gap |
| F06-NFR01 | Require active participants and response-ready forms | API / DB checks | Gap |
| F06-NFR02 | Handle multi-rule generation failures consistently | API / DB checks | Gap |
| F06-NFR03 | Bound generation queries, duplicates, and batch sizes | Query budget + load | Gap |
| F07-FR01 | Offer actions only for response-ready assignments | UI / API checks | Gap |
| F07-FR02 | Save, resume, replace, and clear draft answers | S03 + DB | Partial |
| F07-FR03 | Validate required answers and calculate weighted scores | S03 + DB | Partial |
| F07-FR04 | Restrict responses by evaluator and submission state | S03 + DB | Partial |
| F07-NFR01 | Commit answers, completion state, and final score together | S03 + DB | Partial |
| F07-NFR02 | Prevent concurrent overwrites and duplicate responses | PostgreSQL locking | Gap |
| F07-NFR03 | Keep completion status consistent with current questions | API / DB checks | Gap |
| F08-FR01 | Release results and stop further responses | S04 + DB | Partial |
| F08-FR02 | Show released aggregates, breakdowns, and evaluator counts | S04 + DB | Partial |
| F08-FR03 | Keep evaluator identities anonymous in feedback | UI / API checks | Gap |
| F08-FR04 | Select released periods and performance history | UI / API checks | Gap |
| F08-NFR01 | Enforce release gating and anonymity on every endpoint | S04 + DB | Partial |
| F08-NFR02 | Aggregate only valid, complete evaluations | API / DB checks | Gap |
| F08-NFR03 | Distinguish activation and release audit events | API / DB checks | Gap |
| F09-FR01 | Calculate completion using canonical statuses | UI / API checks | Gap |
| F09-FR02 | Show accurate organization and unit participation | UI / API checks | Gap |
| F09-FR03 | Show form, question, performer, and unit summaries | UI / API checks | Gap |
| F09-FR04 | Export requested analytics safely and on demand | UI / API checks | Gap |
| F09-NFR01 | Isolate analytics queries and caches by organization | API / DB checks | Gap |
| F09-NFR02 | Keep complete dashboard totals current | API / DB checks | Gap |
| F09-NFR03 | Measure peak latency, errors, and enrollment capacity | Load + monitoring | Gap |
| F10-FR01 | Submit complete accomplishments to the intended organization | S05 + DB | Partial |
| F10-FR02 | Filter the member's own accomplishments | UI / API checks | Gap |
| F10-FR03 | Edit eligible evidence and control resubmission | UI / API checks | Gap |
| F10-FR04 | Render validated HTTP(S) proof links safely | UI / API checks | Gap |
| F10-NFR01 | Require active membership for portfolio submissions | API / DB checks | Gap |
| F10-NFR02 | Reject malformed organization selectors without persistence | API / DB checks | Gap |
| F10-NFR03 | Distinguish failed portfolio requests from empty results | S11 + DB | Partial |
| F11-FR01 | Expose every pending accomplishment to reviewers | UI / API checks | Gap |
| F11-FR02 | Retain review decisions and reviewer feedback | S05 + DB | Partial |
| F11-FR03 | Keep review drafts attached to the correct record | UI / API checks | Gap |
| F11-FR04 | Show verified evidence and evaluatee context | UI / API checks | Gap |
| F11-NFR01 | Prevent competing edits from undoing review decisions | API / DB checks | Gap |
| F11-NFR02 | Retain verified evidence and audit authorized changes | API / DB checks | Gap |
| F11-NFR03 | Attribute review audit events to the evidence organization | S05 + DB | Partial |
| F12-FR01 | Audit critical actions with actor and tenant context | UI / API checks | Gap |
| F12-FR02 | Honor organization headers across audit endpoints | UI / API checks | Gap |
| F12-FR03 | Search complete history with inclusive date boundaries | UI / API checks | Gap |
| F12-FR04 | Display identifiable records and distinct event types | UI / API checks | Gap |
| F12-FR05 | Export authorized, filtered audit history | UI / API checks | Gap |
| F12-NFR01 | Retain audit history through organization deactivation | API / DB checks | Gap |
| F12-NFR02 | Keep audit failures from rolling back successful writes | API / DB checks | Gap |
| F12-NFR03 | Validate audit filters and expose recoverable errors | API / DB checks | Gap |
| F12-NFR04 | Escape spreadsheet formulas in CSV exports | API / DB checks | Gap |
| X-NFR01 | Define and monitor availability targets and ownership | Operational monitoring | Gap |
| X-NFR02 | Measure representative load against agreed capacity targets | Load + capacity | Gap |
| X-NFR03 | Verify backup retention, recovery objectives, and restoration | Restore drill | Gap |
| X-NFR04 | Verify PostgreSQL constraints, rollback, and concurrency | PostgreSQL integrity | Gap |
| X-NFR05 | Verify deployed HTTPS, CSP, migrations, and storage | HTTPS deployment | Gap |
| X-NFR06 | Verify keyboard, accessibility, errors, and responsive layouts | S10 + DB | Partial |
| X-NFR07 | Cover tenant abuse, pagination, failures, and concurrency | S06, S08, S11 + DB; regression suites | Partial |
| A-FR01 | Persist organization reminder preferences | Scope decision | Gap |
| A-FR02 | Send scheduled reminders to eligible evaluators | Scope decision | Gap |
| A-NFR01 | Prevent duplicate reminders and enforce tenant eligibility | Scope decision | Gap |

| Scenario | Acceptance focus | Suite |
|---|---|---|
| S01 | Login, organization selection, profile, logout invalidation | Core |
| S02 | Questionnaire creation, activation, unique assignments | Core |
| S03 | Draft persistence, submission, weighted score | Core |
| S04 | Result release and member aggregate | Core |
| S05 | Portfolio submission, rejection, retained feedback | Core |
| S06 | Organization switching and rejected cross-tenant mutation | Core |
| S07 | Join request persistence | Expanded |
| S08 | Search beyond the first API page | Expanded |
| S09 | Soft deletion with retained history | Expanded |
| S10 | Keyboard navigation and automated accessibility | Expanded |
| S11 | Visible portfolio request failures | Expanded |

Each browser checkpoint requires screen assertions, committed PostgreSQL assertions, and attached evidence. API, load, operational, and manual checks need separate evidence; no coverage percentage substitutes for acceptance.
