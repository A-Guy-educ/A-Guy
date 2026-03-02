# Plan: Study Plan Engine — Anchor Schedule to Exam Countdown

## Rerun Context

This is a rerun triggered by `/cody rerun` with no specific failure feedback. The previous run likely had no plan.md yet. This plan is a fresh write covering the full implementation.

## Summary

**Current behavior**: `generateStudyPlan()` generates 7 days anchored to `today` (lines 236-251 of `engine.ts`). Dates run `today` through `today+6`, regardless of when the exam is.

**Required behavior**: Generate days anchored to the *exam countdown window* — `examDate-6` through `examDate` (inclusive, max 7 days). If fewer than 7 days are available (i.e., `today` is within the window), generate only the days from `today` through `examDate`.

**Key insight**: The activity template selection (via `getTimeframeMode`) already works correctly based on `daysUntilExam`. Only the **date anchoring** and **day count** need to change. Topic assignment logic is untouched.

## Assumptions

1. "Fewer than 7 days available" means `today` is after `examDate - 6`, so the window starts at `today` instead of `examDate - 6`.
2. When `daysUntilExam = 0` (exam is today), generate 1 day (exam day itself).
3. When `daysUntilExam = 1`, generate 2 days (today + exam day) — both in survival/warmup mode.
4. The activity template is indexed from `dayIndex=0` as before, using the **last N entries** of the 7-day template when fewer than 7 days are generated (so the final day always gets the last template slot).
5. The API route (`src/app/api/study-plan/route.ts`) does not need changes — it already passes `today` and `examDate` to the engine. The engine decides the window.
6. Existing merge.spec.ts tests may need date adjustments since they currently expect 7 days; after the change, the day count depends on the exam-today gap vs the 7-day window.

## Files to Touch

| File | Status | Lines | Description |
|---|---|---|---|
| `src/lib/study-plan/engine.ts` | MODIFIED | 220-253 | Change date anchoring from today-based to exam-countdown-based |
| `tests/unit/lib/study-plan/engine.spec.ts` | MODIFIED | entire `generateStudyPlan` describe block | Update existing tests, add new countdown scenario tests |
| `tests/unit/lib/study-plan/merge.spec.ts` | MODIFIED | ~22-27 | Adjust `baseInput` dates so existing tests still produce 7 days |

---

## Step 1: Update Engine — Anchor Dates to Exam Countdown Window
**Time estimate**: 15 minutes

### Files to Touch
- `src/lib/study-plan/engine.ts` (MODIFIED — lines 216-253)

### Exact Behavior Change

**Before** (lines 236-251):
```typescript
// Generate 7 days anchored to today
const days: StudyPlanDay[] = []
for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
  const date = format(addDays(todayDate, dayIndex), 'yyyy-MM-dd')
  const activityType = template[dayIndex]
  ...
}
```

**After**:
```typescript
// Calculate the countdown window
// Window start: max(today, examDate - 6)
// Window end: examDate
// Number of days: min(7, daysLeft + 1)  (daysLeft = examDate - today)
const windowStart = daysLeft >= 7
  ? addDays(examDateObj, -6)   // Full 7-day window ending on exam day
  : todayDate                    // Partial window starting from today
const numDays = Math.min(7, Math.max(1, daysLeft + 1))

// Use the LAST numDays entries from the 7-day template
// This ensures the final day always uses template[6] (usually warmup)
const templateOffset = 7 - numDays

const days: StudyPlanDay[] = []
for (let dayIndex = 0; dayIndex < numDays; dayIndex++) {
  const date = format(addDays(windowStart, dayIndex), 'yyyy-MM-dd')
  const activityType = template[templateOffset + dayIndex]
  const topicIds = pickTopicsForDay(cycle, dayIndex, activityType, allTopicIds, topics)
  days.push({
    dayId: idGenerator(),
    date,
    activityType,
    topicIds,
    status: 'planned',
    estimatedDurationMinutes: ACTIVITY_DURATIONS[activityType],
  })
}
```

Also update the JSDoc on line 217 from "anchored to today" to "anchored to exam countdown window".

### Tests (FAIL before, PASS after)

**Test 1**: `7-day scenario — dates are examDate-6 through examDate`
```typescript
it('7-day scenario — dates are exam-6 through examDate', () => {
  const input = {
    today: '2026-03-01',
    examDate: '2026-03-20', // 19 days out, full window available
    topics: [{ topicId: 't1', topicLabel: 'T1', mastery: 'weak' as const }],
    idGenerator,
  }
  const result = generateStudyPlan(input)
  expect(result).toHaveLength(7)
  // Dates should be 2026-03-14 through 2026-03-20 (exam-6..exam)
  expect(result[0].date).toBe('2026-03-14')
  expect(result[6].date).toBe('2026-03-20')
})
```
- **Fails before**: Currently generates `2026-03-01` through `2026-03-07`
- **Passes after**: Generates `2026-03-14` through `2026-03-20`

**Test 2**: `2-day scenario — only 2 days generated`
```typescript
it('2-day scenario — generates 2 days ending on examDate', () => {
  const input = {
    today: '2026-03-19',
    examDate: '2026-03-20', // 1 day left
    topics: [{ topicId: 't1', topicLabel: 'T1', mastery: 'weak' as const }],
    idGenerator,
  }
  const result = generateStudyPlan(input)
  expect(result).toHaveLength(2)
  expect(result[0].date).toBe('2026-03-19')
  expect(result[1].date).toBe('2026-03-20')
})
```
- **Fails before**: Currently generates 7 days (`2026-03-19` through `2026-03-25`)
- **Passes after**: Generates 2 days

### Acceptance Criteria
- [x] (FR-1) Dates are anchored to exam countdown, not today
- [x] (FR-2) Full window is examDate-6 through examDate (7 days)
- [x] (FR-3) Partial window when fewer than 7 days available

---

## Step 2: Add Deterministic Scenario Tests — 2-day, 5-day, 7-day, 10-day
**Time estimate**: 20 minutes

### Files to Touch
- `tests/unit/lib/study-plan/engine.spec.ts` (MODIFIED — add new describe block)

### Tests to Add

All tests below should FAIL before Step 1 changes, PASS after.

**Test 1**: `10-day scenario — still 7 days, anchored to exam`
```typescript
it('10-day scenario — 7 days ending on examDate', () => {
  const input = {
    today: '2026-03-10',
    examDate: '2026-03-20', // 10 days away
    topics: [
      { topicId: 't1', topicLabel: 'T1', mastery: 'weak' as const },
      { topicId: 't2', topicLabel: 'T2', mastery: 'medium' as const },
    ],
    idGenerator,
  }
  const result = generateStudyPlan(input)
  expect(result).toHaveLength(7)
  expect(result[0].date).toBe('2026-03-14') // examDate - 6
  expect(result[6].date).toBe('2026-03-20') // examDate
})
```

**Test 2**: `5-day scenario — 5 days ending on examDate`
```typescript
it('5-day scenario — 5 days ending on examDate', () => {
  const input = {
    today: '2026-03-16',
    examDate: '2026-03-20', // 4 days left → 5 days inclusive
    topics: [{ topicId: 't1', topicLabel: 'T1', mastery: 'weak' as const }],
    idGenerator,
  }
  const result = generateStudyPlan(input)
  expect(result).toHaveLength(5)
  expect(result[0].date).toBe('2026-03-16')
  expect(result[4].date).toBe('2026-03-20')
})
```

**Test 3**: `2-day scenario — survival mode warmup`
```typescript
it('2-day scenario — survival mode warmup on all days', () => {
  const input = {
    today: '2026-03-19',
    examDate: '2026-03-20', // 1 day left → survival
    topics: [{ topicId: 't1', topicLabel: 'T1', mastery: 'weak' as const }],
    idGenerator,
  }
  const result = generateStudyPlan(input)
  expect(result).toHaveLength(2)
  result.forEach(day => {
    expect(day.activityType).toBe('warmup')
  })
})
```

**Test 4**: `7-day scenario (exact) — today is exactly exam-6`
```typescript
it('7-day scenario — today is exactly exam-6', () => {
  const input = {
    today: '2026-03-14',
    examDate: '2026-03-20', // exactly 6 days → 7 days inclusive
    topics: [{ topicId: 't1', topicLabel: 'T1', mastery: 'weak' as const }],
    idGenerator,
  }
  const result = generateStudyPlan(input)
  expect(result).toHaveLength(7)
  expect(result[0].date).toBe('2026-03-14')
  expect(result[6].date).toBe('2026-03-20')
})
```

**Test 5**: `daysUntilExam = 1 produces warmup mode` (FR-4)
```typescript
it('daysUntilExam = 1 produces warmup (survival) mode', () => {
  const input = {
    today: '2026-03-19',
    examDate: '2026-03-20', // 1 day
    topics: [
      { topicId: 't1', topicLabel: 'T1', mastery: 'weak' as const },
      { topicId: 't2', topicLabel: 'T2', mastery: 'medium' as const },
    ],
    idGenerator,
  }
  const result = generateStudyPlan(input)
  expect(result).toHaveLength(2)
  expect(result[0].activityType).toBe('warmup')
  expect(result[1].activityType).toBe('warmup')
})
```

**Test 6**: `1-day scenario (exam today) — single day`
```typescript
it('1-day scenario — exam is today, single warmup day', () => {
  const input = {
    today: '2026-03-20',
    examDate: '2026-03-20', // 0 days left
    topics: [{ topicId: 't1', topicLabel: 'T1', mastery: 'weak' as const }],
    idGenerator,
  }
  const result = generateStudyPlan(input)
  expect(result).toHaveLength(1)
  expect(result[0].date).toBe('2026-03-20')
  expect(result[0].activityType).toBe('warmup')
})
```

### Acceptance Criteria
- [x] (FR-2, FR-3) 2-day, 5-day, 7-day, 10-day scenarios all have deterministic date tests
- [x] (FR-4) daysUntilExam=1 produces warmup mode
- [x] All tests are deterministic (fixed dates, fixed idGenerator)

---

## Step 3: Update Existing Tests for New Anchoring Behavior
**Time estimate**: 20 minutes

### Files to Touch
- `tests/unit/lib/study-plan/engine.spec.ts` (MODIFIED — update existing tests)
- `tests/unit/lib/study-plan/merge.spec.ts` (MODIFIED — update baseInput)

### Changes Required

The existing tests will break because they expect 7 days or specific date sequences anchored to `today`. They need to be updated:

#### engine.spec.ts Changes

1. **"Always 7 days — 1 topic"** (line 60): Uses `today=2026-03-01, examDate=2026-03-20` → 19 days, window is exam-6..exam. Still 7 days. **No change needed** — just verify dates changed from today-anchored to exam-anchored.

2. **"Always 7 days — 3 topics"** (line 72): Same dates. Still 7 days. **No change needed to count assertion**, but rename if we want to clarify. Keep as-is.

3. **"Always 7 days — 10 topics"** (line 88): Same dates. Still 7 days. **No change needed**.

4. **"Timeframe mode: survival — 0 days left"** (line 106): Uses `today=2026-03-01, examDate=2026-03-01` → 0 days left. Should now produce **1 day** not 7. **Update assertion**: `expect(result).toHaveLength(1)` and check all are warmup.

5. **"Timeframe mode: survival — 1 day left"** (line 120): Uses `today=2026-03-01, examDate=2026-03-02` → 1 day left. Should produce **2 days** not 7. **Update assertion**: `expect(result).toHaveLength(2)` and check all are warmup.

6. **"Timeframe mode: high_intensity — 3 days left"** (line 134): Uses `today=2026-03-01, examDate=2026-03-04` → 3 days left. Should produce **4 days** not 7. **Update assertion**: `expect(result).toHaveLength(4)`. Activity types should be last 4 entries of high_intensity template: `template[3], template[4], template[5], template[6]`.

7. **"Timeframe mode: balanced — 19 days left"** (line 149): 19 days out, full 7-day window. **No change needed** — still 7 days, same template.

8. **"Consecutive dates — starting from today"** (line 266): Uses `today=2026-03-15, examDate=2026-03-25` → 10 days away, full window. **Update**: Dates should be `2026-03-19` through `2026-03-25` (exam-6..exam), not `2026-03-15` through `2026-03-21`.

9. **"Full simulation gets all topics"** (line 242): Uses balanced mode (19 days). Full window. Template unchanged. **No change needed** — full_simulation is at template[5], which maps to day index 5 in the 7-day window.

10. **"Hybrid 70/30 split"** (line 205): Uses balanced mode (19 days). Full window. **No change needed**.

11. **"Fallback: no weak topics"** (line 164) and **"Fallback: all strong topics"** (line 188): Same dates, full window, still 7 days. **No change needed**.

#### merge.spec.ts Changes

12. **baseInput** (line 22-27): Uses `today=2026-03-01, examDate=2026-03-10` → 9 days. Full 7-day window. Still produces 7 days. **No change needed**.

13. However, the test "Regeneration handles single topic" asserts `expect(day.topicIds).toContain('t1')` for all days. With exam-anchored dates, full_simulation days still get all topics. **Should still pass**.

### Tests (FAIL before step applied, PASS after)

These are the specific assertion changes. They will fail if applied without the engine change (Step 1). Since Step 1 is prerequisite, these update existing test expectations to match new behavior:

**Test**: Updated "survival 0 days" produces 1 day
- Before: `expect(result).toHaveLength(7)` → passes with old code, FAILS with new code
- After: `expect(result).toHaveLength(1)` → FAILS with old code, passes with new code

**Test**: Updated "survival 1 day" produces 2 days
- Similar pattern

**Test**: Updated "high_intensity 3 days" produces 4 days
- Activity types use `templateOffset = 7 - 4 = 3`, so `template[3], template[4], template[5], template[6]`

**Test**: Updated "consecutive dates" uses exam-anchored dates

### Acceptance Criteria
- [x] (FR-5) All existing tests pass with updated expectations
- [x] No regressions in topic assignment logic (topic tests unchanged)
- [x] merge.spec.ts continues to pass

---

## Step 4: Verify No Regressions — Run Full Test Suite
**Time estimate**: 5 minutes

### Commands to Run
```bash
pnpm vitest run tests/unit/lib/study-plan/engine.spec.ts
pnpm vitest run tests/unit/lib/study-plan/merge.spec.ts
pnpm -s tsc --noEmit
```

### Acceptance Criteria
- [x] All engine.spec.ts tests pass (both new and updated)
- [x] All merge.spec.ts tests pass
- [x] TypeScript compiles without errors
- [x] No lint errors in modified files

---

## Implementation Notes for Build Agent

### Key Design Decisions

1. **Template offset strategy**: When fewer than 7 days, use the **last N entries** of the 7-day activity template. This is critical because:
   - The 7th slot (index 6) is always `warmup` across all templates
   - This means the exam day always gets warmup, which is the intended behavior
   - For survival mode, all 7 slots are `warmup`, so offset doesn't matter

2. **`numDays` calculation**: `Math.min(7, Math.max(1, daysLeft + 1))`
   - `daysLeft + 1` because we include both today and exam day
   - `Math.max(1, ...)` handles the edge case where daysLeft = 0 (exam is today)
   - `Math.min(7, ...)` caps at 7 days

3. **`windowStart` calculation**: 
   - If `daysLeft >= 7`: `windowStart = examDate - 6` (full countdown window)
   - If `daysLeft < 7`: `windowStart = today` (partial window, can't go before today)
   - Equivalently: `windowStart = max(today, examDate - 6)`

4. **Topic assignment**: The `dayIndex` parameter to `pickTopicsForDay` should remain 0-based within the generated window (not offset by templateOffset). This preserves existing topic rotation behavior.

### Edge Cases to Handle
- `daysLeft = 0`: 1 day, survival mode, exam day only
- `daysLeft = 1`: 2 days, survival mode, warmup on both
- `daysLeft = 6`: 7 days, balanced mode, full window = today through exam
- `daysLeft = 7`: 7 days, balanced mode, window starts at exam-6 (skips today)
- `daysLeft > 7`: 7 days, balanced mode, window starts at exam-6

### What NOT to Change
- `getTimeframeMode()` — unchanged, still uses `daysUntilExam` for mode selection
- `sortTopicsByPriority()` — unchanged
- `buildTopicCycle()` — unchanged
- `pickTopicsForDay()` — unchanged
- `pickTopicsForHybrid()` — unchanged
- `constants.ts` — unchanged
- `types.ts` — unchanged
- `merge.ts` — unchanged
- API route — unchanged (already passes `today` and `examDate`)
