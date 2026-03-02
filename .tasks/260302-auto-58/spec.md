# Study Plan UI: Manual Generate/Regenerate only (no auto plan on input changes)

## Overview

Change the Study Plan UI behavior from automatic plan computation/rendering/persistence to manual-only generation via explicit user click.

## Requirements

### FR-1: Empty State Before Generation
- Before explicit Generate click:
  - Show empty state with message: `מוכנים לצאת לדרך?`
  - Show CTA button: `צור תוכנית לימודים` / `Generate Example Plan`
  - Do NOT compute, render, or persist plan

### FR-2: No Auto-Computation
- Before explicit Generate click:
  - Changing date/topics/mastery inputs must NOT trigger plan computation
  - Changing date/topics/mastery inputs must NOT render or persist any plan

### FR-3: Dirty State After Generation
- After plan exists:
  - Changing date/topics/mastery marks draft as dirty only
  - Existing rendered plan stays unchanged
  - Recompute/persist only on explicit Regenerate click

### FR-4: Regenerate Button
- Show explicit Regenerate button when draft changes after generation
- Generate/Regenerate is the only path to compute + persist

## Acceptance Criteria

- [ ] No plan appears before Generate click
- [ ] No auto-regeneration on input edits
- [ ] Explicit Regenerate button appears when draft changes after generation
- [ ] Generate/Regenerate is the only path to compute + persist

## Visual Direction

Follow `test plan.html` for layout/style vibe:
- RTL layout
- Assistant font
- Tailwind cards/timeline design
- Empty state with icon and CTA

## Files

- `src/app/(frontend)/study-plan/_components/useStudyPlan.ts` - Hook for plan generation logic
- `src/app/(frontend)/study-plan/_components/StudyPlanPage.tsx` - Main page component
- `src/app/(frontend)/study-plan/_components/DayCard.tsx` - Day card component (if needed)

## Notes

- UI/hook flow only; no engine algorithm changes except wiring needed for explicit trigger behavior
- Logic requirements in this issue override demo JS behavior if they conflict
