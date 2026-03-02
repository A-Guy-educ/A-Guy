# Gap Analysis: 260302-auto-05

## Summary

- Gaps Found: 5
- Spec Revised: Yes

## Gaps Found

### Gap 1: File Path Mismatches

**Severity:** Critical
**Location:** spec.md lines 7-11 (Technical Touchpoints)
**Issue:** The spec references incorrect file paths:
- Spec says: `src/hooks/useStudyPlan.ts`
- Actual: `src/app/(frontend)/study-plan/_components/useStudyPlan.ts`
- Spec says: `src/app/(frontend)/study-plan/StudyPlanPage.tsx`
- Actual: `src/app/(frontend)/study-plan/_components/StudyPlanPage.tsx`

**Fix Applied:** Updated spec.md with correct file paths under Technical Touchpoints section.

### Gap 2: Engine Uses Today-Based Logic Instead of Exam-Anchored

**Severity:** Critical
**Location:** `src/lib/study-plan/engine.ts` (lines 220-254)
**Issue:** The `generateStudyPlan` function currently:
1. Takes `today` as input parameter (line 221)
2. Uses `differenceInCalendarDays(examDate, today)` to calculate daysLeft (line 226)
3. Generates dates starting from `today` using `addDays(todayDate, dayIndex)` (line 239)

This directly contradicts the spec which requires:
- Always compute: `startDate = examDate - 7 days`, `endDate = examDate - 1 day`
- Example: Exam `07/03/2026` → Plan `28/02/2026` → `06/03/2026`
- Do NOT use any "today-based" calculation

**Fix Applied:** Updated spec.md to clarify:
- Add FR-EX-001: Engine must accept only examDate (not today)
- Remove `today` from GeneratePlanInput type requirement
- Use `startOfDay(normalizedExamDate)` for normalization

### Gap 3: API Route Passes Today to Engine

**Severity:** Critical
**Location:** `src/app/api/study-plan/route.ts` (line 167)
**Issue:** The API handler calculates today's date and passes it to the engine:
```typescript
const today = format(startOfDay(new Date()), 'yyyy-MM-dd')
```
This passes `today` to `generateStudyPlan()` at line 184, which defeats the exam-anchored logic.

**Fix Applied:** Updated spec.md to clarify:
- Add FR-EX-002: API route must NOT pass `today` to engine
- Engine should compute dates purely from examDate

### Gap 4: Auto-Regeneration Still Exists After Generation

**Severity:** High
**Location:** `src/app/(frontend)/study-plan/_components/StudyPlanPage.tsx` (lines 117-127)
**Issue:** The current code has an `useEffect` that auto-regenerates the plan when:
- `hasGenerated` is true
- `pendingRegeneration.current` is true
- `examDate` or `topics` change

The spec explicitly states: "Changing exam date/topics/mastery does **not** auto-regenerate"

Current problematic code:
```typescript
useEffect(() => {
  if (!hasGenerated) return
  if (!pendingRegeneration.current) return
  if (examDate && topics.length > 0) {
    const timer = setTimeout(() => {
      pendingRegeneration.current = false
      generatePlan(examDate, topics, 'default-course')
    }, 500)
    // ...
  }
}, [examDate, topics, generatePlan, hasGenerated])
```

**Fix Applied:** Updated Acceptance Criteria to clarify:
- AC-007: Changing exam date after generation does NOT auto-regenerate (must manually click button)

### Gap 5: Button Text Mismatch

**Severity:** Medium
**Location:** Translation files (`src/i18n/he.json` line 510)
**Issue:** 
- Spec says button should say: "צור תוכנית לימודים" (Create study plan)
- Current button text: "בנה תכנית מיקוד" (Build focus plan)

**Fix Applied:** Added to spec as a translation requirement (FR-UI-001).

## Changes Made to Spec

### Added Functional Requirements:

- **FR-EX-001:** Engine MUST accept only `examDate` as date input (not `today`). Compute startDate = examDate - 7 days, endDate = examDate - 1 day using only date-fns `startOfDay` and `addDays`.

- **FR-EX-002:** API route MUST NOT pass current date (`today`) to the engine. Engine computes dates purely from examDate.

- **FR-UI-001:** Button text MUST display "צור תוכנית לימודים" (Create study plan).

### Updated Technical Touchpoints:

- **useStudyPlan.ts:** Updated path to `src/app/(frontend)/study-plan/_components/useStudyPlan.ts`
- **StudyPlanPage.tsx:** Updated path to `src/app/(frontend)/study-plan/_components/StudyPlanPage.tsx`

### Updated Acceptance Criteria:

- **AC-001:** (existing) Opening the page does NOT generate a plan
- **AC-002:** (existing) Opening the page does NOT persist a new generated plan  
- **AC-003:** (existing) Clicking button generates exactly 7 days
- **AC-004:** (existing) For exam 07/03/2026: first card = 28/02/2026, last card = 06/03/2026
- **AC-005:** (existing) Refresh keeps/restores persisted plan
- **AC-006:** (existing) No timezone off-by-one errors
- **AC-007:** (clarified) Changing exam date/topics/mastery after generation does NOT auto-regenerate - user must explicitly click button again

### Added Guardrails:

- Engine must use ONLY date-fns functions: `startOfDay`, `addDays`, `format`, `parseISO`
- Engine must NOT import or use `differenceInCalendarDays` or any "today-based" logic
- API must NOT compute or pass current date to engine
