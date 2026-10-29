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

## Stop the test service

Run from the repository root: `docker compose --env-file backend/test.env.example -f compose.test.yml down`.

The validation workflow runs backend tests on PostgreSQL and frontend tests independently, publishing separate coverage artifacts. Browser support is delivered in the later testing layers.
