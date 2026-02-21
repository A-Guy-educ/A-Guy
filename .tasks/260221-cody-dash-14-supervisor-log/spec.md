# TASK-14: Supervisor Log Timeline

## Summary
Create a timeline component showing supervisor retry attempts, failure analysis, and retry commands.

## Task Type
implement_feature

## Dependencies
- TASK-02 (types)

## Requirements

### R1: SupervisorLog component
- File: `src/ui/admin/CodyPipeline/SupervisorLog.tsx`
- Client component
- Props: `comments: ParsedComment[]` (pre-filtered to supervisor types)
- Displays a vertical timeline of retry attempts:
  - Each entry: attempt number (1/3, 2/3, 3/3), failed stage, root cause summary, timestamp
  - Visual: vertical line connecting entries, colored dots (blue=retry, red=exhausted)
- If no supervisor comments: don't render (return null)
- If exhausted: show final entry with red "Max Retries Exhausted" indicator

### R2: Entry details
Each retry entry shows (parsed from supervisor-retry comment body):
- `Failed stage: {stage}` — from "**Failed stage:** `{stage}`"
- `Error: {error}` — from "**Error:** {error}"
- Root cause summary (first sentence of "### Root Cause" section)
- Rerun command (the `/cody rerun ...` line at the bottom)

### R3: Extraction helpers
- Parse failure analysis sections from supervisor comment body
- Simple string matching (not full markdown parsing)
- Extract: failedStage, error, rootCause from the structured format

## Files to Create
- `src/ui/admin/CodyPipeline/SupervisorLog.tsx` (NEW)

## Acceptance Criteria
- [ ] Timeline renders retry attempts in order
- [ ] Each attempt shows stage, error, root cause
- [ ] Exhausted state shows red indicator
- [ ] Empty state (no retries): component returns null
- [ ] `pnpm tsc --noEmit` passes
