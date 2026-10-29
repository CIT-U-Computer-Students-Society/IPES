# Testing IPES

All database-backed tests use an isolated PostgreSQL service. Frontend component tests run independently of PostgreSQL.

## Start PostgreSQL locally

From the repository root, with Docker Desktop running Linux containers:

```powershell
docker compose --env-file backend/test.env.example -f compose.test.yml up -d --wait
```

The explicit environment file avoids loading the application's root `.env` through Compose. PostgreSQL binds to `127.0.0.1:55432` and uses disposable tmpfs storage. The `ipes_test` role can create databases but cannot act as a superuser or manage roles. The bootstrap role initializes this test cluster only.

PostgreSQL 17 is the test baseline. Confirm the production major version and update the Compose/CI image together if it differs. Tests record the actual server version; matching the engine alone does not establish parity with managed Supabase configuration/storage.

A native local PostgreSQL service is also supported: initialize a dedicated control database and roles with `backend/scripts/init-test-postgres.sql`, then set `IPES_TEST_HOST`, `IPES_TEST_PORT` and `IPES_TEST_PASSWORD` in the shell. These never inherit application `DB_*` credentials. Remote hosts are rejected; CI also supports the service hostname `postgres`.

## Backend tests and coverage

From `backend/`, with the virtual environment activated:

```powershell
. .\.venv\Scripts\Activate.ps1
uv pip install --python .venv/Scripts/python.exe -r requirements-dev.txt
python scripts/test_database.py check
python manage.py test
python -m coverage run --context=backend-tests manage.py test
python -m coverage html
python -m coverage xml
```

On Linux activate `.venv/bin/activate`; `pip install -r requirements-dev.txt` is also supported. The test bootstrap selects `IPES.settings_test`. Django creates/migrates/drops a fresh `test_ipes_unit_*` database. PostgreSQL unavailability fails the command. There is no SQLite fallback, and the row-lock test must execute.

Reports are under `backend/coverage/unit/`. Pure guard checks can run without PostgreSQL:

```powershell
python -m unittest tests.test_database_safety
```

These guard checks do not verify database/application correctness.

## Frontend tests and coverage

From `frontend/`:

```powershell
npm ci
npm run test -- --run
npm run test:coverage
npm run build
npm run lint
```

Unit coverage includes application TS/TSX files, including untested files, and generates HTML, LCOV and JSON under `frontend/coverage/unit/`. Measure a baseline before choosing percentage gates.

## Playwright

Keep the test PostgreSQL service running. From `frontend/`:

```powershell
npx playwright install chromium
npm run test:requirements
npm run test:e2e:types
npm run test:e2e
```

The coordinator provisions a separate `ipes_e2e_*` database, migrates it, builds React, starts Django on port 8001 and Vite preview on 5175, then runs six `@core` scenarios. Fixtures create preconditions; the browser performs the tested writes. Database snapshots read committed rows through another connection using a read-only transaction.

Select one scenario, headed mode, or all supported projects:

```powershell
npm run test:e2e -- --grep=S03
npm run test:e2e:headed
npx playwright install firefox webkit
npm run test:e2e:all
```

The all-project command also runs the `@expanded` checks. For expanded Chromium only in PowerShell:

```powershell
$env:IPES_E2E_EXPANDED = '1'
npm run test:e2e
Remove-Item Env:IPES_E2E_EXPANDED
```

In bash: `IPES_E2E_EXPANDED=1 npm run test:e2e`. Browser selection accepts `--project=firefox`, `--project=webkit` and `--project=mobile-chromium`. Runs use one worker and zero automatic retries. Each run has a new database, and each scenario has a new fixture namespace/context.

The coordinator finds the backend virtual environment on Windows/Linux. Set `IPES_TEST_PYTHON` to select another interpreter.

## Evidence and traceability

Open the printed `frontend/e2e-artifacts/<run>/index.html`. It links the Playwright report, requirement status, backend E2E coverage and frontend browser coverage. Per-test attachments include:

- Screen PNGs and rendered tables of actual PostgreSQL rows.
- Allowlisted database JSON with previous/current snapshots and expected assertions.
- Traces, failure screenshots and videos where available.

Assertions determine success; screenshots support review. Missing evidence/coverage remains an infrastructure failure. Early setup failures still leave a run-status file and evidence index.

The concise [RTM](testing/requirements_traceability_matrix.md) is the source for all 98 IDs. Its generated companion, `docs/testing/requirements.json`, records a normalized source hash and acceptance criteria. `test:requirements` validates mappings against Playwright discovery. Partial, uncovered, manual, and unconfirmed requirements are not passes. After editing the table, regenerate with `node scripts/generate-requirements.mjs`, then review the diff.

The expanded suite checks intended behavior, including previously documented pagination and portfolio error-state regressions. Existing product defects may make these tests fail. Do not change expected outcomes or count exceptions as satisfied to obtain a green report.

Frontend browser coverage is explicitly labeled **loaded application code only**, with no whole-application percentage gate. Native execution coverage is collected on Chromium; Firefox/WebKit still run behavioral assertions and show execution coverage as unavailable. This report is separate from Vitest's complete-source report.

Load capacity, backup/restore, manual accessibility and production HTTPS/Supabase integration need additional evidence outside local E2E.

## Isolation and cleanup

Provisioning/snapshots/deletion validate the test-instance marker, restricted role, exact database name and run ownership token. The coordinator shuts down its server, saves Python coverage and drops only its own PostgreSQL database. It does not terminate foreign DB sessions or delete databases by prefix.

A forcibly killed run may leave its exact database and `backend/.e2e/<database>/owner` marker. After stopping its processes, clean it from `backend/`:

```powershell
$taskDatabase = 'ipes_e2e_exact_run_name'
$taskToken = Get-Content -LiteralPath (Join-Path '.e2e' (Join-Path $taskDatabase 'owner')) -Raw
python scripts/test_database.py drop --name $taskDatabase --token $taskToken
```

Substitute the actual printed run name. No wildcard cleanup is supported. To stop the dedicated service from the repository root:

```powershell
docker compose --env-file backend/test.env.example -f compose.test.yml down
```

Evidence may contain synthetic authentication traffic. Keep traces and storage-state files out of public reports and Git. CI retains access-controlled artifacts for 14 days.

## GitHub Actions

PR validation runs PostgreSQL backend tests/coverage, frontend unit tests/coverage/build and the Chromium core suite. Each database-backed job gets its own PostgreSQL service. The expanded workflow runs nightly and by manual dispatch across Chromium, Firefox, WebKit and a mobile viewport; artifacts upload on failure.

Workflow definitions do not change branch protection. Inspect actual CI on the final revision before making checks required or merging.
