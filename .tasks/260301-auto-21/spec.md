# Adaptive Practice Schedule - Specification

## 1. Executive Summary

This task fixes critical bugs and missing functionality in the Adaptive Practice Schedule.

**Current Problems:**
- Schedule is static/identical across days
- Plan generation is automatic/incorrect on mount

**Target Behavior:**
- Plan is generated only on explicit user action
- Plan is dynamic by exam proximity + topic mastery
- Each day shows specific topics and concrete practice actions
- Day completion can be marked and persisted

**Design Mandate:**
- Mirror `test plan.html` visual style
- Tailwind CSS, Assistant font, RTL, Lucide icons
- Same spacing/cards/vibe

---

## 2. Identified Bugs & Required Fixes

### BUG A — Missing Manual Trigger

**Issue:**
- Plan generates automatically (or incorrectly) on mount

**Required Fix:**
- Add explicit CTA button:
  - HE: `צור תוכנית לימודים`
  - EN: `Generate Example Plan`
- Do NOT compute or persist schedule on mount or field changes
- Compute + persist only when user clicks Generate
- Before generation, show empty state:
  - HE: `מוכנים לצאת לדרך?`

### BUG B — Static Schedule Logic

**Issue:**
- Daily activities are repetitive/static and ignore timeline urgency

**Required Fix:**
- Implement adaptive timeline scaling
- Activity mix must change as exam approaches

---

## 3. Functional Requirements (Logic Engine)

### A) Adaptive Timeline Scaling

Scheduler must assign daily strategy by `daysUntilExam`:

| Timeframe | Strategy | Primary Focus | Activity Mix |
|-----------|----------|---------------|--------------|
| 1–2 days | Survival Mode | Knowledge Maintenance | Maintain Strong + 1 quick pass on Weak, no full simulations |
| 3–5 days | High Intensity | Exam Readiness | Full simulations + mistake analysis + weak drills |
| 6–7 days | Balanced | Mastery & Polish | Mix of drills, hybrid simulations, targeted reinforcement |
| 8+ days | Mastery Cycle | Foundation Building | Days 8+ = intensive weak-topic drills, final 1–7 days follow standard countdown logic |

### B) Fallback + Topic Selection
 each day from user- Assign specific topics topics inventory
- Weak-focus fallback:
  1. Weak
  2. if empty → Medium
  3. if empty → Strong
- Rotation rule:
  - Round-robin in selected category
  - Do not repeat a topic until peers in same category are covered

### C) Scope & Timeline
- Show up to last 7 days before exam
- Must clearly differ between near exam and longer horizon
- `daysUntilExam = 1` must be warm-up oriented, not full study day

---

## 4. UI & Interaction Updates

### Visual Identity (RTL)
- Font: Assistant (300–800)
- RTL everywhere
- Vertical timeline + rounded cards (`rounded-2xl`) + shadows
- Mastery colors:
  - Weak: `red-500`
  - Medium: `orange-400`
  - Strong: `emerald-500`
- Palette: Slate/Indigo, matching demo vibe

### Progress Tracking
- Add completion toggle (checkmark) per day card
- Persist completion to existing `UserProgress` collection
- Completed day visual:
  - `opacity-50` and/or `בוצע` badge
- Completion survives page refresh

---

## 5. Technical Implementation Notes

### Files to Modify
- `src/lib/study-plan/engine.ts` - adaptive scaling, fallback selection, round-robin topic rotation, per-day activity generation
- `src/app/(frontend)/study-plan/_components/useStudyPlan.ts` - hasGenerated/manual trigger flow, generate + persist behavior, load persisted plan + completion, regenerate overwrite semantics
- `src/app/(frontend)/study-plan/_components/DayCard.tsx` - completion toggle UI, completed state visuals, render concrete tasks from engine output

### Date Handling
- Use **date-fns only** for day calculations (timezone/DST safe)

---

## 6. Acceptance Criteria

- [ ] Plan generation happens only on Generate button click
- [ ] Clear behavioral difference between 2-day and 10-day scenarios
- [ ] Each day shows specific topics + concrete activity tasks
- [ ] Completion state persists after refresh
- [ ] UI is RTL and matches the intended visual style
- [ ] `daysUntilExam = 1` yields warm-up style day (not full study day)

---

## 7. Definition of Done

PR includes:
- Working adaptive engine implementation
- Explicit generate trigger + correct empty state
- Completion persistence via existing progress model
- Tests for core engine behavior (minimum):
  - 2-day scenario
  - 5-day scenario
  - 7+/10-day scenario
  - varying topic mastery mixes
- Type/lint/tests pass
