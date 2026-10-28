## Description

Please include a summary of the change and which issue is fixed. Please also include relevant motivation and context.

Fixes # (issue)

### Change overview

<!-- Include a Mermaid diagram of the changed behavior, workflow, or component relationships, with a brief text explanation. For documentation or tooling, show the actual authoring or tooling flow. -->

## Type of change

Please delete options that are not relevant.

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] This change requires a documentation update
- [ ] Refactor (Changes that do not add functionality or fix a bug)

## How Has This Been Tested?

Record the tested revision and relevant environment. Include exact commands or reproduction steps, observed summaries, and available logs or CI links. Run both required suites: `python manage.py test` from `backend/` with its virtual environment activated, and `npm run test -- --run` from `frontend/`.

| Category | Suite or scenario | Command or steps | Result | Evidence |
|---|---|---|---|---|
| Automated | Backend suite | `python manage.py test` | NOT RUN | |
| Automated | Frontend suite | `npm run test -- --run` | NOT RUN | |
| Regression | | | NOT RUN | |
| Other checks | | | NOT RUN | |

<!-- Replace empty cells with actual evidence. Name the regression scenarios and other applicable checks. Use PASS, FAIL, SKIPPED, BLOCKED, NOT RUN, or N/A accurately; explain BLOCKED, NOT RUN, and N/A. Include test counts only when reported, distinguishing cases from files/suites. Label regressions already included in an automated suite to avoid double counting. -->

### Testing charts

<!-- Include a Mermaid chart with Automated, Regression, and Other checks groups and explicit outcomes matching the evidence table. Show all failures and unrun checks. If counts are unavailable, chart qualitative statuses. See .agents/skills/git-pr/references/chart-examples.md. -->

## Checklist:

- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged and published in downstream modules
