# Study Plan Generator - Specification

## Overview
The Adaptive Practice Schedule feature needs critical fixes and new functionality to generate dynamic, personalized study plans based on exam proximity and topic mastery levels.

## Current Problems
- Schedule is static/identical across days
- Plan generates automatically on mount (incorrect behavior)
- No manual trigger for plan generation

## Target Behavior
- Plan generates only on explicit user action (Generate button)
- Plan is dynamic by exam proximity + topic mastery
- Each day shows specific topics and concrete practice actions
- Day completion can be marked and persisted

## Functional Requirements

### A) Adaptive Timeline Scaling
Scheduler assigns daily strategy by `daysUntilExam`:

| Timeframe | Strategy | Primary Focus | Activity Mix |
|-----------|----------|---------------|--------------|
| 1–2 days | Survival Mode | Knowledge Maintenance | Maintain Strong + 1 quick pass on Weak |
| 3–5 days | High Intensity | Exam Readiness | Full simulations + mistake analysis + weak drills |
| 6–7 days | Balanced | Mastery & Polish | Mix of drills, hybrid simulations, targeted reinforcement |
| 8+ days | Mastery Cycle | Foundation Building | Intensive weak-topic drills |

**Implementation Logic:**
- `daysUntilExam <= 2` → Survival Mode (warmup activities)
- `daysUntilExam >= 3 && daysUntilExam <= 5` → High Intensity
- `daysUntilExam >= 6 && daysUntilExam <= 7` → Balanced  
- `daysUntilExam >= 8` → Mastery Cycle

### B) Fallback + Topic Selection
- Assign specific topics each day from user topics inventory
- Weak-focus fallback priority: Weak → Medium → Strong
- Round-robin rotation: Do not repeat a topic until peers in same category are covered

### C) Scope & Timeline
- Generate `min(7, max(1, daysUntilExam))` days - adaptive based on exam proximity
- If exam is in 3 days, generate 3 days (not 7)
- If exam is in 10 days, generate 7 days
- If exam is today (daysUntilExam = 0 or 1), show single warm-up day
- `daysUntilExam = 1` must be warm-up oriented (not full study day)

## UI Requirements
- Font: Assistant (300–800), RTL everywhere
- Vertical timeline + rounded cards (`rounded-2xl`) + shadows
- Mastery colors: Weak (red-500), Medium (orange-400), Strong (emerald-500)
- Palette: Slate/Indigo

## Progress Tracking
- Completion toggle per day card
- Persist to existing `UserProgress` collection
- Completed day visual: `opacity-50` AND Hebrew `בוצע` badge (not "הושלם")

## Acceptance Criteria
- [ ] Plan generation happens only on Generate button click
- [ ] Clear behavioral difference between 2-day and 10-day scenarios
- [ ] 2-day scenario: 2 days shown, Survival Mode (warmup)
- [ ] 10-day scenario: 7 days shown, Mastery Cycle mode
- [ ] Each day shows specific topics + concrete activity tasks
- [ ] Completion state persists after refresh
- [ ] UI is RTL and matches visual style
- [ ] `daysUntilExam = 1` yields exactly 1 warm-up style day
- [ ] Completed days show `opacity-50` and `בוצע` badge (Hebrew)
