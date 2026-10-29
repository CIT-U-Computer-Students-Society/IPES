# AGENTS.md — IPES Agent Guide

> This file provides guidance for AI coding agents working on the **Individual Performance Evaluation System (IPES)**.  
> Read this file in its entirety before making any changes to the codebase.

---

## 1. Project Overview

**IPES** is a full-stack web application that digitizes and automates peer-evaluation workflows for student organizations at CIT-U. It replaces a fragmented Google Forms-based process with a unified, purpose-built platform.

Key capabilities:
- Automated evaluation form distribution and assignment generation
- Role-based access control (Admin vs. Member) scoped per organization
- Accomplishment portfolio tracking with admin verification
- Real-time analytics and performance dashboards
- Full, immutable audit trail

Refer to [`Manifesto.md`](Manifesto.md) for the complete project specification and [`README.md`](README.md) for setup instructions.

---

## 2. Repository Structure

```
IPES/
├── .agents/skills/              # Agent skills (see Section 7)
├── .github/                     # CI/CD workflows and PR template
│   ├── workflows/
│   │   ├── pr-validate.yml      # Runs linting and frontend build on dev PRs
│   │   ├── pr-branch-check.yml  # Enforces dev as the source for main PRs
│   │   └── stale.yml            # Auto-closes stale issues/PRs
│   └── PULL_REQUEST_TEMPLATE.md
├── backend/                     # Django 6.0 REST API
│   ├── apps/
│   │   ├── audit/               # Immutable audit log system
│   │   ├── evaluations/         # Evaluation forms, assignments, analytics
│   │   ├── organizations/       # Org structure, memberships, roles
│   │   ├── portfolio/           # Accomplishment tracking
│   │   └── users/               # Custom user model + auth
│   ├── IPES/                    # Django project settings and URL routing
│   ├── manage.py
│   └── requirements.txt
├── frontend/                    # React 18 + TypeScript SPA (Vite)
│   ├── src/
│   │   ├── components/          # Reusable UI (Mantine adapters + custom)
│   │   ├── contexts/            # OrganizationContext (global org state)
│   │   ├── hooks/               # TanStack Query hooks per API domain
│   │   ├── lib/api.ts           # Centralized fetch client
│   │   └── pages/
│   │       ├── admin/           # 9 admin-facing pages
│   │       └── officer/         # 5 member-facing pages
│   ├── package.json
│   ├── vite.config.ts
│   └── vitest.config.ts
├── docs/                        # Project documentation
│   └── generated/
│       └── implementation_plans/ # Agent-generated implementation plans
├── sample.env                   # Backend environment template (copy to root .env)
├── Manifesto.md                 # Canonical architecture and design reference
└── README.md                    # Human setup instructions
```

---

## 3. Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Framework | Django 6.0 + Django REST Framework |
| Language | Python 3.13+ |
| Database (prod) | PostgreSQL on Supabase |
| Database (test) | SQLite (auto-switched during `manage.py test`) |
| Auth | Session-based (CSRF-protected cookies) |
| Linting | flake8 |
| Production server | Gunicorn |

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build tool | Vite 7 |
| Styling | Mantine 9 + TailwindCSS page layouts |
| Data fetching | TanStack React Query |
| Routing | React Router v6 |
| Forms | React Hook Form + Zod validation |
| Charts | Recharts |
| Drag-and-drop | dnd-kit |
| Testing | Vitest + React Testing Library |

---

## 4. Development Commands

### Backend

All backend commands must be run from the `backend/` directory with the virtual environment **activated**.

```bash
# Activate virtual environment (Windows PowerShell)
.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Apply database migrations
python manage.py migrate

# Start the development server (http://127.0.0.1:8000)
python manage.py runserver

# Run all tests (uses SQLite automatically)
python manage.py test

# Run tests for specific apps
python manage.py test apps.users apps.organizations apps.evaluations

# Run linter
flake8 .
```

### Frontend

All frontend commands must be run from the `frontend/` directory.

```bash
# Install dependencies
npm install

# Start the development server (http://localhost:8080)
npm run dev

# Run tests (headless)
npm run test

# Run tests (interactive browser UI)
npm run test:ui

# Build for production
npm run build
```

---

## 5. Architecture Rules & Conventions

### Backend

1. **Organization Scoping**: Every API request carries an `X-Organization-Id` header. All views **must** filter querysets by the active organization — never return cross-organization data.

2. **Authentication**: The project uses **session-based authentication** (not JWT). Sessions use host-only HttpOnly cookies, Secure in production. `COOKIE_SAMESITE` is configurable (production defaults to `None`, development to `Lax`). Do not introduce bearer tokens in browser storage.

3. **CSRF**: Every mutation must pass the `X-CSRFToken` header. The frontend bootstraps a masked token from `/api/auth/csrf/` before mutations; session and CSRF cookies are HttpOnly. Login and registration also require CSRF.

4. **Soft Deletes**: Users, organizations, and evaluation forms are **never physically deleted**. Always set `is_active = False` or `is_deleted = True`.

5. **Signals**: `apps/organizations/signals.py` contains a `post_save` signal on `Membership` that auto-generates evaluation assignments for new/re-activated members. Do not bypass this with raw queries.

6. **Audit Logging**: Use `apps.audit.utils.log_action()` to log any critical actions (form creation, result releases, member role changes, etc.). This helper is resilient — it silently catches exceptions so it never breaks the main flow.

7. **Test Database**: The test runner auto-switches to SQLite. Do **not** override this unless explicitly testing Postgres-specific features.

8. **App Structure**: Each Django app in `apps/` follows the pattern:
   - `models.py` — data models
   - `serializers.py` — DRF serializers (often multiple purpose-specific serializers per app)
   - `views/` — split into one file per resource (e.g., `views/forms.py`, `views/questions.py`)
   - `tests/` — model tests and view/API tests

### Frontend

1. **API Client**: Always use `frontend/src/lib/api.ts` for all HTTP calls — it handles CSRF token injection, the `X-Organization-Id` header, and centralized error handling. Do not use raw `fetch` or `axios` directly.

2. **Data Fetching**: Use the existing TanStack Query hooks in `frontend/src/hooks/`. Add new hooks to the appropriate domain file (e.g., new evaluation hooks go in `useEvaluations.ts`).

3. **Organization State**: The active organization is managed via `OrganizationContext` (persisted in `localStorage`). Access it via `useOrganization()` hook.

4. **Role-Based Routing**:
   - `/member/*` — Member-facing views (Officer layout)
   - `/admin/*` — Admin-facing views (Admin layout)
   - `/admin/my-*` — Admin users accessing their own member views

5. **UI Components**: Use Mantine components through the shared adapters in `frontend/src/components/ui/` before creating new components. New UI should use Mantine; keep overlay focus, selection, keyboard navigation, and disabled behavior in its primitives. Theme and notifications are provided once at the application root. Custom components live in `frontend/src/components/`.

6. **Validation**: Use **Zod** for all form schemas and **React Hook Form** for form state. Do not add ad-hoc validation logic outside of schema definitions.

---

## 6. Key Domain Concepts

| Concept | Description |
|---|---|
| **Organization** | A student body using IPES. All data is scoped to it. |
| **Unit** | A subdivision (e.g., "Committee on Research") |
| **Position** | A ranked role within a unit (1 = Head) |
| **Membership** | Binds a User ↔ Unit ↔ Position with date range |
| **OrganizationRole** | Admin vs. Member permission level per organization |
| **EvaluationForm** | A questionnaire with lifecycle: Draft → Active → Released |
| **AssignmentRule** | Declarative filter mapping evaluator groups to evaluatee groups |
| **EvaluationAssignment** | One concrete evaluator–evaluatee pair for a form (Pending → In Progress → Completed) |
| **Response** | An individual answer (score + optional text) to a question |
| **Accomplishment** | A self-reported achievement (Pending → Verified/Rejected) |
| **AuditLog** | Immutable event record; never edit or delete |

---

## 7. Agent Skills

The project ships with skills that agents **must** use for specific tasks. Skills are located in `.agents/skills/`. Always read the `SKILL.md` file in a skill directory before using it.

| Skill | When to Use |
|---|---|
| [`git-commit`](.agents/skills/git-commit/SKILL.md) | When staging commits or drafting commit messages. Use Conventional Commits and separate concerns into atomic commits. |
| [`git-pr`](.agents/skills/git-pr/SKILL.md) | When drafting, creating, or updating pull requests. Use descriptive titles, change diagrams, and testing charts based on actual evidence. |
| [`write-implementation-plans`](.agents/skills/write-implementation-plans/SKILL.md) | When drafting technical implementation plans. Plans must go in `docs/generated/implementation_plans/YYYYMMDD/` following the required naming and structure conventions. |
| [`release-dev-to-main`](.agents/skills/release-dev-to-main/SKILL.md) | When merging `dev` into `main` for a production release. Covers pre-flight checks, changelog generation from Conventional Commits, PR title format, and post-merge release tagging. |

---

## 8. Git & Pull Request Standards

### Branch Naming

Follow the repository's branch naming rules. `pr-branch-check.yml` enforces the allowed source branch for PRs targeting `main`.

Never prepend `codex/` to branch names. Use conventional prefixes such as `feat/`, `fix/`, or `refactor/`, or the user's exact requested name.

### Commit Messages

Use **Conventional Commits** for all commit messages:

```
<type>(<optional scope>): <description>
```

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`, `ci`

- Use imperative, present tense: `add feature`, not `added feature`
- No capital letter at the start of the description
- No period at the end

Separate unrelated changes into distinct commits — do not bundle documentation, feature code, and dependency updates into a single commit.

### Pull Requests

Use a descriptive, outcome-focused PR title in ordinary language, without a Conventional Commit prefix. Conventional Commits apply to commit subjects and messages. Use the `git-pr` skill for PR authoring and the release skill as well for `dev` to `main` releases.

Regular PRs must follow the template at [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md). Release PRs use the release skill's body structure and share the diagram and testing evidence requirements:

1. **Description** — What changed and why, with a Mermaid diagram of the changed behavior or workflow
2. **Type of change** — Select the relevant checkboxes
3. **How Has This Been Tested?** — Provide commands, observed output, and charts covering automated tests, regression scenarios, and other applicable checks; label failures, skipped, blocked, unrun, or inapplicable checks explicitly
4. **Checklist** — Self-review, tests passing, docs updated

Inspect actual CI results separately from local test evidence:
- `pr-validate.yml` — Runs backend linting and frontend linting/build on PRs targeting `dev`; it also executes both test suites
- `pr-branch-check.yml` — Enforces that PRs targeting `main` originate from `dev`

**Do not merge** unless all required CI checks for the target branch pass and both test suites pass locally.

---

## 9. Testing Requirements

Before opening a PR or considering a task complete, **always** run both test suites:

```bash
# Backend (from backend/)
python manage.py test

# Frontend (from frontend/)
npm run test
```

When adding new backend features, add tests to the relevant `apps/<app>/tests/` directory. When adding new frontend features, add component tests using Vitest + React Testing Library.

---

## 10. Environment Variables

### Backend (`.env` in the repository root)
Copy from the root `sample.env`. Django discovers it through python-decouple's parent-directory search. Required variables:

| Variable | Description |
|---|---|
| `SECRET_KEY` | Django secret key |
| `DEBUG` | `True` in development, `False` in production |
| `DB_NAME` | PostgreSQL database name |
| `DB_USER` | PostgreSQL username |
| `DB_PASSWORD` | PostgreSQL password |
| `DB_HOST` | Database host (e.g., `127.0.0.1` or Supabase host) |
| `DB_PORT` | PostgreSQL port (default: `5432`) |

### Frontend (`frontend/.env.local`)
Copy from `frontend/.env.example`. Required variables:

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend API base URL (e.g., `http://localhost:8000/api`) |

> **Never commit `.env` or `.env.local` to the repository.**

---

## 11. What NOT to Do

- ❌ Do not physically delete users, organizations, or evaluation forms — use soft deletes.
- ❌ Do not bypass `apps/audit/utils.log_action()` for significant state changes.
- ❌ Do not make raw `fetch` calls in the frontend — always go through `lib/api.ts`.
- ❌ Do not add new data-fetching logic outside of `hooks/` — create or extend the relevant hook file.
- ❌ Do not add cross-organization queries — always scope by `X-Organization-Id`.
- ❌ Do not skip tests — run both suites before marking any task done.
- ❌ Do not create implementation plans outside of `docs/generated/implementation_plans/YYYYMMDD/`.
- ❌ Do not bundle unrelated changes into a single commit.
