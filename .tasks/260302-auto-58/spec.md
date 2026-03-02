# Study Plan UI: Manual Generate/Regenerate Specification

## Overview
Change the Study Plan UI to require explicit user action (Generate/Regenerate button clicks) instead of auto-generating the plan on every input change.

## Requirements

### FR-1: Empty State Before Generation
- Before the user clicks "Generate", display an empty state with:
  - Hebrew text: `מוכנים לצאת לדרך?`
  - CTA button: `צור תוכנית לימודים` (Create Study Plan) or `Generate Example Plan`
- Do NOT compute, render, or persist any plan before explicit Generate click

### FR-2: No Auto-Regeneration on Input Edits
- After initial generation, changing date/topics/mastery inputs should NOT:
  - Recompute the plan
  - Re-render the plan
  - Persist any changes to the plan
- The existing plan stays unchanged until user explicitly triggers regeneration

### FR-3: Dirty State Tracking
- When inputs change AFTER a plan exists, mark the draft as "dirty"
- Display an explicit "Regenerate" button when the draft is dirty

### FR-4: Explicit Generate/Regenerate Only
- Generate/Regenerate button is the ONLY path to:
  - Compute a new plan
  - Persist the plan to storage

## Acceptance Criteria

- [ ] No plan appears before Generate click
- [ ] No auto-regeneration on input edits
- [ ] Explicit Regenerate button appears when draft changes after generation
- [ ] Generate/Regenerate is the only path to compute + persist

## Visual Direction
- Follow `test plan.html` for layout/style vibe
- RTL (right-to-left) layout
- Assistant font family
- Tailwind CSS cards/timeline components
- Lucide icons

## Scope
- UI/hook flow only
- No engine algorithm changes except wiring for explicit trigger behavior
