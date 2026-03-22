# Codebase Context: 260315-dashboard-status-clarity

## Files to Modify
- `src/ui/cody/github-client.ts` (lines 208-233) — Fix `normalizePipelineStatus` to derive `currentStage` from stage data when null
- `src/ui/cody/pipeline-utils.ts` (lines 14-27, 246-250, 272-274) — Fix `derivePipelineDisplayState` Case 3 fallback; update `stageLabels`; update `getTaskSubStatusText` gate text
- `src/ui/cody/components/MiniPipelineProgress.tsx` (lines 65-112, 88-92, 160-165) — Simplify InlineVariant to dots-only (remove duplicate text); change gate-paused text format in BarVariant
- `src/ui/cody/components/TaskList.tsx` (line 118) — Update `statusLabel['gate-waiting']` from "Gate" to "Needs Approval"
- `src/ui/cody/components/tooltip-content.tsx` (lines 33-37) — Update gate-waiting tooltip text
- `src/ui/cody/components/FilterBar.tsx` (line 34) — Update "Gate Waiting" to "Needs Approval"
- `src/ui/cody/constants.ts` (line 52) — Update `COLUMN_DEFS['gate-waiting'].label`
- `src/ui/cody/components/CodyStatusBanner.tsx` (lines 222-223) — Update banner text
- `tests/unit/ui/cody/pipeline-display-state.test.ts` (MODIFIED) — Update assertions for new labels + add fallback tests
- `tests/unit/ui/cody/pipeline-normalize.test.ts` (NEW) — Tests for normalizePipelineStatus fix
- `tests/unit/ui/cody/dashboard-status-labels.test.ts` (NEW) — Label consistency tests

## Files to Read (reference patterns)
- `src/ui/cody/github-client.ts` (lines 204-233) — `normalizePipelineStatus` current implementation
- `src/ui/cody/pipeline-utils.ts` — `derivePipelineDisplayState` full function
- `src/ui/cody/components/MiniPipelineProgress.tsx` — How display state is rendered into text; both InlineVariant and BarVariant
- `src/ui/cody/components/TaskList.tsx` (lines 313-314, 482-485) — Where both MiniPipelineProgress variants are rendered
- `tests/unit/ui/cody/pipeline-display-state.test.ts` — Test helpers and patterns to follow

## Key Signatures
- `function normalizePipelineStatus(status: CodyPipelineStatus): CodyPipelineStatus` from `src/ui/cody/github-client.ts` (internal, not exported)
- `export function derivePipelineDisplayState(task: CodyTask): PipelineDisplayState` from `src/ui/cody/pipeline-utils.ts`
- `export function getTaskSubStatusText(task: CodyTask): string` from `src/ui/cody/pipeline-utils.ts`
- `export const stageLabels: Record<string, string>` from `src/ui/cody/pipeline-utils.ts`
- `export const COLUMN_DEFS: Record<ColumnId, ColumnDef>` from `src/ui/cody/constants.ts`
- `export const ALL_STAGES` from `src/ui/cody/constants.ts`

## Real Pipeline Data (from GitHub investigation)
Critical finding: `currentStage` is **always null** in real status.json files on branches.

```
#838: { state: 'paused', currentStage: null, stages: { taskify: { state: 'paused' } } }
#835: { state: 'paused', currentStage: null, stages: { taskify: { state: 'paused' } } }
#824: { state: 'paused', currentStage: null, stages: { taskify: completed, gap: completed, architect: paused } }
#839: { state: 'running', currentStage: null, stages: { taskify-review: all completed/skipped } }
#827: { state: 'running', currentStage: null, stages: { taskify: paused, architect: completed } }
```

This means ALL downstream display logic that depends on `currentStage` is broken. The normalization function must derive it.

## Duplicate Status Display (Bug D)
TaskList renders MiniPipelineProgress TWICE for active tasks:
- Line 314: `<MiniPipelineProgress task={task} variant="inline" />` — in metadata row (dots + text)
- Line 484: `<MiniPipelineProgress task={task} variant="bar" />` — dedicated row below (bigger dots + same text + elapsed)
Both show identical text like "⏸ Awaiting Analyzing", causing visual noise.
Fix: InlineVariant should show dots-only (no text). BarVariant keeps full text + elapsed.

## Reuse Inventory
- `derivePipelineDisplayState` from `src/ui/cody/pipeline-utils.ts` — modify internal logic
- `normalizePipelineStatus` from `src/ui/cody/github-client.ts` — improve heuristic
- `ALL_STAGES` from `src/ui/cody/constants.ts` — stage ordering for derivation
- `makeTask`, `makePipeline` helpers from `tests/unit/ui/cody/pipeline-display-state.test.ts` — reuse in new tests

## Integration Points
- `normalizePipelineStatus` is called in `getStatusFromBranch` and `findStatusOnBranch` in github-client.ts — it's the single choke point for all pipeline data entering the dashboard
- `stageLabels` imported by `CodyStatusBanner.tsx`, `PipelineStatus.tsx`, `pipeline-utils.ts`
- `MiniPipelineProgress` renders text directly from `derivePipelineDisplayState` return value
- TaskList.tsx line 314 and 484 both render MiniPipelineProgress for active tasks
- Bar variant is `sm:block hidden` — only visible on ≥640px screens

## Imports Verified
- `import { ALL_STAGES } from '../constants'` in pipeline-utils.ts ✅
- `import { stageLabels, getStageTooltip, formatElapsed } from '../pipeline-utils'` in CodyStatusBanner.tsx ✅
- `import { derivePipelineDisplayState, getStageTooltip, formatElapsed } from '../pipeline-utils'` in MiniPipelineProgress.tsx ✅
- `import type { CodyPipelineStatus } from './types'` in github-client.ts ✅

## Note on normalizePipelineStatus
This function is NOT exported — it's internal to github-client.ts. To test it, either:
1. Export it for testing (preferred — add `export` keyword)
2. Test indirectly via the public API functions that call it
