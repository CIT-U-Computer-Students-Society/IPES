---
title: 4. Answering Peer Evaluations
description: Step-by-step instructions on filling out Likert rating rubrics, providing qualitative feedback, and submitting peer evaluations.
---

When an evaluation cycle is active, you are assigned specific fellow officers to evaluate according to your organization's assignment rules.

Navigate to **Evaluations** (`/member/evaluations`) or click **Start Form** from your dashboard queue.

---

## The Evaluation Form Interface

<img src="/IPES/images/annotated/officer/evaluation-rubric.svg" alt="Evaluation Rubric Annotated Interface" class="guide-screenshot" />

### Evaluation Submission Flow

```mermaid
flowchart TD
    Queue["Open Assigned Form<br/>from Dashboard Queue"] --> Criteria["Rate Competency Dimensions<br/>(1 to 5 Likert Rubrics)"]
    Criteria --> Feedback["Write Qualitative Constructive Feedback"]
    Feedback --> Decision{"Ready to finalize?"}
    Decision -->|Need More Time| SaveDraft["Save Draft<br/>(Editable until cycle deadline)"]
    Decision -->|Confirm & Lock| FinalSubmit["Submit Final Evaluation<br/>(Anonymized & Locked)"]
```

### Rating Criteria

1. <span class="step-badge-amber step-badge">1</span> **5-Point Likert Rating Scale**:
   - **1 — Unsatisfactory**: Consistently fails to meet basic role expectations.
   - **2 — Needs Improvement**: Meets some requirements but requires frequent supervision.
   - **3 — Satisfactory**: Reliably meets role expectations with good quality.
   - **4 — Very Good**: Exceeds standard expectations; demonstrates proactive ownership.
   - **5 — Outstanding**: Exceptional impact, inspirational leadership, and exemplary execution.
   
2. <span class="step-badge">2</span> **Constructive Qualitative Feedback**:
   - Provide concrete examples of strengths and actionable suggestions for growth. Feedback is aggregated anonymously to encourage genuine professional development.

3. <span class="step-badge">3</span> **Final Submission**:
   - Click **Save Draft** to store your progress and return later.
   - Click **Submit Final Evaluation** to finalize your assessment.

:::caution[Submission Locking]
Once an evaluation is submitted, the record is permanently locked to preserve evaluation integrity. If you made a critical error before the cycle closes, notify your administrator immediately.
:::

Next, learn how to interpret your [Evaluation Results](/IPES/officer/results/).
