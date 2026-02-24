# Fix Plan: Cody State Machine — Remaining Work

**Task ID**: 260223-cody-state-machine-rewrite
**Task Type**: refactor (continuation)
**Risk Level**: medium
**Created**: 2026-02-24
**Parent Plan**: `.tasks/260223-cody-state-machine-rewrite/plan.md` (Steps 1-13)

---

## Context

Steps 1-8, 10-11 of the original plan are implemented. Three areas need fixes:

1. **Engine wiring gaps** — Post-actions not called by engine, rebuild callback not connected, parallel PipelinePausedError incomplete
2. **Step 12 not started** — No deletions, no modifications to cody-utils.ts, cody.yml, package.json, existing tests
3. **Tests placeholder** — Integration tests are all `expect(true).toBe(true)`
4. **2 blockers** — 1 TypeScript error, 2 lint errors

### Blocker Details

- **TS error**: `status.ts:225` — v2 `StageStateV2.state` includes `'paused'` but v1 `StageStatus.state` has `'gate-waiting'` instead. Must map `'paused'` → `'gate-waiting'` in `stateToV1`.
- **Lint error 1**: `skip-conditions.ts:12` — unused `readTask` import
- **Lint error 2**: `integration.test.ts:8` — unused `vi` import

---

## Step F1: Fix Blockers (TS error + lint errors)

**Time estimate**: 5 minutes
**Files to touch**:
- `scripts/cody/engine/status.ts` (MODIFIED — line 225)
- `scripts/cody/pipeline/skip-conditions.ts` (MODIFIED — line 12)
- `tests/unit/scripts/cody/engine/integration.test.ts` (MODIFIED — line 8)

**Exact changes**:

### status.ts line 225 — Map `paused` → `gate-waiting` for v1 compat

In `stateToV1`, the v1 `StageStatus.state` type is:
```
'pending' | 'running' | 'completed' | 'failed' | 'timeout' | 'skipped' | 'gate-waiting'
```

The v2 `StageStateV2.state` type is:
```
'pending' | 'running' | 'completed' | 'failed' | 'timeout' | 'skipped' | 'paused'
```

The mapping mismatch is `paused` (v2) → `gate-waiting` (v1). Change line 225 from:
```typescript
state: stage.state,
```
to:
```typescript
state: stage.state === 'paused' ? 'gate-waiting' : stage.state,
```

### skip-conditions.ts line 12 — Remove unused `readTask` import

Remove `readTask` from the import. Line 12 changes from:
```typescript
import { readTask } from '../pipeline-utils'
```
to: delete the line entirely (or keep only if used elsewhere in file — it is NOT used).

### integration.test.ts line 8 — Remove unused `vi`

Change from:
```typescript
import { describe, it, expect, vi } from 'vitest'
```
to:
```typescript
import { describe, it, expect } from 'vitest'
```

**Tests**:
1. `pnpm -s tsc --noEmit` passes (no TS errors)
2. `npx eslint scripts/cody/pipeline/skip-conditions.ts tests/unit/scripts/cody/engine/integration.test.ts` passes (no lint errors)

**Acceptance criteria**:
- [ ] Zero TypeScript errors in cody engine files
- [ ] Zero lint errors in the two files
- [ ] `stateToV1` correctly maps `paused` → `gate-waiting`

---

## Step F2: Wire Post-Actions into Engine

**Time estimate**: 15 minutes
**Files to touch**:
- `scripts/cody/engine/state-machine.ts` (MODIFIED — lines 17-21, 163-165, 283-300)

**Root cause**: `handleStageResult` at line 298-299 has a placeholder comment: `// Note: postActions execution happens in the caller` — but no caller actually executes them. The plan (Step 9, item 8) says: "If completed → run post-actions (catch PipelinePausedError)".

**Exact changes**:

1. Add import at top:
```typescript
import { executePostAction } from '../pipeline/post-actions'
```

2. Change `handleStageResult` from sync to async (it needs to `await` post-actions):
```typescript
async function handleStageResult(
  ctx: PipelineContext,
  state: PipelineStateV2,
  stageName: string,
  result: StageResult,
  def: StageDefinition,
): Promise<PipelineStateV2> {
```

3. Replace the placeholder (lines 297-300) with actual post-action execution:
```typescript
// Run post-actions if defined
if (def.postActions) {
  for (const action of def.postActions) {
    await executePostAction(ctx, action, state)
    // Note: executePostAction may throw PipelinePausedError
    // which propagates up to executeSingleStep's catch block
  }
}
```

4. Update the caller in `executeSingleStep` line 165 to `await`:
```typescript
return await handleStageResult(ctx, state, stageName, result, def)
```

5. Since `handleStageResult` now needs `ctx`, add it as a parameter (update signature and call site).

**Tests** (file: `tests/unit/scripts/cody/engine/state-machine.test.ts`, NEW):
1. `handleStageResult calls executePostAction for each postAction on completed stage` — mock executePostAction, create a def with 2 postActions, pass completed result, assert both called.
2. `handleStageResult propagates PipelinePausedError from post-actions` — mock executePostAction to throw PipelinePausedError, assert it propagates (caught by executeSingleStep's try/catch at line 167).
3. `dry-run skips post-actions` — confirm the dry-run return at line 144 happens before handleStageResult is called.

**Acceptance criteria**:
- [ ] `handleStageResult` is async and actually calls `executePostAction`
- [ ] PipelinePausedError from post-actions is caught in executeSingleStep and converts to paused state
- [ ] Dry-run still skips both handlers AND post-actions (return at line 144 is before handler/post-actions)
- [ ] `pnpm -s tsc --noEmit` passes

---

## Step F3: Wire Rebuild Callback for Two-Phase Pipeline

**Time estimate**: 15 minutes
**Files to touch**:
- `scripts/cody/engine/state-machine.ts` (MODIFIED — runPipeline signature + loop)
- `scripts/cody/entry.ts` (MODIFIED — runPipeline call sites)
- `scripts/cody/pipeline/post-actions.ts` (MODIFIED — resolve-profile signals rebuild)

**Root cause**: `runPipeline` doesn't accept a `rebuildPipeline` callback. After taskify, `resolve-profile` post-action mutates `ctx.profile`, but the pipeline is never rebuilt with the new stages.

**Exact changes**:

### state-machine.ts

1. Add `rebuildPipeline` optional parameter:
```typescript
export async function runPipeline(
  ctx: PipelineContext,
  pipeline: PipelineDefinition,
  hooks?: LifecycleHooks,
  rebuildPipeline?: (ctx: PipelineContext) => PipelineDefinition,
): Promise<PipelineStateV2> {
```

2. After the post-action execution (inside the loop, after `executeSingleStep` returns), check if pipeline needs rebuilding. The signal mechanism: `resolve-profile` post-action sets a flag on `ctx` (e.g., `ctx._pipelineNeedsRebuild = true`). After each step:
```typescript
// Check if pipeline needs rebuilding (two-phase construction)
if ((ctx as any)._pipelineNeedsRebuild && rebuildPipeline) {
  pipeline = rebuildPipeline(ctx)
  delete (ctx as any)._pipelineNeedsRebuild
}
```

Alternatively (cleaner): add a `pipelineNeedsRebuild?: boolean` to `PipelineContext` interface in types.ts. This avoids the `any` cast.

### post-actions.ts — resolve-profile case

After the existing `ctx.profile = profile` line, add:
```typescript
// Signal engine to rebuild pipeline with new profile
;(ctx as any)._pipelineNeedsRebuild = true
```

Or if using the typed approach, `ctx.pipelineNeedsRebuild = true`.

### entry.ts — Pass rebuild callback at call sites

For `full` mode (the only mode that needs two-phase):
```typescript
import { createRebuildCallback } from './engine/pipeline-resolver'

// In runFullMode or wherever runPipeline is called for full mode:
const rebuild = createRebuildCallback('full', input.clarify ?? false)
const state = await runPipeline(ctx, pipeline, hooks, rebuild)
```

For other modes (spec, impl, rerun), pass `undefined` for rebuildPipeline (no rebuild needed).

**Tests**:
1. `runPipeline calls rebuildPipeline when ctx._pipelineNeedsRebuild is set` — mock rebuildPipeline callback, set flag on ctx after first step, assert callback called and pipeline replaced.
2. `resolve-profile post-action sets _pipelineNeedsRebuild flag` — call executePostAction with resolve-profile, assert ctx flag set.

**Acceptance criteria**:
- [ ] Full mode pipeline extends after taskify/resolve-profile
- [ ] Other modes don't trigger rebuild
- [ ] `pnpm -s tsc --noEmit` passes

---

## Step F4: Fix Parallel PipelinePausedError Handling (G30)

**Time estimate**: 10 minutes
**Files to touch**:
- `scripts/cody/engine/state-machine.ts` (MODIFIED — executeParallelStep, lines 226-236)

**Root cause**: `executeParallelStep` handles rejected promises but doesn't detect thrown `PipelinePausedError`. When a handler throws `PipelinePausedError` (not returns `outcome: 'paused'`), it's caught in the `rejected` path and treated as a generic failure.

**Exact changes**:

In the `for (const result of results)` loop, in the `rejected` branch (line 226-236), add a check for PipelinePausedError:

```typescript
if (result.status === 'rejected') {
  // G30: Check if this is a PipelinePausedError
  if (result.reason instanceof PipelinePausedError) {
    // Find which stage paused (best effort from reason message)
    // Mark pipeline as paused
    return completeState(state, 'paused')
  }
  // ... existing failure handling
}
```

Also fix the `stageName` extraction (line 228) — standard Errors don't have `stageName`. The parallel map should wrap each stage execution to tag errors with the stage name. Change the parallel map to:

```typescript
stageNames.map(async (stageName) => {
  try {
    // ... existing logic
    const handler = getHandler(def.name, def.type)
    const result = await handler.execute(ctx, def)
    return { stageName, result }
  } catch (error) {
    // Tag the error with the stage name for the rejection handler
    if (error instanceof Error) {
      (error as any).stageName = stageName
    }
    throw error
  }
}),
```

**Tests**:
1. `executeParallelStep catches thrown PipelinePausedError and returns paused state` — mock a handler to throw PipelinePausedError, assert pipeline state is paused (not failed).
2. `executeParallelStep extracts stageName from tagged errors` — mock handler to throw Error, assert the stage name is extracted from rejection.

**Acceptance criteria**:
- [ ] Thrown PipelinePausedError in parallel stages → pipeline pauses (not fails)
- [ ] Stage name correctly tagged on thrown errors
- [ ] `pnpm -s tsc --noEmit` passes

---

## Step F5: Step 12 — Cleanup and Modifications

**Time estimate**: 25 minutes
**Files to touch**:
- `scripts/cody/cody-utils.ts` (MODIFIED)
- `.github/workflows/cody.yml` (MODIFIED)
- `package.json` (MODIFIED)
- 4 source files DELETED
- 4 test files DELETED
- 3 test files MODIFIED

### Source files to DELETE:
- `scripts/cody/cody.ts`
- `scripts/cody/stage-hooks.ts`
- `scripts/cody/run-cody.sh`
- `scripts/cody/parse-inputs.sh`

### Test files to DELETE:
- `tests/unit/scripts/cody.spec.ts`
- `tests/unit/scripts/cody/stage-hooks.test.ts`
- `tests/unit/scripts/cody/bug-exposure.test.ts`
- `tests/unit/scripts/cody/bugfixes.test.ts`

### cody-utils.ts modifications:

1. **Remove v1 status functions** — delete these function implementations (their only callers are in the soon-deleted cody.ts):
   - `readStatus` (line ~114)
   - `writeStatus` (line ~141)
   - `initStatus` (line ~150)
   - `updateStageStatus` (line ~179)
   - `completeStatus` (line ~226)
   Keep the `CodyPipelineStatus` and `StageStatus` TYPE exports (used by stateToV1 and formatStatusComment).

2. **Add re-exports from github-api.ts** — replace the original function implementations with:
   ```typescript
   export {
     postComment,
     editComment,
     getIssue,
     getIssueBody,
     getIssueTitle,
     getLatestIssueComment,
     discoverTaskIdFromIssue,
     ensureTaskMarkerComment,
     extractGateCommentBody,
     extractTaskIdFromMarker,
     TASK_ID_MARKER_REGEX,
   } from './github-api'
   ```

3. **Add formatStatusCommentV2**:
   ```typescript
   import { stateToV1 } from './engine/status'
   import type { PipelineStateV2 } from './engine/types'

   export function formatStatusCommentV2(input: CodyInput, stateV2: PipelineStateV2): string {
     return formatStatusComment(input, stateToV1(stateV2))
   }
   ```

4. **Update getLastFailedStage to v2** — change implementation to use `loadState` from `./engine/status` and iterate v2 stage states.

### .github/workflows/cody.yml modifications:

Per original plan Step 12. Change `orchestrate` job from `./scripts/cody/run-cody.sh` to `pnpm cody`. Change `parse` job from `./scripts/cody/parse-inputs.sh` to inline YAML logic.

### package.json modifications:

Update the `cody` script to point to `scripts/cody/entry.ts` instead of `scripts/cody/cody.ts`.

### Test file modifications:

- `tests/unit/scripts/cody/cody-utils-security.test.ts` — update source path inspections for functions moved to github-api.ts
- `tests/unit/scripts/cody/cody-utils-extended.test.ts` — remove tests for deleted v1 status functions, keep tests for remaining functions
- `tests/unit/scripts/cody/clarify-workflow.test.ts` — update spy targets from cody-utils to github-api module

**Tests**:
1. `pnpm -s tsc --noEmit` passes after all deletions/modifications
2. `pnpm -s lint` passes (no errors in modified files)
3. Deleted files don't exist on disk

**Acceptance criteria**:
- [ ] 4 source files deleted (cody.ts, stage-hooks.ts, run-cody.sh, parse-inputs.sh)
- [ ] 4 test files deleted
- [ ] 3 test files updated (compiling + passing)
- [ ] cody-utils.ts: v1 status functions removed, re-exports added, formatStatusCommentV2 added, getLastFailedStage updated
- [ ] cody.yml updated
- [ ] package.json updated
- [ ] `pnpm -s tsc --noEmit` passes
- [ ] `pnpm -s lint` passes

---

## Step F6: Implement Integration Tests

**Time estimate**: 25 minutes
**Files to touch**:
- `tests/unit/scripts/cody/engine/integration.test.ts` (MODIFIED — replace all placeholders)

**Exact behavior**:

Replace all 11 placeholder tests with real assertions. Tests use the real engine (`runPipeline`) with mock handlers via `vi.mock`. The fs and child_process modules are mocked to avoid disk I/O.

Mock strategy:
- `vi.mock('../scripts/cody/engine/status')` — mock loadState/writeState/initState to use in-memory state
- `vi.mock('../scripts/cody/handlers/handler')` — mock getHandler to return configurable mock handlers
- `vi.mock('../scripts/cody/pipeline/post-actions')` — mock executePostAction to no-op (or throw PipelinePausedError for gate tests)

9 integration tests from original plan Step 13:

1. **Full standard pipeline completes all stages in order** — Create pipeline with 4 stages (agent, agent, git, git). Mock all handlers to return completed. Assert all stages completed in state, state.state === 'completed'.

2. **Pipeline resumes from failed stage** — loadState returns state with stages [a:completed, b:failed, c:pending]. Run engine. Assert handler only called for b and c (not a).

3. **Rerun resets from specified stage with file deletion** — Use resetFromStage to reset state, then run engine. Assert stages re-executed.

4. **Gate pauses pipeline, resume continues** — Mock gate handler to return outcome: 'paused'. Assert pipeline state is 'paused'. Then loadState with gate completed, run again, assert completion.

5. **Lightweight skips heavyweight stages** — Create pipeline with plan-gap/auditor/apply-audit having shouldSkip returning true. Assert those stages are 'skipped' in final state.

6. **Dry-run marks completed without calling handlers** — Set ctx.input.dryRun = true. Assert handler.execute never called. Assert all stages 'completed'.

7. **Two-phase extends pipeline after taskify** — Start with pipeline = [taskify]. Pass rebuildPipeline callback that returns full pipeline. After taskify completes and rebuild fires, assert remaining stages execute.

8. **Parallel PipelinePausedError** — Pipeline with parallel step. One handler throws PipelinePausedError. Assert state is 'paused', not 'failed'.

9. **preExecute runs before handler** — Add preExecute to a stage def. Assert preExecute called before handler.execute.

Plus 2 unit tests from original plan:
10. **PipelineStateV2 type guard** — Test isPipelineStateV2 with valid v2, v1, and garbage.
11. **PostAction types** — Create factory for each of 10 variants, assert they compile and match.

**Tests**: All 11 tests should pass: `pnpm test:unit -- --run tests/unit/scripts/cody/engine/integration.test.ts`

**Acceptance criteria**:
- [ ] All 11 tests have real assertions (no `expect(true).toBe(true)`)
- [ ] Tests use real engine code, only external deps mocked
- [ ] All 11 tests pass
- [ ] Tests cover: resume, rerun, pause, dry-run, rebuild, preExecute, parallel pause

---

## Step F7: Final Quality Gate

**Time estimate**: 5 minutes
**Files to touch**: None (validation only)

**Run all quality gates**:
1. `pnpm -s tsc --noEmit` — zero errors
2. `pnpm -s lint` — zero errors (warnings OK)
3. `npx eslint scripts/cody/ tests/unit/scripts/cody/` — zero errors
4. `pnpm test:unit -- --run tests/unit/scripts/cody/` — all tests pass

**Acceptance criteria**:
- [ ] TypeScript compiles with zero errors
- [ ] ESLint has zero errors across all new/modified cody files
- [ ] All unit tests in cody directory pass
- [ ] No placeholder tests remain

---

## Execution Order

```
Step F1 (blockers)     ──→ fixes TS + lint errors (unblocks commit)
Step F2 (post-actions) ──→ wires post-actions into engine
Step F3 (rebuild)      ──→ wires two-phase pipeline
Step F4 (parallel G30) ──→ fixes parallel PipelinePausedError
Step F5 (cleanup)      ──→ Step 12: deletions + modifications
Step F6 (tests)        ──→ real integration tests
Step F7 (quality gate) ──→ final validation
```

Steps F1-F4 can be done first (engine fixes), then F5 (cleanup requires engine to be correct), then F6 (tests require both engine and cleanup), then F7 (validation).

---

## File Impact Summary

### Modified Files (7)
| File | Changes |
|------|---------|
| `scripts/cody/engine/state-machine.ts` | Post-action execution, rebuild callback, parallel pause fix |
| `scripts/cody/engine/status.ts` | Map `paused` → `gate-waiting` in stateToV1 |
| `scripts/cody/engine/types.ts` | Optional: add `pipelineNeedsRebuild` to PipelineContext |
| `scripts/cody/pipeline/skip-conditions.ts` | Remove unused `readTask` import |
| `scripts/cody/pipeline/post-actions.ts` | Set rebuild flag in resolve-profile |
| `scripts/cody/entry.ts` | Pass rebuild callback to runPipeline for full mode |
| `scripts/cody/cody-utils.ts` | Remove v1 status fns, add re-exports, formatStatusCommentV2, update getLastFailedStage |

### Modified Test Files (4)
| File | Changes |
|------|---------|
| `tests/unit/scripts/cody/engine/integration.test.ts` | Replace all placeholders with real tests |
| `tests/unit/scripts/cody/cody-utils-security.test.ts` | Update source path inspections |
| `tests/unit/scripts/cody/cody-utils-extended.test.ts` | Remove v1 status tests |
| `tests/unit/scripts/cody/clarify-workflow.test.ts` | Update spy targets |

### Modified Config Files (2)
| File | Changes |
|------|---------|
| `.github/workflows/cody.yml` | Direct `pnpm cody`, inline parse logic |
| `package.json` | Update `cody` script path |

### Deleted Source Files (4)
- `scripts/cody/cody.ts`
- `scripts/cody/stage-hooks.ts`
- `scripts/cody/run-cody.sh`
- `scripts/cody/parse-inputs.sh`

### Deleted Test Files (4)
- `tests/unit/scripts/cody.spec.ts`
- `tests/unit/scripts/cody/stage-hooks.test.ts`
- `tests/unit/scripts/cody/bug-exposure.test.ts`
- `tests/unit/scripts/cody/bugfixes.test.ts`
