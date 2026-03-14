# Build Agent Report: cody-dashboard-fix-indicator

## Changes

- **src/ui/cody/components/MiniPipelineProgress.tsx** — Updated `gate-paused` case in both `InlineVariant` and `BarVariant` to show the running stage label (e.g., "Awaiting Fixing") instead of generic "Approval" / "Awaiting approval"

- **src/app/api/cody/tasks/route.ts** — Added `cody:done` to the `isLikelyActive` check so that pipeline status is fetched for issues that already completed (in case a fix was requested). Without this, the dashboard wouldn't fetch the pipeline for completed issues, missing any fix attempts that are paused at a risk gate.

## Problem

When a fix is requested on an issue that already has `cody:done` (from a previous successful run):
1. The issue has `cody:done` label
2. The pipeline fetching logic didn't recognize this as "likely active"
3. Pipeline was NOT fetched for the new fix attempt
4. Fell back to label-based column derivation → showed old status
5. Even if pipeline was fetched, the UI only showed generic "Approval" text

## Solution

1. **API fix**: Added `cody:done` to `isLikelyActive` so pipeline is fetched for completed issues (to detect fix attempts)

2. **UI fix**: Changed `MiniPipelineProgress` to show `displayState.label` (e.g., "Fixing", "Building") instead of generic "Approval" when paused at a gate

## Tests Written

- None — UI + API change, no test coverage needed

## Quality

- TypeScript: PASS
- Lint: PASS
