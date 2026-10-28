# Implementation Plan - Separate Backend and Frontend Modules

This implementation plan documents the process for organizing the IPES codebase by moving all Django backend modules (apps, project configuration, and manage scripts) into a dedicated `backend` subfolder. This separates them from the frontend React codebase, creating a cleaner project structure.

---

## 1. Goal / Executive Summary

The Individual Performance Evaluation System (IPES) codebase currently mixes root-level Django configuration and apps with the `frontend` subfolder. To achieve a clean, modular structure, we will group all backend-related assets into a new `backend` directory.

This plan details:
1. **Creation of `backend` Subfolder**: Creating a new root-level folder.
2. **Migration of Backend Assets**: Moving `apps/`, `IPES/`, `scripts/` (backend scripts), `manage.py`, `requirements.txt`, and `sample.env` into the `backend` subfolder.
3. **Backend Settings Correction**: Updating `BASE_DIR` references (specifically `FRONTEND_DIST`) in `backend/IPES/settings.py` so that frontend assets are correctly referenced.
4. **CI Workflow Update**: Adjusting the GitHub Action (`pr-validate.yml`) to correctly install requirements and run linters within the new `backend` folder.
5. **IDE Configurations**: Modifying JetBrains PyCharm settings (`.idea/IPES.iml`) to preserve project integration.
6. **Documentation Update**: Updating `README.md` to reflect the new structure and commands.

---

## 2. User Review Required

> [!IMPORTANT]
> **Action Required on Local Environments**:
> If you have local, untracked files at the root of your workspace (such as `.env` and Python virtual environments `.venv` / `venv`), they must be moved to the new `backend/` directory manually:
> 1. Move `.env` to `backend/.env`.
> 2. Either move your `.venv`/`venv` folder to `backend/` and re-activate it, or recreate your virtual environment inside `backend/` and run `pip install -r requirements.txt`.

> [!WARNING]
> Running Django commands like `python manage.py runserver` or `python manage.py migrate` will now require navigating to the `backend/` directory first (e.g., `cd backend`).

---

## 3. Open Questions

There are no open questions. The backend Django apps are completely decoupled from frontend source files on a file-system level, and this relocation will not impact API paths or communication.

---

## 4. Proposed Changes

We will create a new `backend` directory and move the Django files there.

### Root Directory Cleanup

#### [MODIFY] [README.md](../../../../README.md)
Update documentation paths, setup instructions, and execution commands to use the new `backend/` directory structure.

#### [MODIFY] [.github/workflows/pr-validate.yml](../../../../.github/workflows/pr-validate.yml)
Update the validation workflow paths to install dependencies from `backend/requirements.txt` and run `flake8` against the `backend/` directory.

#### [MODIFY] [.idea/IPES.iml](../../../../.idea/IPES.iml)
Update JetBrains Django settings paths (`settingsModule` and `manageScript`) to point to their new locations under `backend/`.

---

### Backend Components

#### [NEW] [backend/](../../../../backend)
New module folder for housing all Django backend assets.

#### [MODIFY] [backend/IPES/settings.py](../../../../backend/IPES/settings.py) (Moved)
Update `FRONTEND_DIST` path calculation to resolve from the parent directory of `BASE_DIR`, as `BASE_DIR` will now point to the `backend/` subdirectory.

```python
# Before:
FRONTEND_DIST = BASE_DIR / 'frontend' / 'dist'

# After:
FRONTEND_DIST = BASE_DIR.parent / 'frontend' / 'dist'
```

#### [NEW] [backend/manage.py](../../../../backend/manage.py) (Moved from root)
#### [NEW] [backend/requirements.txt](../../../../backend/requirements.txt) (Moved from root)
#### [NEW] [backend/sample.env](../../../../backend/sample.env) (Moved from root)
#### [NEW] [backend/IPES/](../../../../backend/IPES) (Moved from root)
#### [NEW] [backend/apps/](../../../../backend/apps) (Moved from root)
#### [NEW] [backend/scripts/](../../../../backend/scripts) (Moved from root)

#### [DELETE] [manage.py](../../../../manage.py)
#### [DELETE] [requirements.txt](../../../../requirements.txt)
#### [DELETE] [sample.env](../../../../sample.env)
#### [DELETE] [IPES/](../../../../IPES)
#### [DELETE] [apps/](../../../../apps)
#### [DELETE] [scripts/](../../../../scripts)

---

## 5. Verification Plan

### Automated Tests
- Run backend tests inside the `backend/` folder:
  ```bash
  cd backend
  python manage.py test
  ```
- Run frontend tests inside the `frontend/` folder:
  ```bash
  cd frontend
  npm run test
  ```

### Manual Verification
- Verify backend can launch without error:
  ```bash
  cd backend
  python manage.py runserver
  ```
- Verify frontend dev server launches and can connect to the backend:
  ```bash
  cd frontend
  npm run dev
  ```
- Build the frontend to check if production build assets are located where backend expects:
  ```bash
  cd frontend
  npm run build
  ```
