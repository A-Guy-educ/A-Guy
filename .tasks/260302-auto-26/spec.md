# Study Plan: Adaptive Mode Behavior + Completion Persistence

## Overview

This task validates and stabilizes the adaptive mode logic and completion persistence in the Study Plan feature after UI/engine changes. Regression fixes and tests are required to ensure stability.

## Requirements

### Adaptive Mode Behavior

The adaptive mode must differentiate study intervals by proximity:

- **1–2 days**: Near-term review
- **3–5 days**: Medium-term review  
- **6–7 days**: Week-long review
- **8+ days**: Extended review

### Topic Fallback and Round-Robin

The topic selection logic must remain correct:

- **Fallback pattern**: Weak → Medium → Strong (progressive difficulty)
- **Round-robin**: No repeat before peers in category are covered

### Completion Persistence

Completion state must persist across operations:

- **Refresh survival**: Mark complete survives page refresh
- **Regenerate retention**: Regenerate follows existing completion retention rule without data loss

## Acceptance Criteria

- [ ] 2-day vs 10-day behavior differences validated
- [ ] Fallback + rotation validated by tests
- [ ] Completion persistence validated after refresh and regenerate
- [ ] Test suite updated to prevent recurrence

## Files in Scope

- `src/lib/study-plan/engine.ts` (only if regression found)
- `src/app/(frontend)/study-plan/_components/useStudyPlan.ts`
- `tests/unit/lib/study-plan/engine.spec.ts`
- Relevant integration/unit tests for persistence
