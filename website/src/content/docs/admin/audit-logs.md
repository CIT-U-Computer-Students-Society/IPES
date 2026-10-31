---
title: 7. Audit Trail Inspection
description: Inspect immutable system audit logs, trace administrative actions, and verify evaluation integrity and compliance.
---

Transparency and accountability are fundamental to IPES. The system maintains an **Immutable Audit Log** (`/admin/audit`) that records every critical administrative event, state transition, and authentication action.

Audit logs cannot be updated or deleted by any user or administrator.

---

## 1. Searching & Filtering the Audit Log

In the Audit Log table, administrators can search by actor email, filter by action type (`FORM_ACTIVATED`, `FORM_CLOSED`, `ACCOMPLISHMENT_VERIFIED`, `RESULTS_RELEASED`), or restrict results to specific evaluation date ranges.

### Event Metadata Payload

Clicking **View** on any audit log entry reveals the permanent JSON payload:

```json
{
  "event_id": "audit_8f293b11",
  "actor": "admin@cit.edu",
  "action": "EVALUATION_RESULTS_RELEASED",
  "organization_id": "ssg-2026",
  "target_id": "form_cycle_midterm_2026",
  "timestamp": "2026-10-31T14:02:11.849Z",
  "ip_address": "10.0.4.12",
  "metadata": {
    "total_evaluatees": 24,
    "assignments_computed": 48,
    "percentile_algorithm": "standard_normal"
  }
}
```

This permanent audit trail ensures that questions regarding form deadlines, score releases, or membership privileges can always be verified with incontrovertible evidence.

Explore the [Confidentiality & Anonymity Policy](/IPES/policies/anonymity/) to understand how IPES protects evaluator privacy.
