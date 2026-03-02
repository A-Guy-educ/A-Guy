# Gate Request

## 🚦 Risk Gate: Approval Required

This task has been classified as **medium risk** and is paused for review before building.

| Field | Value |
|-------|-------|
| **Control Mode** | risk-gated |
| **Risk Level** | medium |
| **Task Type** | implement_feature |
| **Confidence** | 0.8 |
| **Scope** | `study-plan`, `exam-anchored-dates`, `manual-trigger` |

### Task Summary
> feat: study-plan: manual trigger generation + exam-anchored 7-day window de... - Closes #667

### Assumptions
- Study plan feature exists in the codebase
- Current date calculations use today-based logic that needs to change to exam-anchored
- Manual trigger will require UI changes for user action
- Exam collection exists with date fields

### Review Questions
1. Where is the current study plan generation logic located?
2. What exam fields are used for the 7-day window calculation?
3. Should the manual trigger be a button in the UI, an API endpoint, or both?

---

Reply with `@cody approve` or `/cody approve` to proceed.
Reply with `@cody reject` or `/cody reject` to cancel.
