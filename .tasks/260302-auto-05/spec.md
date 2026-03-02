# Study Plan Manual Trigger & Exam-Anchored Window Specification

## Overview
Modify the study plan feature to require manual trigger by user and implement exam-anchored 7-day window calculation instead of today-based logic.

## Requirements

### 1. Manual Generation Only
- Study plan must generate and persist ONLY after user clicks "צור תוכנית לימודים"
- Before button click: show empty state "מוכנים לצאת לדרך?"
- No day cards, no engine calls, no persisted plan before click

### 2. Exam-Anchored 7-Day Window
- Always compute: `startDate = examDate - 7 days`, `endDate = examDate - 1 day`
- Inclusive range = exactly 7 day objects
- Example: Exam 07/03/2026 → Plan 28/02/2026 → 06/03/2026

### 3. Implementation Rules (date-fns only)
- Normalize exam date with `startOfDay(examDate)`
- Use `addDays(normalizedExamDate, -7)` for start
- Use `addDays(normalizedExamDate, -1)` for end
- Do NOT use "today-based" calculation
- Do NOT compute from "days remaining"

### 4. UI Behavior
- Before click: Empty state, no cards, no engine call
- After click: Generate, persist, render 7 cards
- Keep existing completion toggle persistence

### 5. Technical Changes
- useStudyPlan.ts: Add `hasGenerated` boolean, guard generation behind explicit handler
- engine.ts: Remove today-based logic, accept exam date, return anchored 7-day window
- StudyPlanPage.tsx: Conditional empty state vs generated plan, wire CTA button

## Acceptance Criteria
- [ ] Opening page does NOT generate a plan
- [ ] Opening page does NOT persist a new generated plan
- [ ] Clicking "צור תוכנית לימודים" generates exactly 7 days
- [ ] For exam 07/03/2026: first card = 28/02/2026, last card = 06/03/2026
- [ ] Refresh keeps/restores persisted plan
- [ ] Changing exam date/topics/mastery does NOT auto-regenerate
- [ ] No timezone off-by-one errors
