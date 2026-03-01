# Study Plan Generator - Specification

## 1. Executive Summary

This task implements critical fixes and new functionality for the Adaptive Practice Schedule feature.

### Current Problems
- Schedule is static/identical across days
- Plan generates automatically/incorrectly on mount

### Target Behavior
- Plan generated only on explicit user action (Generate button)
- Plan is dynamic based on exam proximity + topic mastery
- Each day shows specific topics and concrete practice actions
- Day completion can be marked and persisted

## 2. Identified Bugs & Required Fixes

### BUG A — Missing Manual Trigger
- **Issue**: Plan generates automatically on mount
- **Required Fix**: Add explicit CTA button:
  - HE: `צור תוכנית לימודים`
  - EN: `Generate Example Plan`
- Compute + persist ONLY when user clicks Generate
- Before generation: show empty state with HE: `מוכנים לצאת לדרך?`

### BUG B — Static Schedule Logic
- **Issue**: Daily activities are repetitive/ignore timeline urgency
- **Required Fix**: Implement adaptive timeline scaling
- Activity mix must change as exam approaches

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
- Assign specific topics each day from user topics inventory
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

## 4. UI & Interaction Updates

### Visual Identity (RTL)
- Font: Assistant (300–800)
- RTL everywhere
- Vertical timeline + rounded cards (`rounded-2xl`) + shadows
- Mastery colors:
  - Weak: `red-500`
  - Medium: `orange-400`
  - Strong: `emerald-500`
- Palette: Slate/Indigo

### Progress Tracking
- Add completion toggle (checkmark) per day card
- Persist completion to existing `UserProgress` collection
- Completed day visual: `opacity-50` and/or `בוצע` badge
- Completion survives page refresh

## 5. Technical Implementation Notes

### Files to Modify
- `src/lib/study-plan/engine.ts` - adaptive scaling, fallback selection, round-robin topic rotation, per-day activity generation
- `src/app/(frontend)/study-plan/_components/useStudyPlan.ts` - hasGenerated/manual trigger flow, generate + persist behavior, load persisted plan + completion
- `src/app/(frontend)/study-plan/_components/DayCard.tsx` - completion toggle UI, completed state visuals, render concrete tasks

### Date Handling
- Use **date-fns only** for day calculations (timezone/DST safe)

## 6. Acceptance Criteria

- [ ] Plan generation happens only on Generate button click
- [ ] Clear behavioral difference between 2-day and 10-day scenarios
- [ ] Each day shows specific topics + concrete activity tasks
- [ ] Completion state persists after refresh
- [ ] UI is RTL and matches the intended visual style
- [ ] `daysUntilExam = 1` yields warm-up style day (not full study day)
