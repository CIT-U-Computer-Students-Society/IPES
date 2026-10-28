# Database integrity and query optimization

Evaluation answers are unique per assignment and question. Draft saves and final
submissions lock the assignment and upsert answers inside a transaction. Completed
assignments reject later writes through the batch and individual response APIs.
Question ownership, score bounds, finite numbers, required answers and organization
access are validated before persistence. Zero is a valid answer when within bounds.
Zero or null weights do not contribute to a score; an entirely unweighted evaluation
has a null total score. Large finite weights use a scaled weighted average.

Batch draft saves and submissions represent the current answer set. Omitted answers
are removed, including cleared optional answers. Individual response creates and
updates preserve the other answers. An all-optional form may be submitted empty;
a form without questions cannot be submitted.

## Schema changes

- Database checks enforce date ordering, position ranks 1–100, positive question
  ordering, nonnegative finite weights, explicit question bounds, input types,
  assignment/join-request/accomplishment statuses, and organization roles.
- Composite assignment indexes cover form/status, received performance, and pending
  evaluator lists. Audit history is indexed by organization and descending time;
  accomplishment queues by organization, status, descending completion date and ID.
- Existing foreign-key indexes and assignment/membership/role uniqueness are retained.
- The existing `AutoField` primary-key type is now explicit in settings, preventing
  a framework-default change from unexpectedly widening every primary key.
- Unit types, membership positions and assignment-rule filters must belong to the
  same organization as their parent. Responses must reference their assignment's form.
  These cross-table checks run in model saves and validated application services;
  arbitrary SQL and `QuerySet.update()` can bypass them. Code changing these
  relationships must use the validated paths. Bulk answer writes validate the whole
  batch explicitly before using the ORM bulk operation.

## Query behavior

Assignment generation deduplicates users across memberships, processes at most 500
pairs at a time, and preserves existing assignment states. Membership save signals
continue to generate assignments through the same service. Soft-deleted, inactive,
and released forms do not generate assignments. Form lists preload creators and
questions to avoid a query per result.

`GET /forms/{id}/analytics/` returns summary analytics with an empty `raw_data` list.
Administrators request `GET /forms/{id}/analytics_export/` for the full response set.
The frontend fetches the latter only after an export is requested and avoids
downloading an incomplete report if that request fails.

Evaluation, unit, position and membership requests require an active organization
membership and a selected tenant. `X-Organization-Id` is supported, as is the existing
`organization_id` query parameter; conflicting values are rejected. Administrative
writes and analytics exports require an active organization administrator. Response
writes require the assigned evaluator. Generic assignment writes are disabled;
generation and submission use their dedicated actions.

## Applying migrations

The new migrations are organizations `0017`, evaluations `0010`, audit `0006`, and
portfolio `0008`. Run `python manage.py migrate` from an activated backend environment
as part of deployment. They have been exercised on isolated test databases; they
have not been applied to the production database.

The evaluation migration keeps the highest-ID legacy response for each duplicate
assignment/question pair and recalculates affected completed totals. This cleanup
cannot restore discarded duplicates when reversed. Back up production before
deployment. Cross-form responses and cross-organization relationships stop migration
with an explicit error instead of being reassigned or deleted automatically. Existing
rows violating the new check constraints must also be corrected before migration.
Standard index creation and constraint validation may lock populated tables, so use
an appropriate deployment window and assess table sizes beforehand.

## Test design

| Technique | Coverage |
|---|---|
| Boundary value analysis | Scores just below/at/above bounds, zero and negative ranges, equal bounds, ranks 0/1/2/99/100/101, dates before/equal/after, null/zero/negative/large weights, ID limits |
| Equivalence partitioning | Valid numeric/text answers, blanks, missing/null values, booleans, nonnumeric and nonfinite scores, malformed payloads, valid/invalid statuses and types |
| Decision tables | All six input types × required/optional × provided/missing × draft/final |
| Combinatorial testing | All 32 combinations of evaluator/evaluatee unit and position wildcards and self-exclusion; duplicate memberships and overlapping rules |
| State transitions | Pending → In Progress → Completed; direct submission; repeated saves; completed-write rejection; form closure and question-change resets |
| Fault injection | A failed assignment write rolls back answer changes, completion and audit creation; invalid batches preserve drafts |
| Authorization partitions | Evaluator, evaluatee, admin, outsider, inactive role and anonymous callers; foreign tenants and conflicting tenant selectors |
| Migration testing | Fresh schema, legacy duplicate cleanup, preserved highest-ID answer, recalculated totals, uniqueness after upgrade, blocked cross-form legacy data |
| Query regression tests | Generation across a batch boundary, constant form-list query count, raw-response query absent from summary analytics |
| Frontend integration | Deferred export requests, CSV/JSON output, zero scores, failed requests, disabled export states |
| Concurrency | Two simultaneous submissions yield one success, one rejection and one persisted answer on databases with row-lock support |

Run `python manage.py test` in `backend/` and `npm run test -- --run` in `frontend/`.
The default backend suite uses SQLite. Its row-lock concurrency test is explicitly
skipped because SQLite cannot verify PostgreSQL locking semantics. Run that test
against a dedicated PostgreSQL test database before claiming concurrency validation
on PostgreSQL. Production query plans and latency have not been benchmarked;
measure the new indexes against representative workloads after deployment.
