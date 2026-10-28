# IPES Developer Documentation Directory

Welcome to the Individual Performance Evaluation System (IPES) developer documentation index. This folder contains separated, modular guides for configuring, developing, testing, and understanding the IPES application.

---

## 📁 Documentation Contents

Use the links below to navigate the guides:

### General / Overview
*   [Project Manifesto](Manifesto.md): Core goals, objectives, and foundational values of the IPES project.

### Setup & Getting Started
*   [Setup & Installation Guide](SETUP.md): Requirements, environment setup, database migrations, and local runner commands.
*   [Testing Guide](TESTING.md): Run instructions for Django and Vitest unit testing suites.
*   [Dependency Audit](DEPENDENCIES.md): Dependency cleanup, retained UI packages, and existing compatibility issues.
*   [Contributing Guide](CONTRIBUTING.md): Git branching policies and Conventional Commit standards.
*   [Component Releases](RELEASING.md): Release Please setup, independent web/backend/docs versions, and publication workflow.

### System Architecture & Design
*   [Entity Relationship Diagram (ERD)](architecture/ERD.md): Visual mapping of database tables and relationships.
*   [Evaluation Form Lifecycle Diagram](architecture/sequence_diagrams/evaluation_form_lifecycle.md): Sequence mapping form creation, assignments, and results.
*   [Accomplishment Verification Diagram](architecture/sequence_diagrams/accomplishment_verification.md): Sequence mapping portfolios verification workflow.
*   [API Design and Endpoints Registry](API_Design.md): Catalog of endpoints, authorization formats, and methods.
