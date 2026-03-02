# Implementation Plan: Study Plan Manual Generation + Exam-Anchored 7-Day Window

## Step 1: Modify engine.ts
**File:** `src/lib/study-plan/engine.ts`

1. Remove all today-based date calculation logic
2. Update the engine to accept exam date as input parameter
3. Implement exam-anchored 7-day window using date-fns:
   - Use `startOfDay(examDate)` to normalize
   - Use `addDays(normalizedExamDate, -7)` for start date
   - Use `addDays(normalizedExamDate, -1)` for end date
   - Generate exactly 7 consecutive calendar days (inclusive)
4. Ensure no timezone off-by-one errors
5. Export updated engine function

## Step 2: Modify useStudyPlan.ts
**File:** `src/app/(frontend)/study-plan/_components/useStudyPlan.ts`

1. Add `hasGenerated` state or derive from persisted plan presence
2. Guard generation behind explicit handler (not on mount)
3. Ensure refresh correctly restores persisted plan
4. Keep existing completion toggle persistence behavior
5. Remove any auto-generation logic on exam date/topics/mastery changes

## Step 3: Modify StudyPlanPage.tsx
**File:** `src/app/(frontend)/study-plan/page.tsx`

1. Implement conditional rendering:
   - Show empty state `מוכנים לצאת לדרך?` when no plan generated
   - Show 7-day cards when plan is generated
2. Wire CTA button (`צור תוכנית לימודים`) to explicit generate handler
3. Ensure changing exam date/topics/mastery does NOT auto-regenerate

## Step 4: Write Tests
**Files:** `tests/unit/lib/study-plan/engine.spec.ts` and integration tests

1. Unit test for engine date window:
   - Input: exam date `07/03/2026`
   - Expected: first day `28/02/2026`, last day `06/03/2026`
2. Hook/page test: no generation on mount
3. Hook/page test: generation only on explicit click
4. Test: changing exam date after generation does not auto-regenerate
5. Test: persisted plan survives refresh

## Verification
- Run `pnpm tsc --noEmit` to validate TypeScript
- Run test suite to verify all acceptance criteria
