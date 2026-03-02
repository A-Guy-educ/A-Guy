# Build Plan: Study Plan Manual Generation + Exam-Anchored 7-Day Window

## Task ID: 260302-auto-05

## Overview

Three core changes:
1. **Engine**: Remove `today` parameter, anchor all dates to `examDate - 7` through `examDate - 1`
2. **API Route**: Stop computing/passing `today` to engine
3. **UI**: Remove auto-regeneration, always show generate button, update button text

## Pre-Implementation Checks

```bash
pnpm vitest run --config vitest.config.unit.mts tests/unit/lib/study-plan/
pnpm -s tsc --noEmit
```

---

## Step 1: Engine — Remove `today`, Anchor Dates to Exam Date

### 1.1 Modify `src/lib/study-plan/types.ts`

**Remove `today` from `GeneratePlanInput` (lines 32-37):**

```
OLD (lines 32-37):
export interface GeneratePlanInput {
  today: string    // YYYY-MM-DD — injected for determinism
  examDate: string // YYYY-MM-DD
  topics: TopicInput[]
  idGenerator: () => string // nanoid injected for testability
}

NEW:
export interface GeneratePlanInput {
  examDate: string // YYYY-MM-DD
  topics: TopicInput[]
  idGenerator: () => string // nanoid injected for testability
}
```

### 1.2 Modify `src/lib/study-plan/engine.ts`

**Change imports (line 1):**

```
OLD:
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'

NEW:
import { addDays, format, parseISO, startOfDay } from 'date-fns'
```

**Rewrite `generateStudyPlan` function (lines 216-254):**

```
OLD (lines 216-254):
/**
 * Generate a 7-day study plan anchored to today.
 * The daysLeft value is used only to select the activity template.
 */
export function generateStudyPlan(input: GeneratePlanInput): StudyPlanDay[] {
  const { today, examDate, topics, idGenerator } = input

  const todayDate = parseISO(today)
  const examDateObj = parseISO(examDate)
  const daysLeft = differenceInCalendarDays(examDateObj, todayDate)

  const mode = getTimeframeMode(daysLeft)
  const template = ACTIVITY_TEMPLATES[mode]

  const cycle = buildTopicCycle(topics)
  const allTopicIds = topics.map((t) => t.topicId)

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

  return days
}

NEW:
/**
 * Generate a 7-day study plan anchored to exam date.
 * Always produces exactly 7 days: examDate - 7 through examDate - 1.
 */
export function generateStudyPlan(input: GeneratePlanInput): StudyPlanDay[] {
  const { examDate, topics, idGenerator } = input

  const examDateObj = parseISO(examDate)
  const normalizedExam = startOfDay(examDateObj)
  const startDate = addDays(normalizedExam, -7)

  // 7-day window always uses balanced mode
  const mode = getTimeframeMode(7)
  const template = ACTIVITY_TEMPLATES[mode]

  const cycle = buildTopicCycle(topics)
  const allTopicIds = topics.map((t) => t.topicId)

  const days: StudyPlanDay[] = []
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const date = format(addDays(startDate, dayIndex), 'yyyy-MM-dd')
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

  return days
}
```

**Key changes:**
- Remove `differenceInCalendarDays` import, add `startOfDay`
- Remove `today` destructure; use only `examDate`
- Normalize exam date: `startOfDay(parseISO(examDate))`
- Compute `startDate = addDays(normalizedExam, -7)`
- Dates generated from `startDate + dayIndex` instead of `todayDate + dayIndex`
- Always use `getTimeframeMode(7)` → `'balanced'` since the 7-day window is fixed

### 1.3 Update `tests/unit/lib/study-plan/engine.spec.ts`

**Full rewrite of `generateStudyPlan` describe block.** All test inputs must remove `today`. Key changes:

1. **Remove `today` from every test input** — every `generateStudyPlan({...})` call.

2. **Replace survival/high_intensity mode tests (lines 106-162)** with a single test proving balanced is always used:

```typescript
it('Always uses balanced template regardless of exam proximity', () => {
  const result = generateStudyPlan({
    examDate: '2026-03-02',
    topics: [{ topicId: 't1', topicLabel: 'Topic 1', mastery: 'weak' as const }],
    idGenerator,
  })
  const expected = ACTIVITY_TEMPLATES.balanced
  result.forEach((day, idx) => {
    expect(day.activityType).toBe(expected[idx])
  })
})
```

3. **Update "Consecutive dates" test (lines 266-283)** — anchor to examDate:

```typescript
it('Consecutive dates — anchored to examDate minus 7', () => {
  const result = generateStudyPlan({
    examDate: '2026-03-25',
    topics: [{ topicId: 't1', topicLabel: 'Topic 1', mastery: 'weak' as const }],
    idGenerator,
  })
  expect(result[0].date).toBe('2026-03-18')
  expect(result[1].date).toBe('2026-03-19')
  expect(result[2].date).toBe('2026-03-20')
  expect(result[3].date).toBe('2026-03-21')
  expect(result[4].date).toBe('2026-03-22')
  expect(result[5].date).toBe('2026-03-23')
  expect(result[6].date).toBe('2026-03-24')
})
```

4. **Add NEW tests (TR-001, TR-002):**

```typescript
it('TR-001: Exam 2026-03-07 → dates 2026-02-28 through 2026-03-06', () => {
  const result = generateStudyPlan({
    examDate: '2026-03-07',
    topics: [{ topicId: 't1', topicLabel: 'T1', mastery: 'weak' as const }],
    idGenerator,
  })
  expect(result).toHaveLength(7)
  expect(result[0].date).toBe('2026-02-28')
  expect(result[6].date).toBe('2026-03-06')
})

it('TR-002: GeneratePlanInput has no today field', () => {
  const input: GeneratePlanInput = {
    examDate: '2026-03-07',
    topics: [{ topicId: 't1', topicLabel: 'T1', mastery: 'weak' as const }],
    idGenerator: () => 'id',
  }
  // @ts-expect-error — 'today' should not exist on GeneratePlanInput
  void ({ ...input, today: '2026-03-01' } satisfies GeneratePlanInput)

  const result = generateStudyPlan(input)
  expect(result[0].date).toBe('2026-02-28')
})
```

5. **Import `GeneratePlanInput` type** — add to existing imports on line 5:

```
OLD:
import type { TopicInput } from '@/lib/study-plan/types'

NEW:
import type { GeneratePlanInput, TopicInput } from '@/lib/study-plan/types'
```

6. **Keep the `getTimeframeMode` tests unchanged** (lines 8-32) — they test the standalone function.

7. **Update "balanced — 19 days left" test** — remove `today`, just test with an examDate far in future:

```typescript
it('Timeframe mode: always balanced in generated plan', () => {
  const result = generateStudyPlan({
    examDate: '2026-03-20',
    topics: [{ topicId: 't1', topicLabel: 'Topic 1', mastery: 'weak' as const }],
    idGenerator,
  })
  const expected = ACTIVITY_TEMPLATES.balanced
  result.forEach((day, idx) => {
    expect(day.activityType).toBe(expected[idx])
  })
})
```

### 1.4 Update `tests/unit/lib/study-plan/merge.spec.ts`

**Remove `today` from `baseInput` (lines 22-27):**

```
OLD:
const baseInput = {
  today: '2026-03-01',
  examDate: '2026-03-10',
  topics: baseTopics,
  idGenerator,
}

NEW:
const baseInput = {
  examDate: '2026-03-10',
  topics: baseTopics,
  idGenerator,
}
```

### 1.5 Verify Step 1

```bash
pnpm vitest run --config vitest.config.unit.mts tests/unit/lib/study-plan/engine.spec.ts
pnpm vitest run --config vitest.config.unit.mts tests/unit/lib/study-plan/merge.spec.ts
pnpm -s tsc --noEmit
```

---

## Step 2: API Route — Remove `today` Computation

### 2.1 Modify `src/app/api/study-plan/route.ts`

**Delete lines 166-167 (today computation):**

```
DELETE:
  // Get today in YYYY-MM-DD format
  const today = format(startOfDay(new Date()), 'yyyy-MM-dd')
```

**Update generateInput (lines 176-181) — remove `today`:**

```
OLD:
  const generateInput = {
    today,
    examDate,
    topics: topics as TopicInput[],
    idGenerator: () => nanoid(),
  }

NEW:
  const generateInput = {
    examDate,
    topics: topics as TopicInput[],
    idGenerator: () => nanoid(),
  }
```

**Import changes (line 8):**
- `startOfDay` is still used on line 193 for `generatedAt`, so KEEP it
- `format` is still used on line 193, so KEEP it
- No import changes needed

### 2.2 Verify Step 2

```bash
pnpm -s tsc --noEmit
```

---

## Step 3: UI — Manual Generation Only, No Auto-Regeneration

### 3.1 Modify `src/app/(frontend)/study-plan/_components/StudyPlanPage.tsx`

**Change 1: Remove `useRef` from imports (line 5):**

```
OLD:
import { useCallback, useEffect, useRef, useState } from 'react'

NEW:
import { useCallback, useEffect, useState } from 'react'
```

**Change 2: Remove `pendingRegeneration` ref (line 64):**

```
DELETE line 64:
  const pendingRegeneration = useRef(false)
```

**Change 3: Remove `pendingRegeneration.current = true` from `handleAddTopic` (line 81):**

```
OLD (lines 79-91):
  const handleAddTopic = useCallback(() => {
    if (!newTopic.trim()) return
    pendingRegeneration.current = true

    const topic: TopicInput = {
      ...

NEW:
  const handleAddTopic = useCallback(() => {
    if (!newTopic.trim()) return

    const topic: TopicInput = {
      ...
```

**Change 4: Remove `pendingRegeneration.current = true` from `handleRemoveTopic` (line 94):**

```
OLD (lines 93-96):
  const handleRemoveTopic = useCallback((topicId: string) => {
    pendingRegeneration.current = true
    setTopics((prev) => prev.filter((t) => t.topicId !== topicId))
  }, [])

NEW:
  const handleRemoveTopic = useCallback((topicId: string) => {
    setTopics((prev) => prev.filter((t) => t.topicId !== topicId))
  }, [])
```

**Change 5: Remove `pendingRegeneration.current = true` from `handleMasteryChange` (line 99):**

```
OLD (lines 98-101):
  const handleMasteryChange = useCallback((topicId: string, mastery: MasteryLevel) => {
    pendingRegeneration.current = true
    setTopics((prev) => prev.map((t) => (t.topicId === topicId ? { ...t, mastery } : t)))
  }, [])

NEW:
  const handleMasteryChange = useCallback((topicId: string, mastery: MasteryLevel) => {
    setTopics((prev) => prev.map((t) => (t.topicId === topicId ? { ...t, mastery } : t)))
  }, [])
```

**Change 6: Delete the entire auto-regeneration useEffect (lines 116-127):**

```
DELETE lines 116-127:
  // Auto-regenerate plan only after initial explicit generation
  useEffect(() => {
    if (!hasGenerated) return
    if (!pendingRegeneration.current) return
    if (examDate && topics.length > 0) {
      const timer = setTimeout(() => {
        pendingRegeneration.current = false
        generatePlan(examDate, topics, 'default-course')
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [examDate, topics, generatePlan, hasGenerated])
```

**Change 7: Simplify examDate onChange (lines 165-168):**

```
OLD:
                onChange={(e) => {
                  pendingRegeneration.current = true
                  setExamDate(e.target.value)
                }}

NEW:
                onChange={(e) => setExamDate(e.target.value)}
```

**Change 8: Always show generate button (lines 207-217) — remove `!hasGenerated` wrapper:**

```
OLD:
            {!hasGenerated && (
              <Button
                onClick={handleGeneratePlan}
                disabled={!examDate || topics.length === 0 || isLoading}
                size="lg"
                className="w-full"
              >
                <Zap className="w-5 h-5 me-2" />
                {t('generateButton')}
              </Button>
            )}

NEW:
            <Button
              onClick={handleGeneratePlan}
              disabled={!examDate || topics.length === 0 || isLoading}
              size="lg"
              className="w-full"
            >
              <Zap className="w-5 h-5 me-2" />
              {t('generateButton')}
            </Button>
```

### 3.2 Update i18n — Button Text (FR-UI-001)

**`src/i18n/he.json` — find and replace `generateButton` value:**

```
OLD:
"generateButton": "בנה תכנית מיקוד"

NEW:
"generateButton": "צור תוכנית לימודים"
```

**`src/i18n/en.json` — find and replace `generateButton` value:**

```
OLD:
"generateButton": "Build Focus Plan"

NEW:
"generateButton": "Create Study Plan"
```

### 3.3 Verify Step 3

```bash
pnpm -s tsc --noEmit
```

---

## Step 4: Final Validation

```bash
# Type check
pnpm -s tsc --noEmit

# All unit tests
pnpm vitest run --config vitest.config.unit.mts

# Generate import map (safety check)
pnpm generate:importmap

# Lint check
pnpm -s lint
```

### Final Acceptance Criteria Checklist

- [ ] **AC-001:** Opening page shows empty state, no plan generated
- [ ] **AC-002:** Opening page does NOT persist a new plan (only fetches existing)
- [ ] **AC-003:** Clicking "צור תוכנית לימודים" generates exactly 7 days
- [ ] **AC-004:** For exam `2026-03-07`: first card = `2026-02-28`, last card = `2026-03-06`
- [ ] **AC-005:** Refresh restores persisted plan (useStudyPlan fetches on mount)
- [ ] **AC-006:** Changing exam date/topics/mastery after generation does NOT auto-regenerate
- [ ] **AC-007:** No timezone off-by-one errors (startOfDay normalization)
- [ ] `GeneratePlanInput` has no `today` field
- [ ] `generateStudyPlan` does not import `differenceInCalendarDays`
- [ ] No `pendingRegeneration` ref in `StudyPlanPage.tsx`
- [ ] No auto-regeneration `useEffect` in `StudyPlanPage.tsx`
- [ ] Generate button always visible (not gated by `!hasGenerated`)
- [ ] Button text: Hebrew = "צור תוכנית לימודים", English = "Create Study Plan"
- [ ] All unit tests pass
- [ ] TypeScript compiles cleanly

---

## Files Changed Summary

| # | File | Action |
|---|------|--------|
| 1 | `src/lib/study-plan/types.ts` | MODIFY — remove `today` from `GeneratePlanInput` |
| 2 | `src/lib/study-plan/engine.ts` | MODIFY — exam-anchored dates, remove `differenceInCalendarDays`, add `startOfDay` |
| 3 | `src/app/api/study-plan/route.ts` | MODIFY — remove `today` computation and from generateInput |
| 4 | `src/app/(frontend)/study-plan/_components/StudyPlanPage.tsx` | MODIFY — remove auto-regen, remove useRef, always show button |
| 5 | `src/i18n/he.json` | MODIFY — update `generateButton` text |
| 6 | `src/i18n/en.json` | MODIFY — update `generateButton` text |
| 7 | `tests/unit/lib/study-plan/engine.spec.ts` | MODIFY — remove `today` from all tests, add TR-001/TR-002, update date assertions |
| 8 | `tests/unit/lib/study-plan/merge.spec.ts` | MODIFY — remove `today` from `baseInput` |

**No new files created.** All changes are modifications to existing files.
