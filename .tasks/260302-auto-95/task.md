# Task

## Issue Title

[2603--auto-654] Title: Study Plan Engine: Anchor schedule to exam countdown (exam-6..exam day)
Execution Contract (Routing Guard)
- Intent: IMPLEMENTATION (not spec-only)
- task_type: implement_feature
- pipeline: spec_execute_verify
- Deliverable: code + tests (no planning-only output)
 Problem
Generated day dates are not consistently anchored to the final exam countdown window.
 Required Behavior
- Always generate plan dates as the last countdown window ending on exam date.
- Target window: `examDate - 6` through `examDate` (inclusive), up to 7 days.
- If fewer than 7 days available, generate only available days ending on exam day.
- Do not anchor output to “today” when full countdown window exists.
- `daysUntilExam = 1` must produce warm-up mode behavior.
 Scope
- Engine/date math only (no UI redesign in this issue).
 Files
- `src/lib/study-plan/engine.ts`
- `tests/unit/lib/study-plan/engine.spec.ts`
 Acceptance Criteria
- [ ] Date sequence matches exam-6..exam day (or shorter when needed).
- [ ] 2-day, 5-day, 7-day, 10-day scenarios pass deterministic tests.
- [ ] No regressions in existing engine topic assignment outputs.
