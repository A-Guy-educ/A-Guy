# Plan: Study Plan Adaptive Mode Behavior + Completion Persistence

**Task ID**: 260302-auto-26
**Task Type**: implement_feature
**Spec**: Validate and stabilize adaptive mode logic and completion persistence

## Rerun Context

This is a rerun triggered via `/cody rerun` with no specific code-level feedback. The previous build likely failed or did not produce a plan. This plan provides a fresh, detailed implementation approach.

## Analysis

### Current State

The existing codebase has:

1. **Engine** (`src/lib/study-plan/engine.ts`): `getTimeframeMode()` maps days to 3 modes — `survival` (≤1d), `high_intensity` (2-5d), `balanced` (≥6d). This partially satisfies the spec but does NOT differentiate between the 4 required proximity intervals (1-2d, 3-5d, 6-7d, 8+d).

2. **Existing tests** (`tests/unit/lib/study-plan/engine.spec.ts`): Cover the 3-mode system but NOT the 4-interval system required by spec.

3. **Completion persistence** (`src/app/api/study-plan/route.ts`): `toggleStatus` action persists to DB via `user-progress` collection. Data survives refresh. Regeneration via `handleGenerate` creates a FRESH plan (all `'planned'`), which matches the current `merge.ts` design (merge logic removed; regeneration clears completions).

4. **Regeneration behavior** (`merge.ts`): Empty — regeneration intentionally clears all state.

### Gap Analysis (Spec vs Current)

| Requirement | Current State | Gap |
|---|---|---|
| 1-2 day interval | `survival` (≤1d) | Need to split: 1d=survival, 2d=near_term |
| 3-5 day interval | `high_intensity` (2-5d) | 2d incorrectly in this bucket |
| 6-7 day interval | Part of `balanced` (≥6d) | Need to split balanced into 6-7d and 8+d |
| 8+ day interval | Part of `balanced` (≥6d) | See above |
| Fallback weak→medium→strong | ✅ Already implemented | Tests needed to validate edge cases |
| Round-robin no-repeat | ✅ Cycle-based approach exists | Tests needed to prove no-repeat-before-peers |
| Completion survives refresh | ✅ Persisted via API | Needs integration test |
| Regenerate clears completions | ✅ By design (merge.ts empty) | Needs test asserting this |

### Design Decisions

1. **Expand `TimeframeMode`** from 3 modes to 4: `survival` (≤1d), `near_term` (2-3d), `medium_term` (4-5d), `balanced` (6-7d) becomes `week_review`, and `extended` (8+d). **WAIT** — re-reading the spec more carefully:

   The spec says:
   - 1-2 days: Near-term review
   - 3-5 days: Medium-term review
   - 6-7 days: Week-long review
   - 8+ days: Extended review

   Current engine has 3 modes; we need 4. We rename:
   - `survival` → removed (or kept as legacy)
   - `near_term` (1-2d)
   - `medium_term` (3-5d)
   - `week_review` (6-7d)
   - `extended` (8+d)

2. **Activity templates** — each new mode needs a 7-day template. The existing templates give us patterns to follow:
   - `near_term` (1-2d): Mostly warmup + reinforcement (cramming mode)
   - `medium_term` (3-5d): High intensity practice + simulation
   - `week_review` (6-7d): Balanced practice/hybrid/simulation
   - `extended` (8+d): Full balanced with variety

3. **Completion persistence tests** — write integration-style tests that exercise the API route logic patterns (toggle → verify status → re-fetch → verify persisted).

---

## Steps

### Step 1: Expand TimeframeMode and getTimeframeMode() — 4 Adaptive Intervals

**Files to Touch**:
- `src/lib/study-plan/types.ts` (MODIFIED — line 4)
- `src/lib/study-plan/constants.ts` (MODIFIED — lines 17-37)
- `src/lib/study-plan/engine.ts` (MODIFIED — lines 23-28)
- `tests/unit/lib/study-plan/engine.spec.ts` (MODIFIED — lines 7-32)

**Exact Behavior**:
- `TimeframeMode` type changes from `'survival' | 'high_intensity' | 'balanced'` to `'near_term' | 'medium_term' | 'week_review' | 'extended'`
- `getTimeframeMode(daysUntilExam)`:
  - `daysUntilExam <= 2` → `'near_term'`
  - `daysUntilExam <= 5` → `'medium_term'`
  - `daysUntilExam <= 7` → `'week_review'`
  - `daysUntilExam >= 8` → `'extended'`
- New `ACTIVITY_TEMPLATES` for each mode (7-day arrays):
  - `near_term`: `['warmup', 'reinforcement', 'warmup', 'reinforcement', 'warmup', 'reinforcement', 'warmup']` — light review focus
  - `medium_term`: `['full_simulation', 'reinforcement', 'practice', 'full_simulation', 'reinforcement', 'practice', 'warmup']` — intensive (matches old `high_intensity`)
  - `week_review`: `['practice', 'hybrid', 'practice', 'reinforcement', 'hybrid', 'full_simulation', 'warmup']` — balanced (matches old `balanced`)
  - `extended`: `['practice', 'hybrid', 'reinforcement', 'practice', 'hybrid', 'full_simulation', 'warmup']` — full variety, spaced out

**Tests (FAIL before, PASS after)**:

1. `getTimeframeMode(1) → 'near_term'` (was: `'survival'` — test must fail first)
2. `getTimeframeMode(2) → 'near_term'` (was: `'high_intensity'` — test must fail first)
3. `getTimeframeMode(3) → 'medium_term'`
4. `getTimeframeMode(5) → 'medium_term'`
5. `getTimeframeMode(6) → 'week_review'`
6. `getTimeframeMode(7) → 'week_review'`
7. `getTimeframeMode(8) → 'extended'`
8. `getTimeframeMode(30) → 'extended'`
9. `getTimeframeMode(0) → 'near_term'` (edge case: 0 days, treat as near-term)
10. `generateStudyPlan with 2 days left uses near_term template` — validates 2-day behavior difference
11. `generateStudyPlan with 10 days left uses extended template` — validates 10-day behavior difference

**Acceptance Criteria**:
- [ ] `TimeframeMode` type has exactly 4 values: `near_term`, `medium_term`, `week_review`, `extended`
- [ ] `getTimeframeMode` returns correct mode for all 4 intervals
- [ ] `ACTIVITY_TEMPLATES` has entries for all 4 modes (each a 7-element array)
- [ ] Existing plan generation still produces 7 days with valid structure
- [ ] All existing tests updated to reflect new mode names
- [ ] `pnpm tsc --noEmit` passes (TypeScript compiles)
- [ ] Spec requirement "2-day vs 10-day behavior differences validated" is covered

**Test Command**: `pnpm vitest run tests/unit/lib/study-plan/engine.spec.ts --config vitest.config.unit.mts`

---

### Step 2: Validate Fallback + Round-Robin Topic Selection with Edge-Case Tests

**Files to Touch**:
- `tests/unit/lib/study-plan/engine.spec.ts` (MODIFIED — append new describe blocks)
- `src/lib/study-plan/engine.ts` (ONLY IF regression found — no changes expected)

**Exact Behavior** (already implemented, needs test validation):
- **Fallback pattern**: When no weak topics exist, the engine falls back to medium. When no medium, falls back to strong. Tests must validate the progressive difficulty chain: weak → medium → strong.
- **Round-robin**: The cycle-based topic picker (`buildTopicCycle` + `pickTopicsForDay`) ensures each topic in its mastery tier is visited before any repeats within that tier.

**Tests (FAIL before, PASS after)**:

1. **`buildTopicCycle with only medium topics — uses medium with weight 2`**: Given topics `[{topicId:'m1', mastery:'medium'}, {topicId:'m2', mastery:'medium'}]`, the cycle should contain `['m1','m1','m2','m2']` (2x each, sorted by topicId). Validates fallback path where no weak topics exist.

2. **`buildTopicCycle with only strong topics — uses strong with weight 1`**: Given topics `[{topicId:'s1', mastery:'strong'}, {topicId:'s2', mastery:'strong'}]`, cycle should be `['s1','s2']` (1x each).

3. **`buildTopicCycle with mixed — weak 3x, medium 2x, strong 1x`**: Given `[weak1, medium1, strong1]`, cycle should be `['weak1','weak1','weak1','medium1','medium1','strong1']`.

4. **`pickTopicsForDay round-robin: no repeat before all peers covered`**: Generate a 7-day plan with 4 weak topics. Across days using the `practice` activity (2 topics/day), verify that within any contiguous window of 4 practice days, all 4 weak topics appear at least once before any topic repeats more than once. This tests the round-robin guarantee.

5. **`pickTopicsForDay fallback: plan with 0 weak, 2 medium, 1 strong`**: Generate plan, verify non-simulation days have topic IDs, and that medium topics appear more frequently than strong (weighted 2x vs 1x across the plan).

6. **`pickTopicsForHybrid: all topics same mastery — no crash, returns topics`**: Given all-medium topics, hybrid selection should not crash and should return topic IDs.

**Acceptance Criteria**:
- [ ] Fallback chain (weak → medium → strong) proven by tests
- [ ] Round-robin / no-repeat-before-peers proven by test
- [ ] No engine code changes needed (pure validation step)
- [ ] All new tests pass
- [ ] Spec requirement "Fallback + rotation validated by tests" is covered

**Test Command**: `pnpm vitest run tests/unit/lib/study-plan/engine.spec.ts --config vitest.config.unit.mts`

---

### Step 3: Completion Persistence — Refresh Survival and Regeneration Retention Tests

**Files to Touch**:
- `tests/unit/lib/study-plan/persistence.spec.ts` (NEW)
- `src/app/api/study-plan/route.ts` (ONLY IF regression found — no changes expected)

**Exact Behavior**:
These are unit-level tests that exercise the persistence logic patterns WITHOUT a real database. They test the data flow functions/patterns used by the API route.

Since the API route handler functions are not easily importable (they're private to the route module), we'll test the core guarantee at the data level:

1. **Refresh survival**: After `toggleStatus` modifies a plan's day status in the `studyPlans` array and saves it, re-fetching the data returns the updated status. We simulate this by testing the data transformation logic (building the updated plan snapshot).

2. **Regenerate clears completions**: After `generateStudyPlan` is called (even when a previous plan had completed days), the result always has all days as `'planned'`. This is already the engine behavior — we add explicit tests.

**Tests (FAIL before, PASS after)**:

1. **`completion persistence: toggled day status survives in snapshot`**: Create a plan via `generateStudyPlan`, manually set day 0 to `'completed'`, simulate the toggle-back logic (map over days), verify the snapshot contains `'completed'` status. Then simulate a "re-read" by parsing the same snapshot — verify `'completed'` is still there. This validates the data shape round-trips correctly.

2. **`completion persistence: regeneration always produces all-planned days`**: Create a plan with `generateStudyPlan`, manually mark some days as completed, then call `generateStudyPlan` again with same inputs (simulating regenerate). Verify ALL days in the new result have `status: 'planned'`. No carryover.

3. **`completion persistence: regeneration clears user overrides`**: Same as above but set `userTopicIds`, `userDurationMinutes`, `userStartTime` on days before regeneration. Verify new plan has NO user overrides on any day.

4. **`completion persistence: toggle status data shape matches StudyPlanSnapshot`**: Build a plan, toggle a day, and verify the resulting object satisfies the `StudyPlanSnapshot` shape — all required fields present (courseId, examDate, generatedAt, topics, days with dayId/date/activityType/topicIds/status/estimatedDurationMinutes).

5. **`completion persistence: multiple toggles create correct final state`**: Toggle day0 to completed → toggle day1 to completed → toggle day0 back to planned. Verify: day0=planned, day1=completed.

**Acceptance Criteria**:
- [ ] New test file `tests/unit/lib/study-plan/persistence.spec.ts` exists
- [ ] All 5 tests pass
- [ ] Tests verify the data-level guarantees that back the "refresh survival" UX
- [ ] Tests verify regeneration clears all completion state
- [ ] Spec requirement "Completion persistence validated after refresh and regenerate" is covered
- [ ] Spec requirement "Test suite updated to prevent recurrence" is covered

**Test Command**: `pnpm vitest run tests/unit/lib/study-plan/persistence.spec.ts --config vitest.config.unit.mts`

---

### Step 4: Final Validation — All Tests Pass, TypeScript Compiles

**Files to Touch**:
- `tests/unit/lib/study-plan/merge.spec.ts` (MODIFIED — update references from old mode names if any)
- Any test file with stale references to `survival`, `high_intensity`, or `balanced` mode names

**Exact Behavior**:
- Update `merge.spec.ts` tests: The existing tests reference `generateStudyPlan` and validate structure. Since we changed `TimeframeMode`, the `getTimeframeMode` return value used inside `generateStudyPlan` changes from `high_intensity` (for 9 daysLeft) to `extended`. The tests don't directly assert mode names, so they should pass. But verify.
- Run the full unit test suite and `tsc --noEmit` to ensure nothing is broken.

**Tests (verification)**:
1. `pnpm vitest run tests/unit/lib/study-plan/ --config vitest.config.unit.mts` — all 3 test files pass
2. `pnpm tsc --noEmit` — zero errors

**Acceptance Criteria**:
- [ ] All unit tests in `tests/unit/lib/study-plan/` pass (engine.spec.ts, merge.spec.ts, persistence.spec.ts)
- [ ] TypeScript compiles without errors
- [ ] No regressions in existing functionality
- [ ] All 4 spec acceptance criteria met:
  - 2-day vs 10-day behavior differences validated ✅ (Step 1)
  - Fallback + rotation validated by tests ✅ (Step 2)
  - Completion persistence validated after refresh and regenerate ✅ (Step 3)
  - Test suite updated to prevent recurrence ✅ (Steps 1-3)

**Verification Command**: `pnpm vitest run tests/unit/lib/study-plan/ --config vitest.config.unit.mts && pnpm -s tsc --noEmit`

---

## Assumptions

1. **No clarified.md exists** — proceeding based on spec.md alone.
2. **Rerun feedback is generic** — no specific code-level issues to address.
3. **The 4 proximity intervals** in the spec map to 4 `TimeframeMode` values replacing the existing 3.
4. **Activity templates for new modes** are reasonable defaults based on educational pacing patterns. The spec doesn't prescribe exact templates, so we use sensible variations.
5. **`merge.ts` stays empty** — the spec says "regenerate follows existing completion retention rule without data loss." The current rule IS that regeneration clears completions (fresh recommendation). The "without data loss" means the old plan is simply replaced in the DB, not that completions survive regeneration. This is consistent with the existing `merge.ts` comment: "regeneration clears all completion status."
6. **Integration tests not needed for persistence** — The API route already persists correctly. We validate the data-level guarantees in unit tests. If an integration test is needed, it would require a running Payload+MongoDB setup which is heavier than the spec implies.
7. **No changes to UI components** — The spec only calls out engine and hook files. The UI (`DayCard.tsx`, `StudyPlanPage.tsx`) doesn't reference `TimeframeMode` directly.

## Files Summary

| File | Action | Step |
|---|---|---|
| `src/lib/study-plan/types.ts` | MODIFIED (line 4) | 1 |
| `src/lib/study-plan/constants.ts` | MODIFIED (lines 17-37) | 1 |
| `src/lib/study-plan/engine.ts` | MODIFIED (lines 23-28) | 1 |
| `tests/unit/lib/study-plan/engine.spec.ts` | MODIFIED (update + add tests) | 1, 2 |
| `tests/unit/lib/study-plan/persistence.spec.ts` | NEW | 3 |
| `tests/unit/lib/study-plan/merge.spec.ts` | MODIFIED (verify/fix mode refs) | 4 |
