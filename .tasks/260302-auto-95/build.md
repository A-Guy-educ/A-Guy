# Build Plan: Study Plan Engine — Anchor Schedule to Exam Countdown

## Task ID: 260302-auto-95

## Summary

Modify `generateStudyPlan()` in `engine.ts` to anchor generated dates to the exam countdown window (`examDate-6` through `examDate`) instead of `today` through `today+6`. Update all affected tests.

---

## Step 1: Modify `engine.ts` — Change Date Anchoring Logic

**File**: `src/lib/study-plan/engine.ts`
**Lines**: 216-253

### What to Change

Replace the current `generateStudyPlan` function (lines 216-254) with exam-countdown anchoring:

**Current code** (lines 236-251):
```typescript
// Generate 7 days anchored to today
const days: StudyPlanDay[] = []
for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
  const date = format(addDays(todayDate, dayIndex), 'yyyy-MM-dd')
  const activityType = template[dayIndex]
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

**New code** to replace lines 236-251:
```typescript
// Calculate the exam countdown window
// Window: max(today, examDate-6) through examDate
// Number of days: min(7, daysLeft + 1) — includes both endpoints
const numDays = Math.min(7, Math.max(1, daysLeft + 1))
const windowStart = daysLeft >= 7
  ? addDays(examDateObj, -6)  // Full 7-day window ending on exam day
  : todayDate                   // Partial window starting from today

// Use the LAST numDays entries from the 7-day template
// This ensures the final day always uses template[6] (warmup)
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

Also update the JSDoc on line 217:
- **From**: `Generate a 7-day study plan anchored to today.`
- **To**: `Generate a study plan anchored to the exam countdown window (examDate-6 through examDate).`

And update the comment on line 218:
- **From**: `The daysLeft value is used only to select the activity template.`
- **To**: `The daysLeft value selects the activity template and determines the number of days.`

---

## Step 2: Update Existing Tests in `engine.spec.ts`

**File**: `tests/unit/lib/study-plan/engine.spec.ts`

### Test: "Timeframe mode: survival — 0 days left" (line 106)

Add length assertion after line 114:
```typescript
const result = generateStudyPlan(input)
expect(result).toHaveLength(1)  // ADD THIS LINE
result.forEach((day) => {
  expect(day.activityType).toBe('warmup')
})
```

### Test: "Timeframe mode: survival — 1 day left" (line 120)

Add length assertion after line 128:
```typescript
const result = generateStudyPlan(input)
expect(result).toHaveLength(2)  // ADD THIS LINE
result.forEach((day) => {
  expect(day.activityType).toBe('warmup')
})
```

### Test: "Timeframe mode: high_intensity — 3 days left" (line 134)

Replace lines 142-146 with:
```typescript
const result = generateStudyPlan(input)
expect(result).toHaveLength(4) // 3 daysLeft + 1 = 4 days

// Uses last 4 entries of high_intensity template (offset=3)
// template[3]=full_simulation, template[4]=reinforcement, template[5]=practice, template[6]=warmup
const expected = ACTIVITY_TEMPLATES.high_intensity
const templateOffset = 7 - 4
result.forEach((day, idx) => {
  expect(day.activityType).toBe(expected[templateOffset + idx])
})
```

### Test: "Consecutive dates — starting from today" (line 266)

Replace entire test (lines 266-283) with:
```typescript
it('Consecutive dates — anchored to exam countdown', () => {
  const input = {
    today: '2026-03-15',
    examDate: '2026-03-25',
    topics: [{ topicId: 't1', topicLabel: 'Topic 1', mastery: 'weak' as const }],
    idGenerator,
  }

  const result = generateStudyPlan(input)
  expect(result).toHaveLength(7)

  // Window: examDate-6 (2026-03-19) through examDate (2026-03-25)
  for (let i = 0; i < 7; i++) {
    const expectedDate = new Date('2026-03-19')
    expectedDate.setDate(expectedDate.getDate() + i)
    const expectedDateStr = expectedDate.toISOString().split('T')[0]

    expect(result[i].date).toBe(expectedDateStr)
  }
})
```

---

## Step 3: Add New Scenario Tests in `engine.spec.ts`

**File**: `tests/unit/lib/study-plan/engine.spec.ts`

Add a new `describe('exam countdown anchoring')` block inside `describe('generateStudyPlan')`, before the closing `})` of the generateStudyPlan describe block:

```typescript
describe('exam countdown anchoring', () => {
  it('10-day scenario — 7 days ending on examDate', () => {
    const input = {
      today: '2026-03-10',
      examDate: '2026-03-20',
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

  it('7-day scenario — today is exactly exam-6', () => {
    const input = {
      today: '2026-03-14',
      examDate: '2026-03-20',
      topics: [{ topicId: 't1', topicLabel: 'T1', mastery: 'weak' as const }],
      idGenerator,
    }
    const result = generateStudyPlan(input)
    expect(result).toHaveLength(7)
    expect(result[0].date).toBe('2026-03-14')
    expect(result[6].date).toBe('2026-03-20')
  })

  it('5-day scenario — 5 days ending on examDate', () => {
    const input = {
      today: '2026-03-16',
      examDate: '2026-03-20',
      topics: [{ topicId: 't1', topicLabel: 'T1', mastery: 'weak' as const }],
      idGenerator,
    }
    const result = generateStudyPlan(input)
    expect(result).toHaveLength(5)
    expect(result[0].date).toBe('2026-03-16')
    expect(result[4].date).toBe('2026-03-20')
  })

  it('2-day scenario — survival mode warmup on all days', () => {
    const input = {
      today: '2026-03-19',
      examDate: '2026-03-20',
      topics: [{ topicId: 't1', topicLabel: 'T1', mastery: 'weak' as const }],
      idGenerator,
    }
    const result = generateStudyPlan(input)
    expect(result).toHaveLength(2)
    expect(result[0].date).toBe('2026-03-19')
    expect(result[1].date).toBe('2026-03-20')
    result.forEach((day) => {
      expect(day.activityType).toBe('warmup')
    })
  })

  it('1-day scenario — exam is today, single warmup day', () => {
    const input = {
      today: '2026-03-20',
      examDate: '2026-03-20',
      topics: [{ topicId: 't1', topicLabel: 'T1', mastery: 'weak' as const }],
      idGenerator,
    }
    const result = generateStudyPlan(input)
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2026-03-20')
    expect(result[0].activityType).toBe('warmup')
  })

  it('daysUntilExam = 1 produces warmup (survival) mode', () => {
    const input = {
      today: '2026-03-19',
      examDate: '2026-03-20',
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
})
```

---

## Step 4: Verify `merge.spec.ts` Needs No Changes

**File**: `tests/unit/lib/study-plan/merge.spec.ts`

The `baseInput` uses `today: '2026-03-01', examDate: '2026-03-10'` (9 days left). After the change:
- `numDays = min(7, max(1, 10)) = 7` — still 7 days
- `windowStart = addDays(examDateObj, -6) = 2026-03-04` — dates shifted but tests don't assert specific dates
- Template: full balanced (offset=0)

**No changes needed.** All assertions pass because:
1. Length is still 7 (9 daysLeft >= 7 → full window)
2. Status assertions check `'planned'` — unchanged
3. Topic assertions don't depend on dates
4. Single-topic test: `full_simulation` returns all topics (includes `t1`), other activities use cycle with only `t1` → all days contain `t1`
5. Activity type variety assertion still holds (balanced has multiple types)
6. Empty topics test: still 7 days, all `'planned'` status

---

## Step 5: Run Validation

```bash
# Run study plan tests
pnpm vitest run tests/unit/lib/study-plan/engine.spec.ts
pnpm vitest run tests/unit/lib/study-plan/merge.spec.ts

# TypeScript check
pnpm -s tsc --noEmit

# Lint
pnpm lint
```

---

## Files Modified Summary

| File | Action | Description |
|---|---|---|
| `src/lib/study-plan/engine.ts` | MODIFIED | Change date anchoring from today-based to exam-countdown-based (lines 216-253) |
| `tests/unit/lib/study-plan/engine.spec.ts` | MODIFIED | Update 4 existing tests + add 6 new scenario tests |
| `tests/unit/lib/study-plan/merge.spec.ts` | NO CHANGE | Existing tests pass without modification |

## Key Design Decisions

1. **Template offset**: `templateOffset = 7 - numDays` ensures the last day always uses `template[6]` (warmup), regardless of how many days are generated.
2. **`numDays` formula**: `Math.min(7, Math.max(1, daysLeft + 1))` handles all edge cases:
   - `daysLeft=0` -> 1 day (exam today)
   - `daysLeft=1` -> 2 days (survival)
   - `daysLeft=6` -> 7 days (full window, today = exam-6)
   - `daysLeft>=7` -> 7 days (capped)
3. **`windowStart`**: `daysLeft >= 7 ? addDays(examDateObj, -6) : todayDate` — equivalent to `max(today, examDate-6)`.
4. **Topic assignment**: `dayIndex` stays 0-based within the generated window. `pickTopicsForDay(cycle, dayIndex, ...)` preserves existing topic rotation behavior.
5. **No changes to**: `getTimeframeMode`, `sortTopicsByPriority`, `buildTopicCycle`, `pickTopicsForDay`, `pickTopicsForHybrid`, `constants.ts`, `types.ts`, `merge.ts`, API route.

## Acceptance Criteria Mapping

- [x] FR-1: Dates anchored to exam countdown, not today
- [x] FR-2: Target window is examDate-6 through examDate (7 days max)
- [x] FR-3: Partial window when fewer than 7 days available
- [x] FR-4: daysUntilExam=1 produces warmup (survival) mode
- [x] FR-5: No regression — existing tests updated to match new behavior, merge tests untouched
