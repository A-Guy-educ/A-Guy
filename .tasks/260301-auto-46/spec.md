# Study Plan - Adaptive Practice Schedule Specification

## Overview

Implement an adaptive study plan system that generates personalized 7-day practice schedules based on:
- Days until exam
- Topic mastery levels (Weak/Medium/Strong)
- Activity mix based on proximity to exam date

The system must be manually triggered (not automatic), support completion tracking with persistence, and follow the design mandate: mirror `test plan.html` (Tailwind, Assistant font, RTL, Lucide icons).

---

## Requirements

### A) Manual Trigger (Critical)

- **Empty State**: Before generating, show "מוכנים לצאת לדרך?" (Hebrew) / "Generate Example Plan" (English)
- **CTA Button**: 
  - HE: `צור תוכנית לימודים`
  - EN: `Generate Example Plan`
- **Behavior**: 
  - Must NOT compute or persist on mount or field changes
  - Only after clicking: compute → persist → render 7-day schedule

### B) Topics Manager (Hard Limit = 10)

- Student can add up to **10 topics** maximum
- Hard limit: 11th topic blocked with error message
- Mastery levels with colors:
  - Weak: `red-500`
  - Medium: `orange-400`
  - Strong: `emerald-500`

### C) Schedule Layout

- Vertical timeline of day cards
- Each day card includes:
  - Weekday + date UI
  - Mode badge (Standard / High Intensity / Simulation / Warm-up)
  - Task list (what to do)
  - Completion toggle (checkmark)

### D) Completion Tracking

- Checkmark button per day
- Completed day: `opacity-50` and/or "בוצע" badge
- Persist to UserProgress collection
- Must survive page refresh

---

## Core Engine Logic

### Scope: Always Show Last 7 Days

```
planDaysCount = min(7, daysAvailable)
```
- If exam is 12 days away → show only last 7 days

### Topics Per Day (Locked)

```
topicsPerDay = ceil(totalTopics / planDaysCount)
```

### Rotation (Locked)

Round-robin with category fallback:
1. Weak topics first
2. If empty → Medium topics
3. If empty → Strong topics
- Within category: do not repeat until others covered

### Activity Mix by Days Until Exam (Locked)

| daysUntilExam | Mode           | Tasks                                                                 |
|---------------|----------------|-----------------------------------------------------------------------|
| 1             | Warm-up        | 1 Weak topic + formulas/key notes (no full simulation)             |
| 2             | Simulation     | Full simulation + mistake analysis (+ optional quick Weak drill)  |
| 3–5           | High Intensity | Weak focus + targeted drills + optional mini simulation/question set|
| 6–7           | Standard       | topicsPerDay topics: Learning + Drills per topic                    |

### Edge Cases

- `daysAvailable <= 0` → show error card: "תאריך הבחינה חייב להיות בעתיד"
- No topics → remain in empty/CTA state
- Only 1 topic → still generate; rotation degenerates to same topic

### Regenerate Behavior (Locked)

- Clicking Generate again overwrites plan (recompute + persist)
- Completion retention: keep by Topic ID when same topic appears again

---

## Technical Implementation

### Files to Modify

1. **src/lib/study-plan/engine.ts**
   - Implement adaptive scaling + rotation + topicsPerDay + daily modes

2. **src/app/(frontend)/study-plan/_components/useStudyPlan.ts**
   - Manage `hasGenerated` state
   - Handle Generate click → compute + persist
   - Handle regenerate semantics
   - Load persisted plan + completion states

3. **src/app/(frontend)/study-plan/_components/DayCard.tsx**
   - Completion toggle UI + dim/badge
   - Render tasks per mode as returned by engine

### Date Handling

- Use `date-fns` only for day-diff calculations
- Avoid timezone/DST issues

### Styling

- Tailwind only
- Assistant font (300–800)
- Full RTL support
- Lucide icons
- Slate/Indigo palette like demo

---

## Acceptance Criteria

- [ ] Plan does not generate before clicking Generate
- [ ] Clear behavioral difference between 2-day and longer scenarios (within 7-day window)
- [ ] Each day shows specific topics + specific practice tasks
- [ ] Mark-as-complete persists after refresh
- [ ] UI is fully RTL and visually aligned with demo
- [ ] `daysUntilExam = 1` produces Warm-up (no full study day)

---

## Definition of Done

PR includes:
- Working adaptive engine implementation
- Explicit generate trigger + correct empty state
- Completion persistence
- Minimal unit tests for engine (2-day, 5-day, 7-day scenarios with varying topic mixes)
