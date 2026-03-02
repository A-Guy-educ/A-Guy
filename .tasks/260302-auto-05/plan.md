# Implementation Plan: Study Plan Manual Generation + Exam-Anchored 7-Day Window

## Rerun Context

This is a rerun with no specific code-level feedback — the previous plan was high-level and lacked the detail needed by the build agent. This revision adds:
- Exact file paths and line numbers for every change
- Precise behavior contracts (function signatures, inputs/outputs)
- Concrete TDD test gates per step with file paths
- Explicit acceptance criteria checklists

## Assumptions

- `clarified.md` was not found; working from spec.md alone
- Rerun feedback contained no specific errors — assuming previous build failed due to insufficient plan detail
- Translation key `generateButton` currently reads `"בנה תכנית מיקוד"` — spec requires `"צור תוכנית לימודים"` (FR-UI-001). This will be updated.
- The `getTimeframeMode` function is still needed to select activity templates; only date-window calculation changes
- Tests run via `pnpm vitest run --config vitest.config.unit.mts`

---

## Step 1: Engine — Remove `today` Parameter, Anchor Dates to Exam Date

**Spec refs:** FR-EX-001, AC-004, AC-007, TR-001, TR-002

### Files to Touch

| File | Action | Lines |
|------|--------|-------|
| `src/lib/study-plan/types.ts` | MODIFIED | lines 32-37 |
| `src/lib/study-plan/engine.ts` | MODIFIED | lines 1, 220-253 |
| `tests/unit/lib/study-plan/engine.spec.ts` | MODIFIED | entire file |

### Exact Behavior

#### `src/lib/study-plan/types.ts` — Remove `today` from `GeneratePlanInput`

**Before:**
```typescript
export interface GeneratePlanInput {
  today: string    // YYYY-MM-DD — injected for determinism
  examDate: string // YYYY-MM-DD
  topics: TopicInput[]
  idGenerator: () => string
}
```

**After:**
```typescript
export interface GeneratePlanInput {
  examDate: string // YYYY-MM-DD
  topics: TopicInput[]
  idGenerator: () => string
}
```

- Remove the `today` field entirely from `GeneratePlanInput`
- No other type changes needed

#### `src/lib/study-plan/engine.ts` — Exam-anchored date calculation

**Import changes (line 1):**
- Remove `differenceInCalendarDays` from the import
- Add `startOfDay` to the import (from `date-fns`)
- Keep `addDays`, `format`, `parseISO`

**`generateStudyPlan` function changes (lines 220-253):**

The function MUST:
1. Accept input WITHOUT `today` parameter
2. Parse `examDate` via `parseISO(input.examDate)`
3. Normalize: `const normalizedExam = startOfDay(examDateObj)`
4. Compute `startDate = addDays(normalizedExam, -7)` 
5. Compute `endDate = addDays(normalizedExam, -1)` (for reference only)
6. Build 7 days: `for (dayIndex 0..6)` → `date = format(addDays(startDate, dayIndex), 'yyyy-MM-dd')`
7. For timeframe mode: always use `getTimeframeMode(7)` → `'balanced'` (since the 7-day window is always 7 days, timeframe mode is always balanced)

**WAIT — Spec clarification needed:** The timeframe mode was previously based on "days until exam". With the new exam-anchored model, the plan always spans exactly 7 days before the exam. The `daysLeft` concept from exam → today is removed. Since the plan is always 7 days, `getTimeframeMode(7)` → `'balanced'`. This is the correct interpretation per spec rule "Do NOT compute from days remaining".

**Implementation detail:**
```
function generateStudyPlan(input: GeneratePlanInput): StudyPlanDay[] {
  const { examDate, topics, idGenerator } = input
  const examDateObj = parseISO(examDate)
  const normalizedExam = startOfDay(examDateObj)
  const startDate = addDays(normalizedExam, -7)
  
  // Always balanced mode for 7-day exam-anchored window
  const mode = getTimeframeMode(7)  // returns 'balanced'
  const template = ACTIVITY_TEMPLATES[mode]
  
  const cycle = buildTopicCycle(topics)
  const allTopicIds = topics.map(t => t.topicId)
  
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

### Tests (TDD — write FIRST, then implement)

**File:** `tests/unit/lib/study-plan/engine.spec.ts`

All existing tests that pass `today` must be updated to remove it. Add these NEW tests:

**Test 1 (TR-001): Exam-anchored date window — 07/03/2026 case**
```
it('Exam 2026-03-07 → dates 2026-02-28 through 2026-03-06', () => {
  const result = generateStudyPlan({
    examDate: '2026-03-07',
    topics: [{ topicId: 't1', topicLabel: 'T1', mastery: 'weak' }],
    idGenerator,
  })
  expect(result).toHaveLength(7)
  expect(result[0].date).toBe('2026-02-28')
  expect(result[6].date).toBe('2026-03-06')
})
```

**Test 2 (TR-002): Engine does NOT accept `today` parameter**
```
it('GeneratePlanInput type has no today field', () => {
  // This is a compile-time check — the test is that the following compiles:
  const input: GeneratePlanInput = {
    examDate: '2026-03-07',
    topics: [{ topicId: 't1', topicLabel: 'T1', mastery: 'weak' }],
    idGenerator: () => 'id',
  }
  // @ts-expect-error — 'today' should not exist
  const bad: GeneratePlanInput = { ...input, today: '2026-03-01' }
  // Suppress unused var
  expect(bad).toBeDefined()
  
  // Also verify at runtime: no today-based behavior
  const result = generateStudyPlan(input)
  expect(result[0].date).toBe('2026-02-28') // anchored to exam, not "today"
})
```

**Test 3: Consecutive dates are anchored to examDate minus 7**
```
it('dates are consecutive and end at examDate - 1', () => {
  const result = generateStudyPlan({
    examDate: '2026-04-10',
    topics: [{ topicId: 't1', topicLabel: 'T1', mastery: 'weak' }],
    idGenerator,
  })
  expect(result[0].date).toBe('2026-04-03')
  expect(result[1].date).toBe('2026-04-04')
  expect(result[2].date).toBe('2026-04-05')
  expect(result[3].date).toBe('2026-04-06')
  expect(result[4].date).toBe('2026-04-07')
  expect(result[5].date).toBe('2026-04-08')
  expect(result[6].date).toBe('2026-04-09')
})
```

**Update ALL existing tests:** Remove `today` from every `generateStudyPlan` call. Since timeframe mode is now always `balanced`, the tests for `survival` and `high_intensity` modes via the full `generateStudyPlan` should be updated. The `getTimeframeMode` unit tests can remain (they test a standalone function), but `generateStudyPlan` tests should only validate `balanced` template behavior.

### Acceptance Criteria

- [ ] `GeneratePlanInput` has no `today` field
- [ ] `generateStudyPlan` does not import or use `differenceInCalendarDays`
- [ ] `generateStudyPlan` uses only `startOfDay`, `addDays`, `format`, `parseISO` from date-fns
- [ ] For exam `2026-03-07`: day[0].date = `2026-02-28`, day[6].date = `2026-03-06`
- [ ] Always returns exactly 7 days
- [ ] `pnpm vitest run --config vitest.config.unit.mts tests/unit/lib/study-plan/engine.spec.ts` passes

---

## Step 2: API Route — Remove `today` Computation, Pass Only `examDate`

**Spec refs:** FR-EX-002, TR-008

### Files to Touch

| File | Action | Lines |
|------|--------|-------|
| `src/app/api/study-plan/route.ts` | MODIFIED | lines 8, 166-181 |
| `tests/unit/lib/study-plan/api-route.spec.ts` | NEW |

### Exact Behavior

#### `src/app/api/study-plan/route.ts` — `handleGenerate` function

**Changes to `handleGenerate` (lines 159-239):**

1. **Remove line 167:** `const today = format(startOfDay(new Date()), 'yyyy-MM-dd')` — DELETE this line entirely
2. **Remove `startOfDay` from import on line 8** (keep `format` if used elsewhere — check: `format` is still used on line 193 for `generatedAt`, so keep it. `startOfDay` is also used on line 193 so keep it for `generatedAt` only)
3. **Update `generateInput` (lines 176-181):** Remove `today` field

**Before:**
```typescript
const generateInput = {
  today,
  examDate,
  topics: topics as TopicInput[],
  idGenerator: () => nanoid(),
}
```

**After:**
```typescript
const generateInput = {
  examDate,
  topics: topics as TopicInput[],
  idGenerator: () => nanoid(),
}
```

4. Line 193 still uses `format(startOfDay(new Date()), 'yyyy-MM-dd')` for `generatedAt` — this is fine, `generatedAt` records WHEN the plan was generated, not a date input to the engine.

### Tests (TDD)

**File:** `tests/unit/lib/study-plan/api-route.spec.ts` (NEW)

Since the API route requires Payload auth and DB, write a focused unit test that verifies the engine is called correctly:

```
describe('API route - handleGenerate', () => {
  it('TR-008: engine is called without today parameter', () => {
    // Verify by inspecting GeneratePlanInput type — 
    // if today were required, this wouldn't compile
    const input: GeneratePlanInput = {
      examDate: '2026-03-07',
      topics: [{ topicId: 't1', topicLabel: 'T1', mastery: 'weak' }],
      idGenerator: () => 'test-id',
    }
    const result = generateStudyPlan(input)
    expect(result).toHaveLength(7)
    expect(result[0].date).toBe('2026-02-28')
  })
})
```

This test validates TR-008 at the type level — since `GeneratePlanInput` no longer has `today`, the API route physically cannot pass it.

### Acceptance Criteria

- [ ] `handleGenerate` does NOT compute `new Date()` for date calculation
- [ ] `handleGenerate` does NOT pass `today` to `generateStudyPlan`
- [ ] `generatedAt` still records current date (this is metadata, not engine input)
- [ ] TypeScript compiles: `pnpm -s tsc --noEmit`

---

## Step 3: UI — Manual Generation Only, No Auto-Regeneration

**Spec refs:** AC-001, AC-002, AC-003, AC-005, AC-006, FR-UI-001, TR-003, TR-004, TR-005, TR-006, TR-007

### Files to Touch

| File | Action | Lines |
|------|--------|-------|
| `src/app/(frontend)/study-plan/_components/StudyPlanPage.tsx` | MODIFIED | lines 63-64, 80-81, 93-94, 98-99, 110-127, 163-170, 207-217 |
| `src/app/(frontend)/study-plan/_components/useStudyPlan.ts` | NO CHANGE needed |
| `src/i18n/he.json` | MODIFIED | line 510 |
| `src/i18n/en.json` | MODIFIED | line 510 |
| `tests/unit/app/study-plan/StudyPlanPage.spec.tsx` | NEW |

### Exact Behavior

#### `StudyPlanPage.tsx` Changes

**1. Remove `pendingRegeneration` ref entirely (line 64)**
Delete: `const pendingRegeneration = useRef(false)`

**2. Remove auto-regeneration useEffect (lines 117-127)**
Delete the ENTIRE `useEffect` block:
```typescript
// DELETE THIS ENTIRE BLOCK:
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

**3. Remove all `pendingRegeneration.current = true` lines:**
- Line 81 in `handleAddTopic` — DELETE
- Line 94 in `handleRemoveTopic` — DELETE
- Line 99 in `handleMasteryChange` — DELETE
- Line 166 in examDate onChange — DELETE

**4. Update examDate onChange handler (line 165-168):**
```typescript
// Before:
onChange={(e) => {
  pendingRegeneration.current = true
  setExamDate(e.target.value)
}}

// After:
onChange={(e) => setExamDate(e.target.value)}
```

**5. Remove `useRef` from imports (line 3):**
Change `import { useCallback, useEffect, useRef, useState } from 'react'`
To `import { useCallback, useEffect, useState } from 'react'`

**6. Always show generate button (lines 207-217):**
Currently the button is hidden after first generation (`!hasGenerated` guard). Change to always show it, so users can re-generate after changing inputs:

```tsx
{/* Generate Plan Button - always visible */}
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

Remove the `{!hasGenerated && (` wrapper.

**7. Keep the `hasGenerated` state (line 68)** — it's used to control empty state vs plan rendering, and is set from persisted plan on mount (line 75).

#### i18n Changes (FR-UI-001)

**`src/i18n/he.json` line 510:**
```json
"generateButton": "צור תוכנית לימודים"
```

**`src/i18n/en.json` line 510:**
```json
"generateButton": "Create Study Plan"
```

### Tests (TDD)

**File:** `tests/unit/app/study-plan/StudyPlanPage.spec.tsx` (NEW)

These tests use React Testing Library with vitest. They test the component in isolation by mocking `useStudyPlan`.

```typescript
// Setup: mock useStudyPlan hook
vi.mock('@/app/(frontend)/study-plan/_components/useStudyPlan', () => ({
  useStudyPlan: vi.fn(),
}))
// Also mock I18n provider
vi.mock('@/ui/web/providers/I18n', () => ({
  useTranslations: () => (key: string) => key,
}))
```

**Test 1 (TR-003): No generation on mount**
```
it('does not call generatePlan on mount', () => {
  const mockGeneratePlan = vi.fn()
  ;(useStudyPlan as Mock).mockReturnValue({
    plan: null,
    isLoading: false,
    error: null,
    generatePlan: mockGeneratePlan,
    toggleDayStatus: vi.fn(),
    editDay: vi.fn(),
  })
  
  render(<StudyPlanPage />)
  expect(mockGeneratePlan).not.toHaveBeenCalled()
})
```

**Test 2 (TR-004): Generation only on explicit button click**
```
it('calls generatePlan only when button is clicked', async () => {
  const mockGeneratePlan = vi.fn()
  // ... mock setup same as above
  
  render(<StudyPlanPage />)
  
  // Set exam date and add topic (needed for button to be enabled)
  // ... interact with form
  
  // Click generate button
  const button = screen.getByText('generateButton')
  await userEvent.click(button)
  
  expect(mockGeneratePlan).toHaveBeenCalledTimes(1)
})
```

**Test 3 (TR-005): Changing exam date after generation does NOT auto-regenerate**
```
it('changing exam date after generation does not auto-regenerate', async () => {
  const mockGeneratePlan = vi.fn()
  // Mock with existing plan
  ;(useStudyPlan as Mock).mockReturnValue({
    plan: { /* mock plan snapshot */ },
    isLoading: false,
    generatePlan: mockGeneratePlan,
    // ...
  })
  
  render(<StudyPlanPage />)
  
  // Change exam date
  const dateInput = screen.getByDisplayValue(/*initial date*/)
  await userEvent.clear(dateInput)
  await userEvent.type(dateInput, '2026-04-15')
  
  // Wait for potential debounce
  await new Promise(r => setTimeout(r, 600))
  
  expect(mockGeneratePlan).not.toHaveBeenCalled()
})
```

**Test 4 (TR-006): Changing topics after generation does NOT auto-regenerate**
```
it('adding a topic after generation does not auto-regenerate', async () => {
  // Similar to TR-005 but modify topics instead
  // Verify generatePlan NOT called after topic add
})
```

**Test 5 (TR-007): Persisted plan survives refresh**
```
it('renders plan from useStudyPlan when plan exists on mount', () => {
  const mockPlan = {
    courseId: 'test',
    examDate: '2026-03-07',
    generatedAt: '2026-02-28',
    topics: [{ topicId: 't1', topicLabel: 'Math', mastery: 'weak' }],
    days: [/* 7 mock days */],
  }
  
  ;(useStudyPlan as Mock).mockReturnValue({
    plan: mockPlan,
    isLoading: false,
    generatePlan: vi.fn(),
    toggleDayStatus: vi.fn(),
    editDay: vi.fn(),
  })
  
  render(<StudyPlanPage />)
  
  // Should show day cards, NOT empty state
  expect(screen.queryByText('empty.title')).not.toBeInTheDocument()
  expect(screen.getByText('scheduleTitle')).toBeInTheDocument()
})
```

**Test 6: Empty state shown before generation**
```
it('shows empty state when no plan exists', () => {
  ;(useStudyPlan as Mock).mockReturnValue({
    plan: null, isLoading: false, ...
  })
  
  render(<StudyPlanPage />)
  expect(screen.getByText('empty.title')).toBeInTheDocument()
})
```

### Acceptance Criteria

- [ ] Opening page shows empty state "מוכנים לצאת לדרך?" — no plan generated
- [ ] Opening page does NOT call the API to generate a new plan (only fetches existing)
- [ ] Clicking generate button calls `generatePlan` exactly once
- [ ] Changing exam date after generation does NOT trigger auto-regeneration
- [ ] Changing topics/mastery after generation does NOT trigger auto-regeneration
- [ ] Generate button text is "צור תוכנית לימודים" (Hebrew) / "Create Study Plan" (English)
- [ ] Generate button is always visible (so users can re-generate after changing inputs)
- [ ] Persisted plan (from GET on mount) renders day cards correctly
- [ ] `pnpm vitest run --config vitest.config.unit.mts tests/unit/app/study-plan/` passes

---

## Step 4: Final Integration Validation

**Spec refs:** All ACs

### Files to Touch

No new files — this step runs all tests and validates TypeScript compilation.

### Commands to Run

```bash
# Type check
pnpm -s tsc --noEmit

# Unit tests
pnpm vitest run --config vitest.config.unit.mts

# Generate import map (in case components changed path references)
pnpm generate:importmap
```

### Acceptance Criteria

- [ ] `tsc --noEmit` passes with zero errors
- [ ] All unit tests pass
- [ ] No `differenceInCalendarDays` usage anywhere in study-plan code
- [ ] No `today` parameter in `GeneratePlanInput` type
- [ ] No `pendingRegeneration` ref in `StudyPlanPage.tsx`
- [ ] No auto-regeneration `useEffect` in `StudyPlanPage.tsx`

---

## Summary of All Files Changed

| File | Action | Step |
|------|--------|------|
| `src/lib/study-plan/types.ts` | MODIFIED — remove `today` from `GeneratePlanInput` | 1 |
| `src/lib/study-plan/engine.ts` | MODIFIED — exam-anchored dates, remove `differenceInCalendarDays` | 1 |
| `src/app/api/study-plan/route.ts` | MODIFIED — remove `today` computation | 2 |
| `src/app/(frontend)/study-plan/_components/StudyPlanPage.tsx` | MODIFIED — remove auto-regen, always show button | 3 |
| `src/i18n/he.json` | MODIFIED — update `generateButton` text | 3 |
| `src/i18n/en.json` | MODIFIED — update `generateButton` text | 3 |
| `tests/unit/lib/study-plan/engine.spec.ts` | MODIFIED — update all tests, add exam-anchored tests | 1 |
| `tests/unit/lib/study-plan/api-route.spec.ts` | NEW — verify no today param | 2 |
| `tests/unit/app/study-plan/StudyPlanPage.spec.tsx` | NEW — UI behavior tests | 3 |

## Test Commands

```bash
# Step 1 tests
pnpm vitest run --config vitest.config.unit.mts tests/unit/lib/study-plan/engine.spec.ts

# Step 2 tests 
pnpm vitest run --config vitest.config.unit.mts tests/unit/lib/study-plan/api-route.spec.ts

# Step 3 tests
pnpm vitest run --config vitest.config.unit.mts tests/unit/app/study-plan/StudyPlanPage.spec.tsx

# All tests
pnpm vitest run --config vitest.config.unit.mts

# Type check
pnpm -s tsc --noEmit
```
