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

### src/app/(frontend)/study-plan/_components/useStudyPlan.ts
- Add `hasGenerated` boolean (or derived equivalent from persisted plan presence)
- Guard generation behind explicit handler only
- Ensure refresh restores persisted plan correctly
- **DO NOT** trigger generation on mount - only on explicit user action

### src/lib/study-plan/engine.ts
- **FR-EX-001:** Remove today-based logic completely
- **FR-EX-001:** Engine MUST accept only `examDate` as date input (remove `today` parameter)
- Compute dates purely from examDate:
  - Use `startOfDay(examDate)` for normalization
  - Use `addDays(normalizedExamDate, -7)` for start
  - Use `addDays(normalizedExamDate, -1)` for end
- Build exactly 7 consecutive calendar days ending one day before exam
- **MUST NOT** use `differenceInCalendarDays` or any "days remaining" calculation

### src/app/(frontend)/study-plan/_components/StudyPlanPage.tsx
- Conditionally render empty state vs generated plan
- Wire CTA button to explicit generate handler
- **REMOVE** auto-regeneration useEffect - changing inputs after generation must NOT trigger regeneration

### src/app/api/study-plan/route.ts
- **FR-EX-002:** API route MUST NOT compute or pass current date (`today`) to engine
- Engine computes dates purely from examDate parameter

## Acceptance Criteria

- [ ] **AC-001:** Opening the page does **not** generate a plan
- [ ] **AC-002:** Opening the page does **not** persist a new generated plan
- [ ] **AC-003:** Clicking `צור תוכנית לימודים` generates exactly 7 days
- [ ] **AC-004:** For exam `07/03/2026`: first card = `28/02/2026`, last card = `06/03/2026`
- [ ] **AC-005:** Refresh keeps/restores persisted plan
- [ ] **AC-006:** Changing exam date/topics/mastery after initial generation does **NOT** auto-regenerate - user must explicitly click button again
- [ ] **AC-007:** No timezone off-by-one errors

## Functional Requirements (FR)

### FR-EX-001: Engine Exam-Anchored Date Calculation
- Engine MUST accept only `examDate` as date input (not `today`)
- Must compute: `startDate = examDate - 7 days`, `endDate = examDate - 1 day`
- Must use only: `startOfDay`, `addDays`, `format`, `parseISO` from date-fns
- Must NOT use `differenceInCalendarDays` or any "today-based" logic

### FR-EX-002: API Route Date Handling  
- API route MUST NOT compute or pass current date to engine
- Engine computes dates purely from examDate parameter

### FR-UI-001: Button Text
- Button MUST display "צור תוכנית לימודים" (Create study plan)

## Test Requirements

- [ ] **TR-001:** Unit test for engine date window (`07/03/2026` case)
- [ ] **TR-002:** Unit test: engine does NOT accept `today` parameter
- [ ] **TR-003:** Hook/page test: no generation on mount
- [ ] **TR-004:** Hook/page test: generation only on explicit click
- [ ] **TR-005:** Test: changing exam date after generation does NOT auto-regenerate
- [ ] **TR-006:** Test: changing topics after generation does NOT auto-regenerate
- [ ] **TR-007:** Test: persisted plan survives refresh
- [ ] **TR-008:** Test: API does NOT pass today to engine
