# Task

## Issue Title

[2603--auto-656] Title: Study Plan: Adaptive mode behavior + completion persistence regression coverage
Execution Contract (Routing Guard)
- Intent: IMPLEMENTATION (not spec-only)
- task_type: implement_feature
- pipeline: spec_execute_verify
- Deliverable: code + tests (no planning-only output)
 Problem
After UI/engine changes, adaptive mode logic and completion persistence must be validated and stabilized.
 Required Behavior
- Adaptive mode differences must be clear by proximity:
  - 1–2 days, 3–5 days, 6–7 days, 8+ days
- Topic fallback and round-robin remain correct:
  - Weak -> Medium -> Strong
  - no repeat before peers in category are covered
- Completion persistence remains intact:
  - mark complete survives refresh
  - regenerate follows existing completion retention rule without data loss
 Scope
- Regression fixes + tests only.
- No redesign unless required to satisfy behavior.
 Files
- `src/lib/study-plan/engine.ts` (only if regression found)
- `src/app/(frontend)/study-plan/_components/useStudyPlan.ts`
- `tests/unit/lib/study-plan/engine.spec.ts`
- relevant integration/unit tests for persistence
 Acceptance Criteria
- [ ] 2-day vs 10-day behavior differences validated.
- [ ] Fallback + rotation validated by tests.
- [ ] Completion persistence validated after refresh and regenerate.
- [ ] Test suite updated to prevent recurrence.
