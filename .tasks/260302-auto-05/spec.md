# Study Plan Manual Generation + Exam-Anchored 7-Day Window

## Overview

Modify the study plan feature to require manual user action for generation and use exam-anchored date calculations instead of today-based logic.

## Requirements

### 1. Manual Generation Only
- Study plan must generate **only after** user clicks "צור תוכנית לימודים"
- Opening the page must NOT generate a plan
- Opening the page must NOT persist a new generated plan

### 2. Exam-Anchored 7 Full Days (Not Today-Anchored)
- Always compute: `startDate = examDate - 7 days`, `endDate = examDate - 1 day`
- Inclusive range = exactly 7 day objects
- Example: Exam `07/03/2026` → Plan `28/02/2026` → `06/03/2026`

### 3. Date Calculation Rules (date-fns only)
- Normalize exam date with `startOfDay(examDate)`
- Use `addDays(normalizedExamDate, -7)` for start
- Use `addDays(normalizedExamDate, -1)` for end
- Build exactly 7 consecutive calendar days (inclusive)
- Do NOT use any "today-based" calculation
- Do NOT compute from "days remaining"

### 4. UI Behavior
**Before button click:**
- Show empty state: "מוכנים לצאת לדרך?"
- Do not render day cards
- Do not call engine
- Do not persist generated plan

**After button click:**
- Generate plan
- Persist plan
- Render 7 cards
- Keep existing completion toggle persistence behavior

## Technical Touchpoints

### useStudyPlan.ts
- Add `hasGenerated` boolean (or derived equivalent from persisted plan presence)
- Guard generation behind explicit handler only
- Ensure refresh restores persisted plan correctly

### engine.ts
- Remove today-based logic completely
- Accept exam date input and return anchored 7-day window
- Use only: `startOfDay`, `addDays(examDate, -7)`, `addDays(examDate, -1)`

### StudyPlanPage.tsx
- Conditionally render empty state vs generated plan
- Wire CTA button to explicit generate handler

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
