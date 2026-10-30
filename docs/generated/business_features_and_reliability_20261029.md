# IPES core business features and reliability assessment

**Assessment date:** 29 October 2026, Asia/Manila<br>
**Issue snapshot:** 29 October 2026, 14:09 Philippine time<br>
**Code reviewed and tested:** `dev` at [`235e0c2af7dd`](https://github.com/CIT-U-Computer-Students-Society/IPES/commit/235e0c2af7dde5d46477a80402b8b22740e59b3f)<br>
**Repository:** [CIT-U-Computer-Students-Society/IPES](https://github.com/CIT-U-Computer-Students-Society/IPES)

## Reliability overview

IPES implements the main end-to-end evaluation workflows and its existing local regression suites pass. The reviewed development snapshot nevertheless has **46 open bug reports**, including **14 suggested P1 issues** affecting authorization, confidentiality, retained evidence, reporting or committed writes. This supports an assessment of **implemented, with material reliability blockers**. It does not support describing the system as reliable for confidential evaluations across multiple organizations yet.

The highest-impact reports include an account-takeover chain ([#252][issue-252], [#254][issue-254]), unrelated users editing or physically deleting organizations ([#241][issue-241], [#260][issue-260]), unreleased individual scores and evaluator identities becoming visible ([#233][issue-233]), overwritten/deleted verified evidence ([#243][issue-243], [#244][issue-244]), and a successful API response for a form that was rolled back ([#256][issue-256]). These are issue-reported reproductions against test data, not claims that a production breach or outage occurred.

| Evidence | Snapshot result | What it establishes |
|---|---|---|
| Core business features | 12 | Coverage inventory below, organized around user outcomes |
| Core functional requirements | 51 | Required business behavior, with issue mappings or explicit evidence limits; advertised reminder requirements are listed separately |
| Feature-specific non-functional requirements | 37 | Security, integrity, consistency, recovery and performance expectations |
| Open bugs | 46: issues #233–#278 | Known failure backlog; 14 suggested P1 and 32 suggested P2 in issue bodies |
| Other open issue | [#163][issue-163] | Measurement/handover proposal; not an approved requirement or confirmed defect |
| Closed issues reviewed | 7 | Historical context, separately identified below |
| Backend regression suite | 95 run: 94 passed, 1 skipped | Existing tests pass on SQLite; row-lock concurrency was not exercised |
| Frontend regression suite | 58 passed in 12 files | Existing Vitest/React Testing Library coverage passes |
| Production reliability | Not established | No deployment, uptime, load, restore or production database validation was performed |

Issue counts are **unique issues**, not independent root causes, incident counts or a failure probability. Several reports overlap. Priority comes from the authors' **suggested priority in the issue bodies**, not an approved service-severity policy. The assessment is about the checked-out development snapshot; the deployed revision and production data were not inspected.

## How to read the requirements

Functional requirements (FR) describe what a workflow must do. Non-functional requirements (NFR) describe the qualities that make that workflow dependable. Requirements are synthesized from the [project manifesto][manifesto], [agent guide][agent-guide], [security documentation][security-doc], current API/UI behavior, and the expected behavior in GitHub reports. They are a traceability baseline for this assessment, not a claim that every item is already a formally approved specification.

Every requirement has a stable ID and an issue column:

- **Open gap:** a directly matching unresolved report describes a failure.
- **Shared-path risk:** another workflow reproduces a defect in a shared dependency; the specific consequence still needs its own verification.
- **Covered locally:** relevant automated checks passed, within the stated test scope.
- **Implemented / limited assurance:** code exists, but end-to-end or production verification is incomplete.
- **Unverified:** sufficient measurements or tests were not established.
- **No matching open issue found:** the tracker does not provide a matching current defect. This is not a pass or proof that the requirement is met.
- **Closed history:** retained as historical context, not counted as a current defect.

All issue links in the feature matrices refer to the same repository. The issue register at the end gives titles, primary feature ownership, suggested priority, reported evidence and requirement IDs. A report can map to several requirements; it is counted once in the overview.

## Feature risk map

Counts assign each open bug to one primary feature for inventory purposes. Related effects still appear under other affected requirements.

| Feature | Business outcome | Primary open bugs | Suggested P1 / P2 | Current reliability concern |
|---|---|---:|---:|---|
| F01: Account registration, sign-in and personal profiles | People can establish an account, authenticate and maintain their own identity. | 1 | 0 / 1 | Password-policy bypass; global account authority also affects this workflow. |
| F02: Organization creation, selection, settings and deactivation | Each organization has a separately managed workspace and a controlled lifecycle. | 4 | 3 / 1 | Unauthorized mutation/deletion; tenant audit attribution and stale settings. |
| F03: Joining, approval, rejection and rejoining | A join request becomes valid organization access through an authorized, complete decision. | 3 | 2 / 1 | Request retargeting, revoked authority and partial approval persistence. |
| F04: Organization structure, member directory and role administration | Administrators can maintain units, positions and memberships and understand who has access. | 7 | 2 / 5 | Shared-account control/disclosure, hidden members, inconsistent enrollment and stale management state. |
| F05: Evaluation form and question authoring | Administrators can build reusable, valid questionnaires and manage their lifecycle without corrupting completed work. | 4 | 1 / 3 | Stale completions, missing change history and false-success/schema risks. |
| F06: Rule-based assignment generation and distribution | Each eligible evaluator receives the intended evaluatees without manual pair-by-pair distribution. | 4 | 0 / 4 | Ineligible or impossible work, truncated matrices and partial generation. |
| F07: Answering evaluations, saving drafts and submitting scores | Members can finish actionable evaluations, retain drafts and receive a correctly calculated final score. | 1 | 0 / 1 | Closed work offered as actionable; shared logging and unverified concurrency risks. |
| F08: Results release and personal performance feedback | Members see their released performance and historical feedback without exposing confidential individual evaluations. | 2 | 1 / 1 | Premature individual result disclosure and indistinguishable release events. |
| F09: Dashboards, participation analytics and report exports | Progress and performance reports support sound decisions using the right organization's complete data. | 3 | 1 / 2 | Wrong completion counts, mixed-tenant aggregation and shared cache data. |
| F10: Member accomplishment portfolio | Members maintain an accurate, organization-scoped record of achievements and supporting proof. | 4 | 1 / 3 | Unauthorized submissions, ignored filters and failures shown as empty data. |
| F11: Accomplishment review and evaluator evidence context | Verified evidence and reviewer feedback remain complete, trustworthy and attached to the correct person. | 6 | 3 / 3 | Hidden review work, overwritten/deleted evidence and lost/misapplied notes. |
| F12: Audit history, investigation and audit export | Administrators can reconstruct what happened, who acted and which organization and records were affected. | 7 | 0 / 7 | Incomplete investigation history, invalid filters, lost context and unsafe CSV text. |

## Requirements by feature

### F01: Account registration, sign-in and personal profiles

**Users:** Members and administrators. **Purpose:** People can establish an account, authenticate and maintain their own identity.

**Implementation sources:** [`backend/apps/users/views.py`][source-1]; [`backend/apps/users/serializers.py`][source-2]; [`frontend/src/components/ProfileEditorDialog.tsx`][source-3].

**Relevant baseline tests:** [`backend/apps/users/tests/test_session_security.py`][source-4]; [`backend/apps/users/tests/test_avatars.py`][source-5]; [`frontend/src/components/__tests__/ProfileEditorDialog.test.tsx`][source-6]. These references show the verification starting point, not complete coverage of every requirement below.

**Functional requirements**

| ID | Requirement | Current assessment and failure impact | GitHub failure issue(s) |
|---|---|---|---|
| F01-FR01 | Register an account with validated identity fields and start a session after successful registration. | Limited assurance: registration/session tests pass; configured password policy is bypassed. | [#278][issue-278] — open |
| F01-FR02 | Sign in, obtain the current profile, and sign out with the server session invalidated. | Covered in local session tests; deployment cookie behavior was not checked. | No matching open failure issue found. |
| F01-FR03 | Edit one's own name and add, replace or remove a profile picture; reject invalid pictures without changing the profile. | Covered in local profile/avatar tests, including storage-failure handling; live object storage was not exercised. | No matching open failure issue found. |
| F01-FR04 | Allow explicitly authorized account administration without giving an organization administrator control of shared global credentials. | Open gap: tenant administrators can replace a shared user's password, email or global availability. | [#254][issue-254] — open |

**Non-functional requirements**

| ID | Requirement | Current assessment and failure impact | GitHub failure issue(s) |
|---|---|---|---|
| F01-NFR01 | Security: registration, admin-created accounts and password replacement must apply the configured password validators. | Open gap: serializers apply minimum length but bypass configured common/numeric/similarity checks. | [#278][issue-278] — open |
| F01-NFR02 | Security: mutations must use CSRF-protected sessions and production cookies must be host-only, HttpOnly and Secure. | Covered by local session and frontend API tests; actual HTTPS hosting remains unverified. | No matching open failure issue found. |
| F01-NFR03 | Identity isolation: access granted in one organization must not permit taking over or disabling a person's account in every organization. | Open gap: global account writes are exposed through tenant administration; join-request retargeting provides an additional attack chain. | [#254][issue-254], [#252][issue-252] — open |

### F02: Organization creation, selection, settings and deactivation

**Users:** Organization founders and administrators. **Purpose:** Each organization has a separately managed workspace and a controlled lifecycle.

**Implementation sources:** [`backend/apps/organizations/views/organizations.py`][source-7]; [`frontend/src/pages/SelectOrganization.tsx`][source-8]; [`frontend/src/pages/admin/Settings.tsx`][source-9].

**Relevant baseline tests:** [`frontend/src/contexts/__tests__/OrganizationContext.test.tsx`][source-10]; [`frontend/src/components/__tests__/organization-entry.test.tsx`][source-11]. These references show the verification starting point, not complete coverage of every requirement below.

**Functional requirements**

| ID | Requirement | Current assessment and failure impact | GitHub failure issue(s) |
|---|---|---|---|
| F02-FR01 | Create an organization with a unique join code and give its creator an administrator role. | Implemented in the creation path; creation events can have null or incorrect organization scope. | [#261][issue-261] — open |
| F02-FR02 | Select an authorized organization, retain the selection through navigation and enter the appropriate member/admin workspace. | Basic selection/navigation is covered locally; derived membership can retain old role or organization information after profile refresh. | [#275][issue-275] — open |
| F02-FR03 | Update organization name, description and contact email using current saved values. | Open gaps: unrelated authenticated users can update another organization; Settings can repopulate stale name/email. | [#241][issue-241], [#275][issue-275] — open |
| F02-FR04 | Deactivate an organization through the authorized confirmation workflow while preserving historical records. | Open gap: ordinary DELETE bypasses that workflow and physically deletes the organization and its audit history. | [#260][issue-260] — open |

**Non-functional requirements**

| ID | Requirement | Current assessment and failure impact | GitHub failure issue(s) |
|---|---|---|---|
| F02-NFR01 | Authorization: every organization mutation must require current authority over that organization, including generic PUT/PATCH/DELETE routes. | Open gaps: generic organization routes require authentication without the necessary tenant/admin restrictions. | [#241][issue-241], [#260][issue-260] — open |
| F02-NFR02 | Consistency: refreshed organization/profile data must immediately replace derived membership data and settings fields. | Open gap: independently cached current membership can remain stale after its source profile changes. | [#275][issue-275] — open |
| F02-NFR03 | Durability and traceability: organization history must survive deactivation, and emitted events must belong to the affected organization. | Open gaps: parent deletion cascades to audit records; client headers can redirect events to another tenant. | [#260][issue-260], [#261][issue-261] — open |

### F03: Joining, approval, rejection and rejoining

**Users:** Applicants and organization administrators. **Purpose:** A join request becomes valid organization access through an authorized, complete decision.

**Implementation sources:** [`backend/apps/organizations/views/join_requests.py`][source-12]; [`backend/apps/organizations/views/organizations.py`][source-7]; [`backend/apps/organizations/serializers.py`][source-13].

**Relevant baseline tests:** [`backend/apps/organizations/tests/test_views.py`][source-14]. These references show the verification starting point, not complete coverage of every requirement below.

**Functional requirements**

| ID | Requirement | Current assessment and failure impact | GitHub failure issue(s) |
|---|---|---|---|
| F03-FR01 | Submit a join request using a valid organization code; reject duplicate pending requests and applications by an existing member. | Implemented with explicit checks. Historical self-application defect is closed; that specific regression was not rerun separately. | No matching open failure issue found. Closed history: [#27][issue-27]. |
| F03-FR02 | Approve a pending request with a valid unit, position and Admin/Member role, or reject it through an explicit decision. | Open gaps: revoked admins retain decision authority; invalid approval input can fail after writing membership state. | [#253][issue-253], [#270][issue-270] — open |
| F03-FR03 | Restore appropriate organization access when a removed member is approved to rejoin. | Reactivation code exists; historical rejoin issue is closed. This is distinct from the currently broken positional re-add workflow in F04. | No matching open failure issue found. Closed history: [#29][issue-29]. |
| F03-FR04 | Limit join-request visibility and modification to the applicant and authorized administrators; keep requester, organization and decision fields controlled. | Open gap: unscoped CRUD permits other users' requests to be read, retargeted, updated and deleted. | [#252][issue-252] — open |

**Non-functional requirements**

| ID | Requirement | Current assessment and failure impact | GitHub failure issue(s) |
|---|---|---|---|
| F03-NFR01 | Authorization: removal of an administrator or deactivation of the organization must immediately revoke approval/rejection authority. | Open gap: approval/rejection role checks omit active-state requirements. | [#253][issue-253] — open |
| F03-NFR02 | Transaction integrity: failed approval must leave no partial membership, access role, assignment or decision; competing decisions must not both win. | Open gap: invalid roles produce HTTP 500 after membership persistence. Concurrent PostgreSQL approval/rejection was not tested in the issue. | [#270][issue-270] — open |
| F03-NFR03 | Traceability: onboarding decisions must emit audit events under the organization actually being joined. | Open gap: organization logging can use a conflicting request header instead of the affected organization. | [#261][issue-261] — open |

### F04: Organization structure, member directory and role administration

**Users:** Organization administrators. **Purpose:** Administrators can maintain units, positions and memberships and understand who has access.

**Implementation sources:** [`backend/apps/organizations/views/units.py`][source-15]; [`backend/apps/organizations/views/positions.py`][source-16]; [`backend/apps/organizations/views/memberships.py`][source-17]; [`frontend/src/pages/admin/Users.tsx`][source-18]; [`backend/apps/users/serializers.py`][source-2].

**Relevant baseline tests:** [`backend/apps/organizations/tests/test_models.py`][source-19]; [`frontend/src/hooks/__tests__/useUsers.test.tsx`][source-20]. These references show the verification starting point, not complete coverage of every requirement below.

**Functional requirements**

| ID | Requirement | Current assessment and failure impact | GitHub failure issue(s) |
|---|---|---|---|
| F04-FR01 | Create and update unit types, units and ranked positions within the active organization. | Implemented, but structure lists/selectors omit records beyond page one and administrative changes lack audit events. | [#273][issue-273], [#277][issue-277] — open |
| F04-FR02 | List and search all organization members, roles, units, positions and pending requests with accurate totals. | Open gap: management hooks discard pagination metadata and expose only the first 20 records. | [#273][issue-273] — open |
| F04-FR03 | Add or remove positional memberships and restore the same assignment when needed. | Open gap: removal retains an inactive unique row; create rejects the duplicate and active-only detail lookup prevents reactivation. | [#271][issue-271] — open |
| F04-FR04 | Change organization Admin/Member roles or remove organization access while keeping the shared account's global identity intact. | Open gap in the adjacent user-administration API: tenant admins can change global credentials or deactivate the entire account. | [#254][issue-254] — open |
| F04-FR05 | Refresh the directory, unit counts and an open role editor after successful membership changes or join approval. | Open gap: affected queries and selected-user snapshots remain stale after success. | [#276][issue-276] — open |

**Non-functional requirements**

| ID | Requirement | Current assessment and failure impact | GitHub failure issue(s) |
|---|---|---|---|
| F04-NFR01 | Enrollment integrity: positional membership must require an active user with valid organization access and compatible organization structure. | Open gap: direct membership writes can accept a user with no active organization role. | [#272][issue-272] — open |
| F04-NFR02 | Confidentiality: a tenant-admin directory response must contain only that tenant's membership details; a person's own selector profile may include their other organizations. | Open gap: managed-user serializers disclose a shared user's memberships and Admin roles in unrelated organizations. | [#255][issue-255] — open |
| F04-NFR03 | Auditability: organization edits and structure/membership changes must identify the actor, affected record and organization. | Open gaps: events are missing on these mutations; events that are emitted can also be assigned to the wrong tenant. | [#277][issue-277], [#261][issue-261] — open |

### F05: Evaluation form and question authoring

**Users:** Organization administrators. **Purpose:** Administrators can build reusable, valid questionnaires and manage their lifecycle without corrupting completed work.

**Implementation sources:** [`backend/apps/evaluations/views/forms.py`][source-21]; [`backend/apps/evaluations/views/questions.py`][source-22]; [`backend/apps/evaluations/serializers.py`][source-23]; [`frontend/src/pages/admin/FormBuilder.tsx`][source-24].

**Relevant baseline tests:** [`backend/apps/evaluations/tests/test_question_writes.py`][source-25]; [`backend/apps/evaluations/tests/test_schema_constraints.py`][source-26]. These references show the verification starting point, not complete coverage of every requirement below.

**Functional requirements**

| ID | Requirement | Current assessment and failure impact | GitHub failure issue(s) |
|---|---|---|---|
| F05-FR01 | Create and edit a form's title, description and evaluation dates. | Implemented, but a caught audit-write error can return successful creation for a rolled-back form; ordinary updates create no event. | [#256][issue-256], [#259][issue-259] — open |
| F05-FR02 | Create and reorder supported question types with required/optional flags, score bounds and weights. | Validation/reorder paths have local test coverage. Consistency of adding required questions to used forms is tracked separately below. | No matching open failure issue found. |
| F05-FR03 | Duplicate an existing form and its questions into a new inactive, unreleased form. | Implemented in the duplicate action; no dedicated end-to-end duplication regression was established in this review. | No matching open failure issue found. |
| F05-FR04 | Activate only a ready form, deactivate it, release results and soft-delete it through controlled lifecycle actions. | Dedicated actions exist. Signal-driven generation can still issue questionless work, and release is logged as activation. | [#238][issue-238], [#263][issue-263] — open |
| F05-FR05 | Apply a consistent content-change policy when editing used forms: completed status/scores cannot survive a newly required unanswered question. | Open gap: single-question creation omits the reset applied by bulk creation/update paths. Historical edit/reactivation issue is closed. | [#236][issue-236] — open Closed history: [#32][issue-32]. |

**Non-functional requirements**

| ID | Requirement | Current assessment and failure impact | GitHub failure issue(s) |
|---|---|---|---|
| F05-NFR01 | Durability: a successful create response must refer to a form that was committed, even if best-effort audit logging fails. | Open gap: swallowed audit insert failure poisons the surrounding transaction and creation can falsely return HTTP 201. | [#256][issue-256] — open |
| F05-NFR02 | Database compatibility: all valid form titles must fit the persisted audit representation without losing their context. | Open risk: a valid 255-character title produces an action longer than varchar(255). SQLite accepted it; PostgreSQL rejection was not exercised. | [#257][issue-257] — open |
| F05-NFR03 | Auditability: successful general form updates must produce an identifiable change event under the correct organization. | Open gap: inherited PUT/PATCH saves do not call the form-update logging action. | [#259][issue-259] — open |

### F06: Rule-based assignment generation and distribution

**Users:** Organization administrators and newly enrolled members. **Purpose:** Each eligible evaluator receives the intended evaluatees without manual pair-by-pair distribution.

**Implementation sources:** [`backend/apps/evaluations/views/rules.py`][source-27]; [`backend/apps/evaluations/services.py`][source-28]; [`backend/apps/organizations/signals.py`][source-29]; [`frontend/src/pages/admin/Assignments.tsx`][source-30].

**Relevant baseline tests:** [`backend/apps/evaluations/tests/test_generation_analytics.py`][source-31]. These references show the verification starting point, not complete coverage of every requirement below.

**Functional requirements**

| ID | Requirement | Current assessment and failure impact | GitHub failure issue(s) |
|---|---|---|---|
| F06-FR01 | Define evaluator/evaluatee unit and position filters, including wildcards and optional self-exclusion. | Covered locally across 32 filter/self-exclusion combinations. | No matching open failure issue found. |
| F06-FR02 | Generate the expected assignment matrix and preserve existing completed work when rules overlap or generation is repeated. | Pair idempotence and completed-state preservation are covered; request-wide failure handling remains defective. | [#239][issue-239] — open |
| F06-FR03 | Automatically generate valid assignments when a membership is created or reactivated. | Implemented by Membership.save signals; readiness and active-access eligibility differ from the required policy. | [#238][issue-238], [#235][issue-235] — open |
| F06-FR04 | Let administrators inspect the complete assignment matrix and totals, and members reach all their assigned work. | Open gap: the shared list hook returns only the first API page. | [#234][issue-234] — open |

**Non-functional requirements**

| ID | Requirement | Current assessment and failure impact | GitHub failure issue(s) |
|---|---|---|---|
| F06-NFR01 | Eligibility: generate only for participants with active organization access and for forms ready to accept answers. | Open gaps: revoked/missing organization roles are not part of candidate eligibility, and membership signals can generate work with no questions. | [#235][issue-235], [#238][issue-238] — open |
| F06-NFR02 | Failure integrity: a multi-rule generation request must either complete atomically or expose durable, auditable partial progress. | Open gap: a later rule failure leaves earlier pairs committed behind an opaque HTTP 500. | [#239][issue-239] — open |
| F06-NFR03 | Scalability: generation must deduplicate people, avoid per-pair queries and bound in-memory insert batches. | Local query-budget and batching tests pass, including 552 pairs. Production latency and capacity remain unmeasured; #163 is a related proposal. | No matching open failure issue found. Related proposal: [#163][issue-163] (not a failure finding). |

### F07: Answering evaluations, saving drafts and submitting scores

**Users:** Assigned evaluators. **Purpose:** Members can finish actionable evaluations, retain drafts and receive a correctly calculated final score.

**Implementation sources:** [`backend/apps/evaluations/services.py`][source-28]; [`backend/apps/evaluations/views/responses.py`][source-32]; [`backend/apps/evaluations/views/assignments.py`][source-33]; [`frontend/src/pages/officer/EvaluationForm.tsx`][source-34].

**Relevant baseline tests:** [`backend/apps/evaluations/tests/test_response_integrity.py`][source-35]; [`backend/apps/evaluations/tests/test_concurrent_answers.py`][source-36]. These references show the verification starting point, not complete coverage of every requirement below.

**Functional requirements**

| ID | Requirement | Current assessment and failure impact | GitHub failure issue(s) |
|---|---|---|---|
| F07-FR01 | Show Start/Continue only for assignments whose forms still accept responses, while preserving closed work as history. | Open gap: closed forms remain in my_pending and the UI offers actions that subsequently fail. | [#237][issue-237] — open |
| F07-FR02 | Save and resume drafts, replace changed answers and remove cleared optional answers without creating duplicates. | Covered by local draft/upsert/uniqueness tests. | No matching open failure issue found. |
| F07-FR03 | Require all mandatory answers, validate types and finite score bounds, and calculate weighted totals on the server before marking Completed. | Covered locally, including zero scores, blank text, invalid values, null/zero/very large weights and atomic invalid-batch rejection. | No matching open failure issue found. |
| F07-FR04 | Allow only the assigned evaluator to change responses and reject further writes after completion or form closure. | Covered by local response-authorization and state tests; this does not cover assignment result disclosure in F08. | No matching open failure issue found. |

**Non-functional requirements**

| ID | Requirement | Current assessment and failure impact | GitHub failure issue(s) |
|---|---|---|---|
| F07-NFR01 | Durability: successful final submission must mean answers, final status and total score were committed; audit failure must follow an explicit contract. | Shared-path risk: submission calls the same audit helper inside a transaction as the reproduced false-success form-creation bug. Submission-specific fault injection is still needed. | [#256][issue-256] — open |
| F07-NFR02 | Concurrency: simultaneous draft/submit requests must not overwrite a committed result or create duplicate answers. | Row-lock implementation and a dedicated test exist; that test was skipped on SQLite. PostgreSQL concurrency is unverified. | No matching open failure issue found. |
| F07-NFR03 | Completion integrity: the stored score and Completed state must still represent every current required question. | Open gap through form editing: adding a required question by the single-question endpoint leaves an old completion and score intact. | [#236][issue-236] — open |

### F08: Results release and personal performance feedback

**Users:** Administrators releasing results and members receiving feedback. **Purpose:** Members see their released performance and historical feedback without exposing confidential individual evaluations.

**Implementation sources:** [`backend/apps/evaluations/views/forms.py`][source-21]; [`backend/apps/evaluations/views/assignments.py`][source-33]; [`frontend/src/pages/officer/Results.tsx`][source-37].

**Relevant baseline tests:** [`backend/apps/evaluations/tests/test_response_integrity.py`][source-35]. These references show the verification starting point, not complete coverage of every requirement below.

**Functional requirements**

| ID | Requirement | Current assessment and failure impact | GitHub failure issue(s) |
|---|---|---|---|
| F08-FR01 | Allow an authorized administrator to release results and stop further response entry for that form. | Dedicated action sets released/inactive flags; its audit event is indistinguishable from activation. | [#263][issue-263] — open |
| F08-FR02 | Show a member's released aggregate overall score, score breakdown and evaluator count for the selected period. | Implemented in my_performance with organization/release filters; assignment list/detail exposes a separate route to unreleased individual scores. | [#233][issue-233] — open |
| F08-FR03 | Show feedback without evaluator identity in the member-facing results workflow. | Aggregate feedback omits identity, but incoming assignment records expose the evaluator alongside the individual score. | [#233][issue-233] — open |
| F08-FR04 | Allow members to select an available released period and inspect performance history. | Implemented in my_performance and Results; complete history correctness, including repeated period titles, was not independently validated. | No matching open failure issue found. |

**Non-functional requirements**

| ID | Requirement | Current assessment and failure impact | GitHub failure issue(s) |
|---|---|---|---|
| F08-NFR01 | Confidentiality: every member-accessible endpoint must enforce release gating and the intended evaluator anonymity policy, not just the summary endpoint. | Open gap: evaluatees can obtain incoming individual scores and evaluator name/email/ID before release. | [#233][issue-233] — open |
| F08-NFR02 | Result integrity: released aggregates must be based on complete, valid evaluations rather than stale completion states. | Open dependency gap: newly required questions can leave pre-existing scores marked complete. | [#236][issue-236] — open |
| F08-NFR03 | Traceability: activating a form and releasing its results must have distinct persisted audit event types. | Open gap: both transitions write FORM_PUBLISHED with the same metadata. | [#263][issue-263] — open |

### F09: Dashboards, participation analytics and report exports

**Users:** Organization administrators and members viewing progress. **Purpose:** Progress and performance reports support sound decisions using the right organization's complete data.

**Implementation sources:** [`backend/apps/organizations/views/organizations.py`][source-7]; [`backend/apps/evaluations/views/analytics.py`][source-38]; [`frontend/src/pages/admin/Dashboard.tsx`][source-39]; [`frontend/src/pages/admin/Analytics.tsx`][source-40].

**Relevant baseline tests:** [`backend/apps/evaluations/tests/test_generation_analytics.py`][source-31]; [`frontend/src/components/__tests__/analytics-export.test.tsx`][source-41]; [`frontend/src/hooks/evaluations/__tests__/analytics.test.tsx`][source-42]. These references show the verification starting point, not complete coverage of every requirement below.

**Functional requirements**

| ID | Requirement | Current assessment and failure impact | GitHub failure issue(s) |
|---|---|---|---|
| F09-FR01 | Report completed evaluations and completion percentage using the backend's canonical statuses. | Open gap: admin dashboard counts Submitted, while the backend stores Completed. | [#240][issue-240] — open |
| F09-FR02 | Show accurate organization and unit participation counts for the active organization. | Open gaps: server aggregation counts shared users' foreign-organization assignments; list-derived totals can truncate at page one. | [#269][issue-269], [#234][issue-234] — open |
| F09-FR03 | Show per-form performance, question/category summaries, top performers and unit breakdowns. | Per-form analytics and empty/zero boundaries have local tests; this does not establish correctness of the separate organization-summary endpoints. | No matching open failure issue found. |
| F09-FR04 | Export selected-form analytics as CSV/JSON with raw responses fetched only on demand and no download on export-request failure. | Covered by local analytics/export tests. CSV safety is not established by those tests; #262 covers audit CSV specifically. | No matching open failure issue found. |

**Non-functional requirements**

| ID | Requirement | Current assessment and failure impact | GitHub failure issue(s) |
|---|---|---|---|
| F09-NFR01 | Tenant isolation: authorize analytics reads and restrict both aggregate queries and displayed cached data to the active organization. | Open gaps: organization APIs omit authorization/scope checks and two dashboard hooks share cache keys across tenants. | [#269][issue-269], [#274][issue-274] — open |
| F09-NFR02 | Consistency: dashboard totals must describe the full relevant data set and refresh under the selected organization. | Open gaps: wrong status arithmetic, first-page assignment totals and shared tenant cache entries produce misleading summaries. | [#240][issue-240], [#234][issue-234], [#274][issue-274] — open |
| F09-NFR03 | Performance and operability: make measured peak latency, error rate and capacity available before asserting real-time reliability at expected enrollment. | Unverified: local query tests are available, but no production load/latency evidence was established. #163 proposes measurement and is not an approved requirement. | No matching open failure issue found. Related proposal: [#163][issue-163] (not a failure finding). |

### F10: Member accomplishment portfolio

**Users:** Members recording evidence of their work. **Purpose:** Members maintain an accurate, organization-scoped record of achievements and supporting proof.

**Implementation sources:** [`backend/apps/portfolio/views/accomplishments.py`][source-43]; [`backend/apps/portfolio/serializers.py`][source-44]; [`frontend/src/pages/officer/Accomplishments.tsx`][source-45].

**Relevant baseline tests:** [`backend/apps/portfolio/test_security.py`][source-46]. These references show the verification starting point, not complete coverage of every requirement below.

**Functional requirements**

| ID | Requirement | Current assessment and failure impact | GitHub failure issue(s) |
|---|---|---|---|
| F10-FR01 | Submit an accomplishment with title, description, type, completion date and optional proof link into the intended organization's queue. | Open gap: unaffiliated/removed users and inactive organizations are accepted by the create path. | [#242][issue-242] — open |
| F10-FR02 | List the member's own accomplishments and apply advertised status/type filters consistently. | Open gap in the API: regular-member queries return before status/type filtering. The current page also filters its downloaded array locally. | [#250][issue-250] — open |
| F10-FR03 | Edit Pending/Rejected work and resubmit it through the intended verification lifecycle; prevent ordinary edits to Verified evidence. | Basic status guards exist; a stale overlapping edit can erase a successful verification decision. | [#244][issue-244] — open |
| F10-FR04 | Accept HTTP(S) proof links and render them safely without permitting executable schemes or injected markup. | Targeted backend/frontend link and content-security tests pass; this is not an assessment of the external evidence itself. | No matching open failure issue found. |

**Non-functional requirements**

| ID | Requirement | Current assessment and failure impact | GitHub failure issue(s) |
|---|---|---|---|
| F10-NFR01 | Authorization: creating portfolio evidence must require active membership in an active organization. | Open gap: authentication and an existing organization ID are sufficient for creation. | [#242][issue-242] — open |
| F10-NFR02 | Robustness: malformed organization selectors must return controlled client errors and never cause server failure or persistence. | Open gap: malformed selectors cause HTTP 500 in list/create. | [#249][issue-249] — open |
| F10-NFR03 | Recoverability and usability: a failed portfolio request must be distinguishable from an empty portfolio and offer recovery. | Open gap: member and admin portfolio screens show empty lists and zero counts after request failures. | [#246][issue-246] — open |

### F11: Accomplishment review and evaluator evidence context

**Users:** Reviewing administrators and evaluators consulting verified achievements. **Purpose:** Verified evidence and reviewer feedback remain complete, trustworthy and attached to the correct person.

**Implementation sources:** [`backend/apps/portfolio/views/accomplishments.py`][source-43]; [`frontend/src/pages/admin/AdminAccomplishments.tsx`][source-47]; [`frontend/src/pages/officer/EvaluationForm.tsx`][source-34].

**Relevant baseline tests:** [`backend/apps/portfolio/test_security.py`][source-46]. These references show the verification starting point, not complete coverage of every requirement below.

**Functional requirements**

| ID | Requirement | Current assessment and failure impact | GitHub failure issue(s) |
|---|---|---|---|
| F11-FR01 | Expose every pending accomplishment to reviewers, with complete totals, search and reachable older records. | Open gap: more than 20 records can hide an old Pending item while the screen reports Pending 0. | [#245][issue-245] — open |
| F11-FR02 | Verify or reject a pending accomplishment and retain the intended decision and reviewer feedback. | Open gaps: approval notes are silently discarded and overlapping edits/reviews can overwrite decisions. | [#251][issue-251], [#244][issue-244] — open |
| F11-FR03 | Keep a review draft attached to the selected accomplishment and clear or explicitly preserve it when canceling or switching records. | Open gap: canceled notes from one member are reused and can be submitted for another member. | [#247][issue-247] — open |
| F11-FR04 | Show the evaluatee's verified accomplishments and unit/position context during peer evaluation. | Implemented by evaluatee_profile. Verified evidence can disappear through owner DELETE; name fallback for members without a position exists, and the historical name issue is closed. | [#243][issue-243] — open Closed history: [#30][issue-30]. |

**Non-functional requirements**

| ID | Requirement | Current assessment and failure impact | GitHub failure issue(s) |
|---|---|---|---|
| F11-NFR01 | Concurrency and integrity: an edit/review must not silently undo a successful competing review; the losing request needs an explicit outcome. | Open gap: deterministic interleavings overwrite verification or rejection. Real PostgreSQL concurrent-load verification is still absent. | [#244][issue-244] — open |
| F11-NFR02 | Retention and accountability: Verified evidence must follow explicit deletion/history rules and authorized changes must be audited. | Open gap: owners can physically delete Verified records without an audit event. | [#243][issue-243] — open |
| F11-NFR03 | Audit isolation: the review decision's audit organization must equal the accomplishment's organization, even when request selectors conflict. | Open gap: query and header scope can diverge, writing the successful review event under the wrong organization. | [#248][issue-248] — open |

### F12: Audit history, investigation and audit export

**Users:** Organization administrators investigating important changes. **Purpose:** Administrators can reconstruct what happened, who acted and which organization and records were affected.

**Implementation sources:** [`backend/apps/audit/views.py`][source-48]; [`backend/apps/audit/utils.py`][source-49]; [`backend/apps/audit/models.py`][source-50]; [`frontend/src/hooks/useAudit.ts`][source-51]; [`frontend/src/pages/admin/AuditLog.tsx`][source-52].

**Relevant baseline tests:** [`backend/apps/audit/tests/test_models.py`][source-53]; [`backend/apps/audit/tests/test_views.py`][source-54]. These references show the verification starting point, not complete coverage of every requirement below.

**Functional requirements**

| ID | Requirement | Current assessment and failure impact | GitHub failure issue(s) |
|---|---|---|---|
| F12-FR01 | Record critical authentication, organization, membership, form, evaluation and portfolio actions with actor, time, IP and appropriate tenant context. | Open gaps: organization/structure/membership/form updates omit events; emitted events can have incorrect tenant scope. | [#277][issue-277], [#259][issue-259], [#261][issue-261], [#248][issue-248] — open |
| F12-FR02 | Retrieve organization-scoped audit lists, details and specialized filters using the application's organization-header contract. | Open gap: audit reads ignore the header; header-only lists are empty and detail/filter hooks cannot retrieve expected records. | [#268][issue-268] — open |
| F12-FR03 | Search/filter the complete history by actor, action and date, including every event on the selected end date. | Open gaps: the page omits later API pages, and valid date ranges exclude most of the final day. | [#258][issue-258], [#267][issue-267] — open |
| F12-FR04 | Display enough event detail to identify the form or member changed and distinguish activation from results release. | Open gaps: frontend formatting strips stored identities/role details; release and activation share an event type. | [#264][issue-264], [#263][issue-263] — open |
| F12-FR05 | Export the authorized, filtered audit history as CSV for investigation. | Export exists, but unvalidated filter values can fail with HTTP 500 and untrusted cells retain spreadsheet formula prefixes. | [#266][issue-266], [#262][issue-262] — open |

**Non-functional requirements**

| ID | Requirement | Current assessment and failure impact | GitHub failure issue(s) |
|---|---|---|---|
| F12-NFR01 | Retention: audit history must survive organization deactivation and must not be removable through a parent DELETE cascade. | Open gap: an unrelated authenticated caller can physically delete the parent organization and its audit records. | [#260][issue-260] — open |
| F12-NFR02 | Fault tolerance: best-effort audit writes must not roll back business writes behind a successful response; valid metadata must fit the production schema. | Open gaps/risks: caught database errors can poison outer transactions and long valid titles exceed the action column. | [#256][issue-256], [#257][issue-257] — open |
| F12-NFR03 | Robustness and transparency: validate filters and show an explicit query error/retry state rather than a successful empty history. | Open gaps: malformed filters cause server errors and the page renders failed requests as No audit logs found. | [#266][issue-266], [#265][issue-265] — open |
| F12-NFR04 | Export safety: spreadsheet applications must treat user-controlled CSV text as literal data. | Open gap: audit export preserves executable formula prefixes. This issue does not by itself establish the safety of analytics CSV. | [#262][issue-262] — open |

## Cross-cutting assurance gaps

These requirements apply to all 12 features. They are listed separately because passing unit tests or closing a feature bug cannot establish operational reliability. Numerical targets below are **not invented**: where none was established, the requirement is to agree a target and gather evidence.

| ID | Non-functional requirement | Current evidence or limitation | GitHub failure issue(s) |
|---|---|---|---|
| X-NFR01 | Availability: define the service window, a measurable availability target, monitoring and a response owner. | Unverified. No uptime/error-budget or incident evidence was assessed. #163 discusses capacity telemetry and explicitly excludes alerting/on-call; it does not fully cover this requirement. | No matching failure issue found. [#163][issue-163] is related only. |
| X-NFR02 | Capacity: establish representative organization/member/form sizes and acceptable response time/error rate during registration, evaluation deadlines and result release. | Unverified. Query-budget tests demonstrate bounded query behavior on fixtures, not peak throughput or p95/p99 production latency. No accepted latency/load target was established. | No matching measured-failure issue found. Related proposal [#163][issue-163]; historical [#8][issue-8] is closed as not planned. |
| X-NFR03 | Recovery: define backup retention, a recovery-point objective, a recovery-time objective and a repeatable restore procedure covering the database and uploaded media. | Unverified. The manifesto describes managed backups, but no restore drill, configured retention or recovery timing was established. A provider capability does not establish a successful application restore. | No matching issue found. [#260][issue-260] demonstrates destructive loss risk, not backup/restore validation. |
| X-NFR04 | Production database integrity: validate PostgreSQL-specific constraints, rollback behavior and concurrent state transitions on an isolated representative database. | Unverified in this assessment. Default tests use SQLite and skip the row-lock test. Long audit strings and overlapping workflows need database-specific evidence. | [#257][issue-257], [#244][issue-244], [#270][issue-270] identify relevant risks; [#256][issue-256] supplies shared transaction-failure evidence. |
| X-NFR05 | Deployment correctness: verify actual HTTPS cookies/origins/CSP, required migrations, media-storage failure behavior and the deployed application revision. | Local session/security/storage tests provide partial assurance. No live deployment or migration application was inspected. | No matching current deployment failure issue found. |
| X-NFR06 | Accessibility and usability: primary member/admin workflows must work with keyboard navigation, focus management, understandable errors and supported screen sizes. | Shared Mantine primitive tests exist, but a complete keyboard/screen-reader/mobile workflow audit was not performed. No formal accessibility target was established here. | [#246][issue-246] and [#265][issue-265] document specific misleading error states; no issue found for comprehensive accessibility verification. |
| X-NFR07 | Regression assurance: tests and CI must cover reported failures, adversarial tenants, more than one page and failed/overlapping operations before stronger reliability claims. | Existing suites pass while 46 bugs remain open. CI workflow definitions were read; actual CI runs and branch-protection settings were not inspected. Lint steps currently use continue-on-error. | Failure-specific regression work belongs with #233–#278; no separate test-coverage/CI enforcement issue was found. |

## Advertised capability that is not established as working

The Settings page displays automatic email reminder controls. In the reviewed source, `autoReminders` and `reminderDaysBefore` are component state, while the save handler persists organization name, description and email. A working reminder schedule/delivery path was not established. These controls should not be counted as delivered automation.

| ID | Type | Requirement implied by the visible controls | Current assessment | GitHub failure issue(s) |
|---|---|---|---|---|
| A-FR01 | Functional | Save automatic reminder enablement and lead time so they survive reload and apply to the organization. | Untracked source observation: values are local component state and are not included in the save mutation. | No matching issue found; not filed by this assessment. |
| A-FR02 | Functional | Send reminders for eligible pending evaluations using the configured schedule and sender information. | Unverified/incomplete capability: no corresponding scheduling or delivery implementation was established in the reviewed workflow. | No matching issue found; not filed by this assessment. |
| A-NFR01 | Non-functional | If reminder delivery becomes supported, retries must avoid duplicate mail and respect tenant scope and closed evaluations. | Proposed acceptance requirement for the advertised capability; no delivery reliability evidence was established. | No matching issue found. |

Source: [`frontend/src/pages/admin/Settings.tsx`][source-9]. No messages were sent. Notification toasts already present in the app are separate from automated email delivery.

## Verification performed for this assessment

Both suites were rerun against the reviewed working-tree application code. The repository already had unrelated untracked review/plan files; those were preserved. This task changes documentation only.

| Check | Command and context | Observed result | Interpretation |
|---|---|---|---|
| Backend suite | Activate `backend/.venv/Scripts/Activate.ps1`, then `python manage.py test` from `backend/` | Exit 0; 95 tests in 28.431 seconds; OK (skipped=1); Django system check reported no issues | 94 passed. The dedicated concurrent-submission test requires real row locks and is skipped on SQLite. |
| Frontend suite | `npm run test -- --run` from `frontend/` | Exit 0; 12 files passed, 58 tests passed; duration 10.85 seconds | Existing frontend regressions passed. This does not cover every issue-specific UI interaction. |
| Repository/source review | Read manifesto/security/API guidance, current routes, serializers, workflow services, hooks, screens and relevant tests | Feature inventory and requirement/issue traceability produced | Targeted source review, not an exhaustive audit of every line. |
| GitHub inventory | Search repository issues separately with `is:issue is:open` and `is:issue is:closed`; fetch all 54 returned issues; inspect comments on the four records that had comments | 47 open (46 bugs, 1 proposal), 7 closed | States verified at snapshot time. PRs are excluded from issue counts. |
| Existing issue reproductions | Read the reported API probes, hook/component checks, deterministic interleavings and fault-injection findings | Referenced in the register below | These reproductions were reported by earlier reviews. They were not all independently rerun for this document. |
| PostgreSQL/load/restore/browser deployment | Not run | Unverified | No production reliability percentage, peak capacity, complete penetration-test result or recovery guarantee is claimed. |
| Production build and lint | Not rerun for this documentation-only task | Unrun in this assessment | No claim is made about fresh build/lint results or actual CI status. |

The backend emitted an `UnorderedObjectListWarning` for the organization queryset during pagination. The suite still passed. No dedicated matching issue was identified, so deterministic organization pagination remains an additional untracked verification concern. Frontend tooling also emitted an advisory about the React SWC plugin; it did not fail the suite.

### What the passing tests support

There is useful existing assurance: real-cookie/CSRF tests; avatar validation/storage-failure tests; draft/upsert/answer-validation and weighted-score tests; database uniqueness/constraint checks; assignment rule combinations, idempotence and query budgets; and on-demand CSV/JSON export tests.

The blind spots are material. For example, current audit view tests use a superuser and test basic listing, which does not establish an ordinary tenant administrator's header-scoped retrieval. The portfolio `tests.py` is a placeholder, while `test_security.py` checks selected injection/proof-link cases rather than the full submit/review lifecycle. A passing test count is therefore a useful baseline and cannot be treated as feature completion or a reliability percentage.

Sources: [`backend/apps/audit/tests/test_views.py`][source-54]; [`backend/apps/portfolio/tests.py`][source-55]; [`backend/apps/portfolio/test_security.py`][source-46]; [database integrity verification notes][database-notes].

## What would change the reliability assessment

The strongest blockers are **loss of authorization boundaries, loss of confidentiality and loss of committed or retained evidence**. A stronger reliability claim needs evidence that the 14 suggested P1 reports have been resolved, including each distinct entry point, rather than only removing the visible UI action.

| Concern | Open reports that establish the blocker | Evidence needed to reassess |
|---|---|---|
| Account/tenant authority | [#241][issue-241], [#252][issue-252], [#253][issue-253], [#254][issue-254], [#255][issue-255] | Negative tests for outsiders, members, revoked admins and shared/privileged accounts; account identity separated from tenant management. |
| Permanent data loss and misleading success | [#260][issue-260], [#243][issue-243], [#256][issue-256] | History survives authorized lifecycle changes, unauthorized deletion fails, and a successful response always matches committed state under injected failure. |
| Confidential results and tenant information | [#233][issue-233], [#261][issue-261], [#269][issue-269] | All relevant read/write/serialization/cache routes tested with two organizations and shared users; unreleased individual results remain inaccessible. |
| Trustworthy review queue and decisions | [#242][issue-242], [#244][issue-244], [#245][issue-245] | Unauthorized submissions rejected, old pending records reachable beyond page one, and conflicting transitions produce a single explicit outcome. |
| Full workflow correctness | Remaining 32 suggested P2 reports in the issue register | Their acceptance behavior is exercised through APIs and affected screens, including reset/refresh, pagination and failure states. |
| Operational reliability | X-NFR01–X-NFR07; related proposal [#163][issue-163] | Agreed service targets and measured deployment, PostgreSQL, peak-load and restore evidence. |

These are assessment criteria, not an implementation plan or a guarantee that resolving the current backlog will uncover no further defects. No new GitHub issues were created and no existing issues were changed by this document.

## Open issue register

All 46 entries below were **open** with the `bug` label at the snapshot. The suggested priority is copied from the issue body. “Reported evidence” describes the linked report, not work newly reproduced for this document. Primary ownership prevents double counting; requirement IDs capture cross-feature effects.

| Issue | GitHub title | Primary feature | Suggested priority | Reported evidence | Requirement mappings |
|---|---|---|---|---|---|
| [#233][issue-233] | Assignment endpoints expose individual scores and evaluator identities before results are released | F08 | P1 | API list/detail reproduction | F08-FR02, F08-FR03, F08-NFR01 |
| [#234][issue-234] | Assignment screens and completion totals silently omit records after the first API page | F06 | P2 | API pagination + UI source inspection | F06-FR04, F09-FR02, F09-NFR02 |
| [#235][issue-235] | Assignment generation includes members whose organization access has been revoked | F06 | P2 | API/service eligibility probe | F06-FR03, F06-NFR01 |
| [#236][issue-236] | Adding a required question through the single-question endpoint leaves existing evaluations completed | F05 | P2 | API state/score reproduction | F05-FR05, F07-NFR03, F08-NFR02 |
| [#237][issue-237] | Closed evaluation forms remain in the member's actionable pending queue | F07 | P2 | API queue/rejected-write + UI source | F07-FR01 |
| [#238][issue-238] | Membership auto-assignment bypasses the form's required-question generation guard | F06 | P2 | Signal/service + manual API comparison | F05-FR04, F06-FR03, F06-NFR01 |
| [#239][issue-239] | A failure in a later assignment rule leaves a partially generated matrix behind an HTTP 500 | F06 | P2 | Later-rule fault injection | F06-FR02, F06-NFR02 |
| [#240][issue-240] | Admin dashboard reports zero completions because it checks Submitted instead of Completed | F09 | P2 | API status + dashboard predicate inspection | F09-FR01, F09-NFR02 |
| [#241][issue-241] | Organization updates permit unrelated users to edit or deactivate any active organization | F02 | P1 | Unauthorized API update | F02-FR03, F02-NFR01 |
| [#242][issue-242] | Accomplishment submission allows nonmembers, removed members and inactive organizations | F10 | P1 | API nonmember/revoked/inactive-organization probes | F10-FR01, F10-NFR01 |
| [#243][issue-243] | Owners can permanently delete verified accomplishments without an audit event | F11 | P1 | API DELETE + persistence/audit assertions | F11-FR04, F11-NFR02 |
| [#244][issue-244] | Overlapping accomplishment edits and reviews can erase verification decisions | F11 | P1 | Deterministic SQLite request interleavings; not PostgreSQL load | F10-FR03, F11-FR02, F11-NFR01 |
| [#245][issue-245] | Accomplishment review silently hides records and pending work after the first API page | F11 | P1 | API pagination + hook probe | F11-FR01 |
| [#246][issue-246] | Portfolio request failures are displayed as empty accomplishment lists | F10 | P2 | Member/admin component failure probes | F10-NFR03 |
| [#247][issue-247] | Canceled review notes are reused when reviewing another member's accomplishment | F11 | P2 | Component interaction + mutation payload probe | F11-FR03 |
| [#248][issue-248] | Accomplishment verification can write its audit event under a different organization | F11 | P2 | API review + audit scope assertion | F11-NFR03, F12-FR01 |
| [#249][issue-249] | Malformed organization identifiers cause HTTP 500 in portfolio list and create | F10 | P2 | Malformed-selector API probes | F10-NFR02 |
| [#250][issue-250] | Member accomplishment queries ignore status and type filters | F10 | P2 | Member-filter API probe | F10-FR02 |
| [#251][issue-251] | Approval comments entered in the accomplishment review dialog are silently discarded | F11 | P2 | API approval-note persistence probe | F11-FR02 |
| [#252][issue-252] | Unscoped join-request updates can be chained into cross-organization account takeover | F03 | P1 | API retarget/approve/password-reset chain | F01-NFR03, F03-FR04 |
| [#253][issue-253] | Removed organization administrators retain join-request approval and rejection authority | F03 | P1 | Revoked-admin API approval + reject source inspection | F03-FR02, F03-NFR01 |
| [#254][issue-254] | Tenant administrators can change shared users' global credentials and account availability | F04 | P1 | API global-identity/credential probes | F01-FR04, F01-NFR03, F04-FR04 |
| [#255][issue-255] | Organization user responses disclose memberships and roles in unrelated organizations | F04 | P1 | API shared-user serialization probe | F04-NFR02 |
| [#256][issue-256] | A caught audit insert failure rolls back form creation while the API returns success | F05 | P1 | Database-layer audit-insert fault injection | F05-FR01, F05-NFR01, F07-NFR01, F12-NFR02 |
| [#257][issue-257] | Valid long form titles generate audit actions longer than the database column | F05 | P2 | SQLite action-length/schema mismatch; PostgreSQL rejection unrun | F05-NFR02, F12-NFR02 |
| [#258][issue-258] | The audit page hides records beyond the first API page and reports incomplete totals | F12 | P2 | API pagination + UI source inspection | F12-FR03 |
| [#259][issue-259] | Updating an evaluation form creates no audit event | F05 | P2 | API update + absent-event assertion | F05-FR01, F05-NFR03, F12-FR01 |
| [#260][issue-260] | An authenticated outsider can permanently delete an organization and its audit history | F02 | P1 | Outsider API DELETE + cascade assertions | F02-FR04, F02-NFR01, F02-NFR03, F12-NFR01 |
| [#261][issue-261] | Audit events can be attributed to an unrelated organization through the request header | F02 | P1 | API writes + tenant attribution assertions | F02-FR01, F02-NFR03, F03-NFR03, F04-NFR03, F12-FR01 |
| [#262][issue-262] | Audit CSV exports preserve spreadsheet formulas from user-controlled names | F12 | P2 | API CSV cell inspection; spreadsheet execution unrun | F12-FR05, F12-NFR04 |
| [#263][issue-263] | Releasing evaluation results records the same audit action as activating the form | F08 | P2 | API lifecycle transitions + identical event comparison | F05-FR04, F08-FR01, F08-NFR03, F12-FR04 |
| [#264][issue-264] | The audit page removes form identities and role-change details from event text | F12 | P2 | Mocked page rendering + dashboard source; browser unrun | F12-FR04 |
| [#265][issue-265] | Audit request failures are displayed as an empty audit history | F12 | P2 | Mocked page error-state rendering | F12-NFR03 |
| [#266][issue-266] | Malformed audit filter parameters return HTTP 500 instead of validation errors | F12 | P2 | Malformed-filter API probes | F12-FR05, F12-NFR03 |
| [#267][issue-267] | Audit date-range filters exclude almost the entire selected end date | F12 | P2 | Same-day boundary API probe | F12-FR03 |
| [#268][issue-268] | Audit reads ignore the organization header and break the detail and filter hooks | F12 | P2 | Header/conflicting-scope API probes + hook source | F12-FR02 |
| [#269][issue-269] | Organization analytics omit tenant checks and mix assignments from different organizations | F09 | P1 | Two-tenant/shared-user analytics API probes | F09-FR02, F09-NFR01 |
| [#270][issue-270] | Join approval can leave a persisted membership after validation fails with HTTP 500 | F03 | P2 | Invalid-role API + partial persistence; PostgreSQL concurrency unrun | F03-FR02, F03-NFR02 |
| [#271][issue-271] | Removing a position assignment makes the same assignment impossible to add again | F04 | P2 | API remove/re-add/reactivate sequence | F04-FR03 |
| [#272][issue-272] | Membership creation accepts users without active organization access | F04 | P2 | API membership creation without organization access | F04-NFR01 |
| [#273][issue-273] | Member and organization structure screens silently stop after the first 20 API records | F04 | P2 | API pagination + user-hook probe; other hooks source-inspected | F04-FR01, F04-FR02 |
| [#274][issue-274] | Dashboard analytics share cache keys across active organizations | F09 | P2 | Hook/context A-to-B switch probe | F09-NFR01, F09-NFR02 |
| [#275][issue-275] | Current membership remains stale when the current-user profile is refreshed | F02 | P2 | Source-cache replacement hook probe + Settings source | F02-FR02, F02-FR03, F02-NFR02 |
| [#276][issue-276] | Member mutations leave directory data, unit counts and the open role dialog stale | F04 | P2 | Mutation invalidation probe + dialog source; browser unrun | F04-FR05 |
| [#277][issue-277] | Organization edits, structure changes and positional membership changes create no audit events | F04 | P2 | Six API mutations + absent-event assertions | F04-FR01, F04-NFR03, F12-FR01 |
| [#278][issue-278] | Registration and administrator password changes bypass configured Django password validators | F01 | P2 | Configured validator/serializer comparison probe | F01-FR01, F01-NFR01 |

### Open proposal, excluded from bug counts

| Issue | State | Meaning for this assessment |
|---|---|---|
| [#163][issue-163] — Proposal: instrument granular usage analytics as a handover artifact | Open enhancement | Proposes aggregate route/capacity measurements and a handover artifact. Its body explicitly says the suggestions are not decisions, requirements or a validated plan. Useful context for X-NFR01/02; not proof of a production failure or an agreed service target. |

### Closed history, excluded from current failure counts

| Issue | GitHub state/reason | Relevance and remaining uncertainty |
|---|---|---|
| [#27][issue-27] — User can apply for their own organization | Closed / completed | Historical self-application problem. Current join-by-code checks active roles; this exact scenario was not rerun separately. |
| [#29][issue-29] — User cannot view organization after being accepted after leaving and requesting | Closed / completed | Historical organization rejoin visibility problem. Distinct from open positional-assignment restoration [#271][issue-271]. |
| [#30][issue-30] — User Name Bug | Closed / completed | Historical evaluatee-name issue without a position. Current profile endpoint has role-based identity/name fallback; closure is not a fresh browser test. |
| [#32][issue-32] — User cannot view updated form after deactivation and activation | Closed / completed | Historical edit/reactivation issue. Open [#236][issue-236] identifies a separate current single-question completion-reset path. |
| [#8][issue-8] — Potential N+1 Problem in QuerySet Implementation | Closed / not planned | Historical N+1 hypothesis, not a confirmed resolved performance defect. Current query-budget tests add local evidence without establishing production latency. |
| [#193][issue-193] — Proposal: Leaner Dependencies | Closed / completed | Dependency cleanup proposal. Closure does not establish workload capacity, absence of vulnerabilities or feature reliability. |
| [#158][issue-158] — Rearchitectural Plans | Closed / completed | Architecture discussion with indicative activity/cost assumptions. Not a measured capacity result or accepted service-level objective. |

## Sources and maintenance

Requirement intent comes primarily from the manifesto and repository policies. Concrete failure statements come from the linked issue bodies, with sampled source corroboration. Current states were fetched directly through the connected GitHub service. All source links below are pinned to the assessed commit so later code changes do not silently change this document's evidence.

To refresh this assessment, record the new commit and issue snapshot time, re-query open and closed issues, retain requirement IDs, recheck each issue's actual behavior and rerun both suites. Update measured evidence separately from tracker closure. Keep untracked findings explicit until a matching issue or accepted requirement exists.

[manifesto]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/docs/Manifesto.md
[agent-guide]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/AGENTS.md
[security-doc]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/docs/SECURITY.md
[database-notes]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/docs/generated/database-optimization.md
[issue-8]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/8
[issue-27]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/27
[issue-29]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/29
[issue-30]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/30
[issue-32]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/32
[issue-158]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/158
[issue-163]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/163
[issue-193]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/193
[issue-233]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/233
[issue-234]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/234
[issue-235]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/235
[issue-236]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/236
[issue-237]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/237
[issue-238]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/238
[issue-239]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/239
[issue-240]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/240
[issue-241]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/241
[issue-242]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/242
[issue-243]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/243
[issue-244]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/244
[issue-245]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/245
[issue-246]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/246
[issue-247]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/247
[issue-248]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/248
[issue-249]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/249
[issue-250]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/250
[issue-251]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/251
[issue-252]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/252
[issue-253]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/253
[issue-254]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/254
[issue-255]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/255
[issue-256]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/256
[issue-257]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/257
[issue-258]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/258
[issue-259]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/259
[issue-260]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/260
[issue-261]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/261
[issue-262]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/262
[issue-263]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/263
[issue-264]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/264
[issue-265]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/265
[issue-266]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/266
[issue-267]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/267
[issue-268]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/268
[issue-269]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/269
[issue-270]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/270
[issue-271]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/271
[issue-272]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/272
[issue-273]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/273
[issue-274]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/274
[issue-275]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/275
[issue-276]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/276
[issue-277]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/277
[issue-278]: https://github.com/CIT-U-Computer-Students-Society/IPES/issues/278
[source-1]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/backend/apps/users/views.py
[source-2]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/backend/apps/users/serializers.py
[source-3]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/frontend/src/components/ProfileEditorDialog.tsx
[source-4]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/backend/apps/users/tests/test_session_security.py
[source-5]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/backend/apps/users/tests/test_avatars.py
[source-6]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/frontend/src/components/__tests__/ProfileEditorDialog.test.tsx
[source-7]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/backend/apps/organizations/views/organizations.py
[source-8]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/frontend/src/pages/SelectOrganization.tsx
[source-9]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/frontend/src/pages/admin/Settings.tsx
[source-10]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/frontend/src/contexts/__tests__/OrganizationContext.test.tsx
[source-11]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/frontend/src/components/__tests__/organization-entry.test.tsx
[source-12]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/backend/apps/organizations/views/join_requests.py
[source-13]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/backend/apps/organizations/serializers.py
[source-14]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/backend/apps/organizations/tests/test_views.py
[source-15]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/backend/apps/organizations/views/units.py
[source-16]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/backend/apps/organizations/views/positions.py
[source-17]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/backend/apps/organizations/views/memberships.py
[source-18]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/frontend/src/pages/admin/Users.tsx
[source-19]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/backend/apps/organizations/tests/test_models.py
[source-20]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/frontend/src/hooks/__tests__/useUsers.test.tsx
[source-21]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/backend/apps/evaluations/views/forms.py
[source-22]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/backend/apps/evaluations/views/questions.py
[source-23]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/backend/apps/evaluations/serializers.py
[source-24]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/frontend/src/pages/admin/FormBuilder.tsx
[source-25]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/backend/apps/evaluations/tests/test_question_writes.py
[source-26]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/backend/apps/evaluations/tests/test_schema_constraints.py
[source-27]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/backend/apps/evaluations/views/rules.py
[source-28]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/backend/apps/evaluations/services.py
[source-29]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/backend/apps/organizations/signals.py
[source-30]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/frontend/src/pages/admin/Assignments.tsx
[source-31]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/backend/apps/evaluations/tests/test_generation_analytics.py
[source-32]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/backend/apps/evaluations/views/responses.py
[source-33]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/backend/apps/evaluations/views/assignments.py
[source-34]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/frontend/src/pages/officer/EvaluationForm.tsx
[source-35]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/backend/apps/evaluations/tests/test_response_integrity.py
[source-36]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/backend/apps/evaluations/tests/test_concurrent_answers.py
[source-37]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/frontend/src/pages/officer/Results.tsx
[source-38]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/backend/apps/evaluations/views/analytics.py
[source-39]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/frontend/src/pages/admin/Dashboard.tsx
[source-40]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/frontend/src/pages/admin/Analytics.tsx
[source-41]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/frontend/src/components/__tests__/analytics-export.test.tsx
[source-42]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/frontend/src/hooks/evaluations/__tests__/analytics.test.tsx
[source-43]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/backend/apps/portfolio/views/accomplishments.py
[source-44]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/backend/apps/portfolio/serializers.py
[source-45]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/frontend/src/pages/officer/Accomplishments.tsx
[source-46]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/backend/apps/portfolio/test_security.py
[source-47]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/frontend/src/pages/admin/AdminAccomplishments.tsx
[source-48]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/backend/apps/audit/views.py
[source-49]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/backend/apps/audit/utils.py
[source-50]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/backend/apps/audit/models.py
[source-51]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/frontend/src/hooks/useAudit.ts
[source-52]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/frontend/src/pages/admin/AuditLog.tsx
[source-53]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/backend/apps/audit/tests/test_models.py
[source-54]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/backend/apps/audit/tests/test_views.py
[source-55]: https://github.com/CIT-U-Computer-Students-Society/IPES/blob/235e0c2af7dde5d46477a80402b8b22740e59b3f/backend/apps/portfolio/tests.py
