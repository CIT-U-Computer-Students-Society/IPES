---
title: 4. Assignment Rules Engine
description: Configure declarative assignment rules to dynamically map which members evaluate each other across organizational units.
---

One of IPES's most powerful capabilities is the **Assignment Rules Engine** (`/admin/assignments`). Instead of manually matching pairs or generating individualized Google Form links, administrators establish declarative rules.

When the evaluation cycle transitions to **Active**, IPES parses these rules against your active membership roster and automatically generates all concrete evaluator-evaluatee pairs.

---

## 1. Rule Types & Previewing the Matrix

<img src="/IPES/images/annotated/admin/assignment-rules.svg" alt="Assignment Rules Engine and Matrix Preview Annotated Interface" class="guide-screenshot" />

### Assignment Rule Evaluation Flow

```mermaid
flowchart TD
    Rule{"Rule Type Defined"}
    Rule -->|Peer-to-Peer| P2P["Intra-Unit Peers<br/>(Officers evaluate fellow committee members)"]
    Rule -->|All-to-Head| A2H["Subordinates to Head<br/>(All unit officers evaluate Rank 1 Chair)"]
    Rule -->|Head-to-All| H2A["Head to Subordinates<br/>(Rank 1 Chair evaluates all committee officers)"]
    Rule -->|Self-Evaluation| SELF["Self Assessment<br/>(Officer evaluates own performance)"]

    P2P --> Matrix["Assignment Matrix Generated<br/>(Concrete Evaluator-Evaluatee Pairs)"]
    A2H --> Matrix
    H2A --> Matrix
    SELF --> Matrix
```

### Rule Archetypes

1. <span class="step-badge-amber step-badge">1</span> **Rule Configuration**:
   - **Peer-to-Peer (`PEER`)**: Members in the same committee evaluate each other (excluding self unless specified).
   - **All-to-Head (`ALL_TO_HEAD`)**: All unit members evaluate their committee chair (Rank 1).
   - **Head-to-All (`HEAD_TO_ALL`)**: Unit head evaluates all subordinate members in their committee.
   - **Self-Evaluation (`SELF`)**: Members complete a reflective assessment of their own performance.

2. <span class="step-badge-navy step-badge">2</span> **Matrix Preview Table**:
   - Recalculates and displays all generated evaluator-to-evaluatee pairs (e.g. 48 Total Pairs) so administrators can verify coverage before cycle activation.

:::caution[Verify Before Activating]
Always verify the matrix preview to ensure every officer has appropriate evaluatees assigned before launching the cycle.
:::

Next, learn how to manage the [Accomplishment Verification Queue](/IPES/admin/accomplishment-verification/).
