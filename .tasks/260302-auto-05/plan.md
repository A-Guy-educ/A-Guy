# Implementation Plan

## Step 1: Modify engine.ts
- Remove all today-based date calculation logic
- Add function to compute 7-day window from exam date:
  - Normalize exam date: `startOfDay(examDate)`
  - Calculate start: `addDays(normalizedExamDate, -7)`
  - Calculate end: `addDays(normalizedExamDate, -1)`
- Return exactly 7 consecutive calendar days (inclusive)
- Export date window calculation for testing

## Step 2: Modify useStudyPlan.ts
- Add `hasGenerated` state or derive from persisted plan presence
- Guard generation behind explicit handler function
- Ensure refresh correctly restores persisted plan
- Prevent auto-regeneration on exam date/topics/mastery changes

## Step 3: Modify StudyPlanPage.tsx
- Add conditional rendering: empty state vs generated plan
- Wire "צור תוכנית לימודים" button to explicit generate handler
- Display empty state "מוכנים לצאת לדרך?" before generation
- Render 7 day cards after generation
- Maintain existing completion toggle behavior

## Step 4: Write Tests
- Unit test: engine date window for 07/03/2026 → 28/02/2026 to 06/03/2026
- Integration test: no generation on page mount
- Integration test: generation only on explicit button click
- Integration test: changing exam date after generation does not auto-regenerate
- Integration test: persisted plan survives page refresh
