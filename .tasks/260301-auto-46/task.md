# Task

## Issue Title

[2603--auto-XX] Adaptive Practice Schedule — Implementation Task
## Execution Contract (Routing Guard)

* **Intent:** IMPLEMENTATION (not spec-only).
* **Expected task_type:** implement_feature.
* **Expected pipeline:** spec_execute_verify (full fix with code changes).
* **Deliverable:** merged production code changes + tests (not planning/docs only).

This task requires real production code changes in the listed files.
Do NOT classify as `spec_only`.
Pipeline must execute full implementation stages and produce working code + tests.

---

## Goal

Fix critical bugs + implement missing functionality so the Study Plan:

1. Does **not generate automatically** (only on explicit button click).
2. Generates a **dynamic** plan based on **days until exam** and **topic mastery**.
3. Shows **specific topics per day** and **what to practice** (activity mix).
4. Supports **mark day as complete** with **persistence**.

Design mandate: Mirror `test plan.html` (Tailwind, Assistant font, RTL, Lucide icons, same spacing/cards/vibe).

---

## UX / UI Requirements

### A) Manual Trigger (Critical)

* Before generating: show Empty State: "מוכנים לצאת לדרך?".
* Add CTA button:

  * HE: `צור תוכנית לימודים`
  * EN: `Generate Example Plan`
* Must NOT compute or persist the schedule on mount or on field changes.
* Only after clicking the button:

  * compute plan
  * persist plan
  * render the 7-day schedule view

### B) Topics Manager (Hard Limit = 10)

* Student can add up to **10 topics**.
* Hard limit: attempting to add an 11th topic is blocked and shows a small error/help message.
* Each topic has mastery level: Weak / Medium / Strong with colors:

  * Weak: red-500
  * Medium: orange-400
  * Strong: emerald-500

### C) Schedule Layout

* Vertical timeline of day cards.
* Each day card includes:

  * weekday + date UI
  * mode badge (Standard / High Intensity / Simulation / Warm-up)
  * task list (what to do)
  * completion toggle (checkmark)

### D) Completion Tracking

* Add checkmark button per day.
* Completed day visual: opacity-50 and/or "בוצע" badge.
* Persist completion state to UserProgress (or existing progress collection).
* Must survive refresh.

---

## Core Engine Requirements

### Scope: Always Show Last 7 Days

* Show up to 7 days before the exam:

  * `planDaysCount = min(7, daysAvailable)`
* If exam is 12 days away → still show only the last 7 days.

### Topics Per Day (Locked)

* `topicsPerDay = ceil(totalTopics / planDaysCount)`

### Rotation (Locked)

* Round-robin with category fallback:

  1. Weak
  2. If empty → Medium
  3. If empty → Strong
* Within category: do not repeat a topic until others in that category were covered.

### Activity Mix by Days Until Exam (Locked)

Determine daily mode by `daysUntilExam`:

| daysUntilExam | Mode           | Tasks                                                                |
| ------------- | -------------- | -------------------------------------------------------------------- |
| 1             | Warm-up        | 1 Weak topic + formulas/key notes (no full simulation)               |
| 2             | Simulation     | Full simulation + mistake analysis (+ optional quick Weak drill)     |
| 3–5           | High Intensity | Weak focus + targeted drills + optional mini simulation/question set |
| 6–7           | Standard       | topicsPerDay topics: Learning + Drills per topic                     |

### Edge Cases

* `daysAvailable <= 0` → show error card: "תאריך הבחינה חייב להיות בעתיד".
* No topics → remain in empty/CTA state prompting to add topics.
* Only 1 topic → still generate; rotation degenerates to same topic.

### Regenerate Behavior (Locked)

* Clicking Generate again:

  * Overwrite the plan (recompute + persist).
  * Completion retention rule:

    * keep completion by Topic ID when the same topic appears again.

---

## Technical Implementation Notes

### Files to Modify

* `src/lib/study-plan/engine.ts`

  * implement adaptive scaling + rotation + topicsPerDay + daily modes

* `src/app/(frontend)/study-plan/_components/useStudyPlan.ts`

  * manage `hasGenerated` state
  * handle Generate click → compute + persist
  * handle regenerate semantics
  * load persisted plan + completion states

* `src/app/(frontend)/study-plan/_components/DayCard.tsx`

  * completion toggle UI + dim/badge
  * render tasks per mode as returned by the engine

### Date Handling

* Use date-fns only for day-diff calculations to avoid timezone/DST issues.

### Styling

* Tailwind only
* Assistant font (300–800)
* Full RTL support
* Lucide icons
* Slate/Indigo palette like the demo

---

## Acceptance Criteria

* [ ] Plan does not generate before clicking Generate.
* [ ] Clear behavioral difference between 2-day and longer scenarios (within 7-day window).
* [ ] Each day shows specific topics + specific practice tasks.
* [ ] Mark-as-complete persists after refresh.
* [ ] UI is fully RTL and visually aligned with demo.
* [ ] `daysUntilExam = 1` produces Warm-up (no full study day).

---

## Definition of Done

PR includes:

* Working adaptive engine implementation.
* Explicit generate trigger + correct empty state.
* Completion persistence.
* Minimal unit tests for engine (2-day, 5-day, 7-day scenarios with varying topic mixes).
