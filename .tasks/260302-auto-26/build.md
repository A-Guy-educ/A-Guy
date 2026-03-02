# Build Report: Study Plan Adaptive Mode Behavior + Completion Persistence

**Task ID**: 260302-auto-26
**Status**: PLAN COMPLETE — Ready for implementation
**Date**: 2026-03-02

---

## Summary

This task expands the study plan engine's `TimeframeMode` from 3 modes (`survival`, `high_intensity`, `balanced`) to 4 modes (`near_term`, `medium_term`, `week_review`, `extended`) matching the spec's 4 proximity intervals. It also adds comprehensive tests for fallback/round-robin topic selection and completion persistence guarantees.

## Files to Modify

| File | Action | Description |
|---|---|---|
| `src/lib/study-plan/types.ts` | MODIFY line 4 | Change `TimeframeMode` union type |
| `src/lib/study-plan/constants.ts` | MODIFY lines 17-37 | Replace 3 `ACTIVITY_TEMPLATES` entries with 4 new ones |
| `src/lib/study-plan/engine.ts` | MODIFY lines 18-28 | Update `getTimeframeMode()` thresholds and JSDoc |
| `tests/unit/lib/study-plan/engine.spec.ts` | MODIFY entire file | Update existing tests + add fallback/round-robin tests |
| `tests/unit/lib/study-plan/merge.spec.ts` | MODIFY comments | Update references to old mode names |
| `tests/unit/lib/study-plan/persistence.spec.ts` | NEW | 5 persistence guarantee tests |

## Detailed Changes

### 1. `src/lib/study-plan/types.ts` (line 4)

**Before:**
```typescript
export type TimeframeMode = 'survival' | 'high_intensity' | 'balanced'
```

**After:**
```typescript
export type TimeframeMode = 'near_term' | 'medium_term' | 'week_review' | 'extended'
```

### 2. `src/lib/study-plan/constants.ts` (lines 17-37)

**Before:**
```typescript
export const ACTIVITY_TEMPLATES: Record<TimeframeMode, ActivityType[]> = {
  survival: ['warmup', 'warmup', 'warmup', 'warmup', 'warmup', 'warmup', 'warmup'],
  high_intensity: [
    'full_simulation', 'reinforcement', 'practice',
    'full_simulation', 'reinforcement', 'practice', 'warmup',
  ],
  balanced: [
    'practice', 'hybrid', 'practice',
    'reinforcement', 'hybrid', 'full_simulation', 'warmup',
  ],
}
```

**After:**
```typescript
export const ACTIVITY_TEMPLATES: Record<TimeframeMode, ActivityType[]> = {
  near_term: [
    'warmup', 'reinforcement', 'warmup',
    'reinforcement', 'warmup', 'reinforcement', 'warmup',
  ],
  medium_term: [
    'full_simulation', 'reinforcement', 'practice',
    'full_simulation', 'reinforcement', 'practice', 'warmup',
  ],
  week_review: [
    'practice', 'hybrid', 'practice',
    'reinforcement', 'hybrid', 'full_simulation', 'warmup',
  ],
  extended: [
    'practice', 'hybrid', 'reinforcement',
    'practice', 'hybrid', 'full_simulation', 'warmup',
  ],
}
```

**Rationale:**
- `near_term` (1-2d): Light review — warmup/reinforcement alternation (replaces all-warmup `survival`)
- `medium_term` (3-5d): High intensity — matches old `high_intensity` template exactly
- `week_review` (6-7d): Balanced — matches old `balanced` template exactly
- `extended` (8+d): Full variety with slightly more reinforcement spacing

### 3. `src/lib/study-plan/engine.ts` (lines 18-28)

**Before:**
```typescript
/**
 * Determine timeframe mode based on days until exam.
 * - <= 1 day: survival
 * - 2-5 days: high_intensity
 * - >= 6 days: balanced
 */
export function getTimeframeMode(daysUntilExam: number): TimeframeMode {
  if (daysUntilExam <= 1) return 'survival'
  if (daysUntilExam <= 5) return 'high_intensity'
  return 'balanced'
}
```

**After:**
```typescript
/**
 * Determine timeframe mode based on days until exam.
 * - 0-2 days: near_term (near-term review)
 * - 3-5 days: medium_term (medium-term review)
 * - 6-7 days: week_review (week-long review)
 * - 8+ days: extended (extended review)
 */
export function getTimeframeMode(daysUntilExam: number): TimeframeMode {
  if (daysUntilExam <= 2) return 'near_term'
  if (daysUntilExam <= 5) return 'medium_term'
  if (daysUntilExam <= 7) return 'week_review'
  return 'extended'
}
```

### 4. `tests/unit/lib/study-plan/engine.spec.ts` — Updated + New Tests

**Updated `getTimeframeMode` tests:**
- `0 days -> near_term` (was: survival)
- `1 day -> near_term` (was: survival)
- `2 days -> near_term` (was: high_intensity — KEY CHANGE)
- `3 days -> medium_term` (NEW)
- `5 days -> medium_term` (was: high_intensity)
- `6 days -> week_review` (was: balanced)
- `7 days -> week_review` (NEW)
- `8 days -> extended` (NEW)
- `30 days -> extended` (was: balanced)

**Updated `generateStudyPlan` integration tests:**
- `Timeframe mode: near_term — 0 days left` -> verify `near_term` template activities
- `Timeframe mode: near_term — 1 day left` -> verify `near_term` template activities
- `Timeframe mode: medium_term — 3 days left` -> verify `medium_term` template
- `Timeframe mode: extended — 19 days left` -> verify `extended` template
- NEW: `2-day vs 10-day behavior differences` -> 2d uses `near_term`, 10d uses `extended`, different activity types

**New `describe('fallback + round-robin')` block:**
1. `buildTopicCycle with only medium topics — uses medium with weight 2`: Given `[{topicId:'m1', mastery:'medium'}, {topicId:'m2', mastery:'medium'}]`, cycle = `['m1','m1','m2','m2']`
2. `buildTopicCycle with only strong topics — uses strong with weight 1`: Given `[{topicId:'s1', mastery:'strong'}, {topicId:'s2', mastery:'strong'}]`, cycle = `['s1','s2']`
3. `buildTopicCycle with mixed — weak 3x, medium 2x, strong 1x`: Given `[weak1, medium1, strong1]`, cycle = `['weak1','weak1','weak1','medium1','medium1','strong1']`
4. `pickTopicsForDay round-robin: no repeat before all peers covered`: 4 weak topics, verify distribution across practice days
5. `pickTopicsForDay fallback: 0 weak, 2 medium, 1 strong`: Medium appears more than strong
6. `pickTopicsForHybrid: all topics same mastery — no crash`: All-medium topics, hybrid works without crash

### 5. `tests/unit/lib/study-plan/merge.spec.ts` — Minor Updates

The existing tests use `examDate: '2026-03-10'` (9 days from `today: '2026-03-01'`). Under new logic, 9 days -> `extended` (was `balanced`). 

Tests only assert structural properties (7 days, all planned, valid structure, weak prioritized, activity variety), NOT specific mode names. The `extended` template has sufficient variety. **No functional test changes needed — only update comments.**

### 6. `tests/unit/lib/study-plan/persistence.spec.ts` — NEW FILE

5 tests covering completion persistence:

1. **`toggled day status survives in snapshot`** — Generate plan via `generateStudyPlan`, simulate toggle (map day 0 status to 'completed'), verify round-trip
2. **`regeneration always produces all-planned days`** — Generate, mark some completed, call `generateStudyPlan` again -> all planned
3. **`regeneration clears user overrides`** — Set userTopicIds/userDurationMinutes/userStartTime on days, regenerate -> none present
4. **`toggle status data shape matches StudyPlanSnapshot`** — Build plan, simulate toggle, verify all required fields present (courseId, examDate, generatedAt, topics, days with dayId/date/activityType/topicIds/status/estimatedDurationMinutes)
5. **`multiple toggles create correct final state`** — Toggle day0->completed, day1->completed, day0->planned -> verify day0=planned, day1=completed

---

## Verification Commands

```bash
# Step 1-2: Engine + fallback/round-robin tests
pnpm vitest run tests/unit/lib/study-plan/engine.spec.ts --config vitest.config.unit.mts

# Step 3: Persistence tests
pnpm vitest run tests/unit/lib/study-plan/persistence.spec.ts --config vitest.config.unit.mts

# Step 4: All study-plan tests + type check
pnpm vitest run tests/unit/lib/study-plan/ --config vitest.config.unit.mts && pnpm -s tsc --noEmit
```

## Acceptance Criteria Mapping

| Spec Requirement | Covered By |
|---|---|
| 2-day vs 10-day behavior differences validated | Step 1: getTimeframeMode tests + integration test comparing 2d vs 10d |
| Fallback + rotation validated by tests | Step 2: 6 new tests in describe('fallback + round-robin') |
| Completion persistence after refresh and regenerate | Step 3: 5 persistence tests |
| Test suite updated to prevent recurrence | Steps 1-3: All new and updated tests |

## Risk Assessment

- **Low risk**: `TimeframeMode` is only used within `src/lib/study-plan/` and its test files. No external consumers.
- **Breaking change scope**: Only the engine module internals and test assertions. The API route, hook, and UI components don't reference `TimeframeMode` values directly — they flow through `generateStudyPlan` which returns `StudyPlanDay[]` (type unchanged).
- **Template design**: The new `near_term` template changes from all-warmup to warmup/reinforcement alternation. This is an improvement — pure warmup was too weak for 2-day scenarios.

## Implementation Order

1. Modify `types.ts` (TimeframeMode type)
2. Modify `constants.ts` (ACTIVITY_TEMPLATES)
3. Modify `engine.ts` (getTimeframeMode function)
4. Update `engine.spec.ts` (existing tests + new fallback/round-robin tests)
5. Create `persistence.spec.ts` (new file)
6. Update `merge.spec.ts` (comments only)
7. Run all tests + type check
