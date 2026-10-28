# Implementation Plan - Reorganize Project Documentation

This implementation plan outlines the restructuring and cleanup of the root `README.md` by separating its mixed content (architecture diagrams, setup/run instructions, API design, and testing guides) into modular documentation files under the `docs/` folder.

---

## 1. Goal / Executive Summary

The root `README.md` has accumulated extensive details regarding entity relationship diagrams, multiple sequence diagrams, backend/frontend setup, database initialization, testing, and API design. This clutter makes the README hard to scan and maintain.

To establish a professional, developer-friendly repository:
1. **Clean up Root `README.md`**: Retain only the project introduction, tech stack, directory structure, and high-level navigation links.
2. **Modularize Documentation**: Extract sections into dedicated files under `docs/`:
   - `docs/architecture/ERD.md` (Database diagram)
   - `docs/architecture/sequence_diagrams/evaluation_form_lifecycle.md` (Form workflow)
   - `docs/architecture/sequence_diagrams/accomplishment_verification.md` (Verification workflow)
   - `docs/SETUP.md` (System prerequisites, environment files, run instructions)
   - `docs/TESTING.md` (Django tests and Vitest UI guide)
   - `docs/API_Design.md` (DRF REST API catalog)
   - `docs/CONTRIBUTING.md` (New guide detailing branch rules and commit conventions)
3. **Build docs Navigation Hub**: Create a `docs/README.md` file with a table of contents to easily navigate the subfolders and files.

---

## 2. User Review Required

> [!NOTE]
> All links from the root `README.md` and the `docs/README.md` index will use repository-relative paths.

There are no other breaking changes, code alterations, or critical dependencies introduced by this change.

---

## 3. Open Questions

There are no open questions.

---

## 4. Proposed Changes

We will create several new documentation files under the `docs/` folder and edit the root `README.md`.

### Documentation Index & Navigation

#### [MODIFY] [README.md](../../../../README.md)
Prune the ERD, sequence diagrams, setup, run, test, and API sections. Retain the banner, tech stack, and project structure, and add a "Documentation Guide" section linking to the new docs.

#### [NEW] [docs/README.md](../../../../docs/README.md)
Navigation README for developers linking to the modular guides.

---

### Technical Modules

#### [NEW] [docs/architecture/ERD.md](../../../../docs/architecture/ERD.md)
Houses the Mermaid database ERD.

#### [NEW] [docs/architecture/sequence_diagrams/evaluation_form_lifecycle.md](../../../../docs/architecture/sequence_diagrams/evaluation_form_lifecycle.md)
Houses the sequence diagram mapping the evaluation flow.

#### [NEW] [docs/architecture/sequence_diagrams/accomplishment_verification.md](../../../../docs/architecture/sequence_diagrams/accomplishment_verification.md)
Houses the sequence diagram mapping the accomplishment approval flow.

#### [NEW] [docs/SETUP.md](../../../../docs/SETUP.md)
Prerequisites, virtual environment setups, dependencies, and launch commands.

#### [NEW] [docs/TESTING.md](../../../../docs/TESTING.md)
Instructions on running backend Django tests and frontend Vitest suites.

#### [NEW] [docs/API_Design.md](../../../../docs/API_Design.md)
The Django REST Framework endpoints registry.

#### [NEW] [docs/CONTRIBUTING.md](../../../../docs/CONTRIBUTING.md)
Developer guide explaining strict branching policy and conventional commit rules.

---

## 5. Verification Plan

### Automated Tests
- Run Python linters to ensure no formatting errors on files:
  ```bash
  cd backend
  flake8 .
  ```

### Manual Verification
- Check that all files are created in their correct folder paths.
- Click all the links in the root `README.md` and `docs/README.md` inside your editor to verify they point to correct absolute paths.
- Ensure formatting of markdown, mermaid blocks, and headings renders correctly in preview mode.
