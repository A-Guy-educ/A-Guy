# Task

## Issue Title

[2603--auto-667] study-plan: manual trigger generation + exam-anchored 7-day window Description
Context
`https://dev.aguy.co.il/study-plan` currently generates too eagerly and/or may rely on today-based logic.  
We need strict, deterministic behavior tied only to explicit user action and exam date.
 Goal
Implement two strict behavioral changes:
1. **Manual generation only**
   The study plan must generate and persist **only after** user clicks:
   `צור תוכנית לימודים`
2. **Exam-anchored 7 full days (not today-anchored)**
   Always compute:
   - `startDate = examDate - 7 days`
   - `endDate = examDate - 1 day`
   Inclusive range = exactly 7 day objects.
Example:
- Exam: `07/03/2026`
- Plan: `28/02/2026` → `06/03/2026`
---
 Required Logic
Use **date-fns only**.
Implementation rules:
- Normalize exam date with `startOfDay(examDate)`
- Use `addDays(normalizedExamDate, -7)` for start
- Use `addDays(normalizedExamDate, -1)` for end
- Build exactly 7 consecutive calendar days (inclusive)
- Do **not** use any “today-based” calculation
- Do **not** compute from “days remaining”
Engine must be 100% anchored to `examDate`.
---
 UI Behavior
 Before button click
- Show empty state: `מוכנים לצאת לדרך?`
- Do not render day cards
- Do not call engine
- Do not persist generated plan
 After button click
- Generate plan
- Persist plan
- Render 7 cards
- Keep existing completion toggle persistence behavior
---
 Technical Touchpoints
 `useStudyPlan.ts`
- Add `hasGenerated` boolean (or derived equivalent from persisted plan presence)
- Guard generation behind explicit handler only
- Ensure refresh restores persisted plan correctly
 `engine.ts`
- Remove today-based logic completely
- Accept exam date input and return anchored 7-day window
- Use only:
  - `startOfDay`
  - `addDays(examDate, -7)`
  - `addDays(examDate, -1)`
 `StudyPlanPage.tsx`
- Conditionally render empty state vs generated plan
- Wire CTA button to explicit generate handler
---
 Acceptance Criteria
- [ ] Opening the page does **not** generate a plan
- [ ] Opening the page does **not** persist a new generated plan
- [ ] Clicking `צור תוכנית לימודים` generates exactly 7 days
- [ ] For exam `07/03/2026`: first card = `28/02/2026`, last card = `06/03/2026`
- [ ] Refresh keeps/restores persisted plan
- [ ] Changing exam date/topics/mastery does **not** auto-regenerate
- [ ] No timezone off-by-one errors
---
 Test Requirements
- [ ] Unit test for engine date window (`07/03/2026` case)
- [ ] Hook/page test: no generation on mount
- [ ] Hook/page test: generation only on explicit click
- [ ] Test: changing exam date after generation does not auto-regenerate
- [ ] Test: persisted plan survives refresh
