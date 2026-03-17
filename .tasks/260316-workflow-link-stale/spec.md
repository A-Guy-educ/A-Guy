# Fix: Dashboard Workflow Links Point to Ended Workflow Runs

## Problem
When Cody runs issue #839 (or any issue that has been run multiple times), the dashboard workflow link points to a completed/ended workflow run instead of the currently active one.

## User Report
> cody runs issue 839 but dashboard workflow links to ended workflow

## Root Cause
The workflow run matching logic in the tasks API route keeps only the most recent run per `display_title`, and when the `display_title` is generic (e.g., "cody" for workflow_dispatch triggers) or when a completed run appears before the active one, the wrong (stale) run is linked.

Additionally, the fallback matching uses `html_url.includes(taskId)` which is unreliable since `html_url` contains numeric run IDs, not task IDs.

## Requirements
- REQ-1: Active tasks should link to the active (in_progress/queued) workflow run, not a completed one
- REQ-2: When only completed runs exist, link to the most recent one
- REQ-3: Matching logic should be consistent across all API routes (tasks list, task detail, pipeline)
- REQ-4: `fetchWorkflowRuns()` should include `head_branch` in the mapped data
- REQ-5: No false-positive matches from substring matching in URLs
- REQ-6: All existing tests must continue to pass

## Task Type
fix_bug

## Affected Files
- `src/ui/cody/github-client.ts` — fetchWorkflowRuns missing head_branch
- `src/app/api/cody/tasks/route.ts` — Workflow run matching logic
- `src/app/api/cody/tasks/[taskId]/route.ts` — Task detail workflow matching
- `src/app/api/cody/pipeline/[taskId]/route.ts` — Pipeline route workflow matching
