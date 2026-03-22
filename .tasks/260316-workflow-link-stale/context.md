# Codebase Context: 260316-workflow-link-stale

## Files to Modify
- `src/ui/cody/github-client.ts` (line 627) — Add `head_branch` to `fetchWorkflowRuns()` mapping
- `src/app/api/cody/tasks/route.ts` (lines 172-227) — Replace workflow run matching with smarter algorithm that prefers active runs
- `src/app/api/cody/tasks/[taskId]/route.ts` (lines 148, 214) — Use shared `matchWorkflowRunToTask` instead of unreliable `html_url.includes()`
- `src/app/api/cody/pipeline/[taskId]/route.ts` (lines 67-68) — Same fix as task detail route
- `src/ui/cody/workflow-matching.ts` (NEW) — Shared `matchWorkflowRunToTask` utility function
- `tests/unit/ui/cody/workflow-run-matching.test.ts` (NEW) — Unit tests for matching logic

## Files to Read (reference patterns)
- `src/app/api/cody/tasks/route.ts` (lines 162-280) — Current matching logic and task enrichment
- `src/app/api/cody/tasks/[taskId]/route.ts` (lines 135-230) — Single task detail matching
- `src/ui/cody/github-client.ts` (lines 600-643) — `fetchWorkflowRuns` and `getWorkflowRunForTask`
- `src/ui/cody/types.ts` (lines 191-200) — `WorkflowRun` type definition
- `src/ui/cody/components/MiniPipelineProgress.tsx` (lines 136-147) — How `workflowRun.html_url` is rendered
- `src/ui/cody/components/WorkflowRunsPopover.tsx` (lines 139-167) — Popover using `run.head_branch` and `run.html_url`
- `tests/unit/scripts/cody/get-column-for-issue.test.ts` — Test pattern for route logic
- `tests/unit/ui/cody/pipeline-normalize.test.ts` — Test helper patterns (makePipeline)

## Key Signatures
- `export async function fetchWorkflowRuns(options?)` from `src/ui/cody/github-client.ts` — Returns `WorkflowRun[]`
- `export async function getWorkflowRunForTask(taskId: string)` from `src/ui/cody/github-client.ts` — Returns `WorkflowRun | null`
- `function getColumnForIssue(issue, workflowRun?, associatedPR?)` from `src/app/api/cody/tasks/route.ts` — Column derivation
- `export function deriveColumnFromPipeline(pipeline)` from `src/app/api/cody/tasks/route.ts` — Pipeline-based column
- `export interface WorkflowRun { id, status, conclusion, created_at, updated_at, html_url, display_title?, head_branch? }` from `src/ui/cody/types.ts`

## Reuse Inventory
- `WorkflowRun` type from `src/ui/cody/types.ts` — already has `head_branch?: string` ✅
- `fetchWorkflowRuns()` from `src/ui/cody/github-client.ts` — modify to include `head_branch`
- `CACHE_TTL` from `src/ui/cody/constants.ts` — pipeline cache is 60s
- `WORKFLOW_ID` from `src/ui/cody/constants.ts` — workflow identifier
- Test patterns from `tests/unit/ui/cody/pipeline-normalize.test.ts` — makePipeline helper

## Integration Points
- `fetchWorkflowRuns()` called from: tasks list route, task detail route, pipeline route, workflows route
- `task.workflowRun` populated in `tasks/route.ts` lines 296-304 → consumed by `MiniPipelineProgress`, `TaskDetail`, `TaskList`
- `WorkflowRunsPopover` independently fetches runs via `/api/cody/workflows` and filters client-side by `display_title`
- New `matchWorkflowRunToTask` must be importable from all three API routes

## Imports Verified
- `import { fetchWorkflowRuns } from '@/ui/cody/github-client'` in tasks/route.ts ✅
- `import type { WorkflowRun } from '@/ui/cody/types'` in tasks/route.ts ✅
- `import { fetchWorkflowRuns } from '@/ui/cody/github-client'` in tasks/[taskId]/route.ts ✅
- `import { fetchWorkflowRuns } from '@/ui/cody/github-client'` in pipeline/[taskId]/route.ts ✅

## Bug Summary
The dashboard shows workflow links to completed/ended runs instead of the currently active run. Root cause:
1. `fetchWorkflowRuns()` omits `head_branch` from the mapping (minor)
2. `tasks/route.ts` matching keeps only the FIRST run per `display_title` — when a completed run is newer than an active rerun (or when `display_title` is generic for dispatch triggers), the stale link is shown
3. `tasks/[taskId]/route.ts` and `pipeline/[taskId]/route.ts` match via `html_url.includes(issueNumber)` which is unreliable

Fix: Create shared `matchWorkflowRunToTask()` that prefers `in_progress` > `queued` > most recent completed.
