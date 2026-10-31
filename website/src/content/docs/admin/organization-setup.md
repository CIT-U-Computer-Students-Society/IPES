---
title: 1. Organization & Units Setup
description: Guide for administrators on configuring student organization committees, units, and position rank hierarchies.
---

As an IPES Administrator, your first responsibility in preparing an evaluation cycle is defining your organization's structural hierarchy. IPES models student organizations through **Units** (committees or departments) and **Positions** (ranked roles within each unit).

Navigate to **Organization Settings** (`/admin/organization`) to configure these elements.

---

## 1. Managing Units (Committees) & Ranked Positions

Units represent functional subdivisions within your student body (e.g., *"Executive Board"*, *"Committee on Research"*, *"Ways and Means"*).

<img src="/IPES/images/annotated/admin/units-and-positions.svg" alt="Admin Units and Positions Annotated Interface" class="guide-screenshot" />

### Structural Hierarchy Model

```mermaid
flowchart TD
    Org["Student Organization<br/>(e.g., Supreme Student Government)"]
    Org --> U1["Executive Board"]
    Org --> U2["Committee on Research"]
    Org --> U3["Ways and Means"]

    U2 --> P1["Rank 1: Committee Chair (Unit Head)"]
    U2 --> P2["Rank 2: Senior Research Associate"]
    U2 --> P3["Rank 3: Junior Officer"]
```

### Key Setup Actions

1. <span class="step-badge-amber step-badge">1</span> **Add Unit**: Click to open the committee creation drawer and specify the unit name and description.
2. <span class="step-badge">2</span> **Hierarchy Rank 1 (Unit Head)**:
   - **Rank 1**: Designates the **Unit Head** (Committee Chair, Director, or Lead). This rank is critical for automated evaluation rules such as *All-to-Head* or *Head-to-All*.
   - **Rank 2+**: Designates subordinate committee officers in order of seniority.

:::note[Soft Deletes]
IPES enforces **soft deletes**. Deleting a unit deactivates it without deleting historical evaluation assignments or audit records from prior academic terms.
:::

Next, learn how to invite and manage [Members & Role Permissions](/IPES/admin/members-and-roles/).
