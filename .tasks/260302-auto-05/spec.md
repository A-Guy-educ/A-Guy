# Study Plan Manual Generation + Exam-Anchored 7-Day Window

## Overview

Modify the study plan feature at `https://dev.aguy.co.il/study-plan` to require manual user trigger for generation and use exam-anchored 7-day date window instead of today-based logic.

## Requirements

### 1. Manual Generation Only
- The study plan must generate and persist **only after** user clicks: `צור תוכנית לימודים`
- Before button click: show empty state `מוכנים לצאת לדרך?`
- Do not render day cards before generation
- Do not call engine before button click
- Do not persist generated plan before button click

### 2. Exam-Anchored 7 Full Days (Not Today-Anchored)
Always compute:
- `startDate = examDate - 7 days`
- `endDate = examDate - 1 day`
- Inclusive range = exactly 7 day objects

**Example:**
- Exam: `07/03/2026`
- Plan: `28/02/2026` → `06/03/2026`

### 3. Date Calculation Logic
Use **date-fns only**:
- Normalize exam date with `startOfDay(examDate)`
- Use `addDays(normalizedExamDate, -7)` for start
- Use `addDays(normalizedExamDate, -1)` for end
- Build exactly 7 consecutive calendar days (inclusive)
- Do **not** use any "today-based" calculation
- Do **not** compute from "days remaining"
- Engine must be 100% anchored to `examDate`

### 4. UI Behavior
**Before button click:**
- Show empty state: `מוכנים לצאת לדרך?`
- Do not render day cards
- Do not call engine
- Do not persist generated plan

**After button click:**
- Generate plan
- Persist plan
- Render 7 cards
- Keep existing completion toggle persistence behavior

### 5. Technical Touchpoints

**useStudyPlan.ts:**
- Add `hasGenerated` boolean (or derived equivalent from persisted plan presence)
- Guard generation behind explicit handler only
- Ensure refresh restores persisted plan correctly

**engine.ts:**
- Remove today-based logic completely
- Accept exam date input and return anchored 7-day window
- Use only:
  - `startOfDay`
  - `addDays(examDate, -7)`
  - `addDays(examDate, -1)`

**StudyPlanPage.tsx:**
- Conditionally render empty state vs generated plan
- Wire CTA button to explicit generate handler

### 6. No Auto-Regeneration
- Changing exam date after generation does **not** auto-regenerate
- Changing topics after generation does **not** auto-regenerate
- Changing mastery after generation does **not** auto-regenerate

## Acceptance Criteria

- [ ] Opening the page does **not** generate a plan
- [ ] Opening the page does **not** persist a new generated plan
- [ ] Clicking `צור תוכנית לימודים` generates exactly 7 days
- [ ] For exam `07/03/2026`: first card = `28/02/2026`, last card = `06/03/2026`
- [ ] Refresh keeps/restores persisted plan
- [ ] Changing exam date/topics/mastery does **not** auto-regenerate
- [ ] No timezone off-by-one errors

## Test Requirements

- [ ] Unit test for engine date window (`07/03/2026` case)
- [ ] Hook/page test: no generation on mount
- [ ] Hook/page test: generation only on explicit click
- [ ] Test: changing exam date after generation does not auto-regenerate
- [ ] Test: persisted plan survives refresh
