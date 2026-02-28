# Plan: Cody Pipeline Crash Recovery & Stale State Detection

## Overview

3 steps, ~60-90 minutes total. All changes are in `scripts/cody/` — no Payload, no frontend.

## Assumptions

- `status.json` v2 schema is stable (no schema changes needed)
- Recovery runs synchronously before the main pipeline loop
- The pipeline order (from `definitions.ts`) is the source of truth for "what stages exist"
- A stage is "stale running" if its state is `running` when the pipeline is freshly starting
- Advisory stages (like `auditor`) can fail without failing the pipeline — recovery must respect this

---

### Step 1: Add `recoverStaleStages()` and `recoverPipelineState()` to status.ts (25 min)

**Files to Touch**:
- `scripts/cody/engine/status.ts` (MODIFIED — add 2 new exported functions)
- `tests/unit/cody/status-recovery.test.ts` (NEW)

**Exact Behavior**:

**Function 1: `recoverStaleStages(state: PipelineStateV2): PipelineStateV2`**
- Input: a loaded PipelineStateV2 object
- Scans `state.stages` for any stage with `state: "running"`
- Resets each to `state: "pending"`, clears `startedAt`
- Logs `⚠️ Recovered stale stage <name>: running → pending` for each
- Returns new state object (immutable update pattern, like `updateStage`)
- If no stale stages found, returns input unchanged (identity)

**Function 2: `recoverPipelineState(state: PipelineStateV2, pipelineOrder: string[], advisoryStages: Set<string>): PipelineStateV2`**
- Input: state + flat list of stage names from current pipeline order + set of advisory stage names
- Only runs if `state.state === "running"` (pipeline-level)
- Checks all stages in `pipelineOrder`:
  - If ALL are `completed` or `skipped` → mark pipeline `"completed"` via `completeState()`
  - If ANY non-advisory stage is `"failed"` → mark pipeline `"failed"` via `completeState()`
  - Advisory stages (in `advisoryStages` set) that are `"failed"` are treated as OK — they don't block completion
  - If stages are still `"pending"` or missing → leave as "running" (stages still need to execute)
- Logs `⚠️ Recovered pipeline state: running → <new_state>` when changed
- Returns new state object

**Why `advisoryStages` parameter?** The `auditor` stage has `advisory: true` in `definitions.ts` (line 238). In the normal pipeline, advisory stage failures don't fail the pipeline (see `state-machine.ts` lines 196-199). Recovery must match this behavior. The `status.ts` module doesn't have access to stage definitions, so the caller must pass advisory info.

**Tests** (MUST FAIL before implementation, PASS after):

1. `recoverStaleStages resets running stages to pending`
   - Create state with 3 stages: completed, running, pending
   - Call `recoverStaleStages(state)`
   - Assert: running stage → pending, others unchanged
   - Assert: function returns new object (immutable)

2. `recoverStaleStages is identity when no running stages`
   - Create state with all completed stages
   - Call `recoverStaleStages(state)`
   - Assert: returned state has same stages (no changes)

3. `recoverPipelineState completes pipeline when all stages done`
   - Create state with pipeline `state: "running"` and all stages completed
   - Call `recoverPipelineState(state, ['a', 'b', 'c'], new Set())`
   - Assert: `state.state === "completed"`

4. `recoverPipelineState fails pipeline when non-advisory stage failed`
   - Create state with pipeline `state: "running"`, stage 'b' failed
   - Call `recoverPipelineState(state, ['a', 'b'], new Set())`
   - Assert: `state.state === "failed"`

5. `recoverPipelineState ignores advisory stage failures`
   - Create state with pipeline `state: "running"`, all stages completed except 'auditor' which is failed
   - Call `recoverPipelineState(state, ['a', 'b', 'auditor'], new Set(['auditor']))`
   - Assert: `state.state === "completed"` (advisory failure doesn't block)

6. `recoverPipelineState leaves running if stages still pending`
   - Create state with pipeline `state: "running"`, stages mixed pending/completed
   - Call `recoverPipelineState(state, ['a', 'b', 'c'], new Set())`
   - Assert: `state.state === "running"` (unchanged)

7. `recoverPipelineState ignores stages not in pipeline order`
   - Create state with extra stages (like `autofix`) not in order
   - Call `recoverPipelineState(state, ['a', 'b'], new Set())` (only a, b in order)
   - Assert: recovery only checks a, b — extra stages ignored

8. `recoverPipelineState is no-op when pipeline already completed`
   - Create state with `state: "completed"`
   - Call `recoverPipelineState(state, ['a', 'b'], new Set())`
   - Assert: state unchanged (only acts when pipeline is "running")

**Acceptance Criteria**:
- [FR-001] ✅ `recoverStaleStages` resets running → pending
- [FR-002] ✅ `recoverPipelineState` auto-completes/auto-fails
- [FR-002] ✅ Advisory stage failures don't prevent auto-completion
- [NFR-002] ✅ Both functions are idempotent
- [NFR-003] ✅ Works with existing v2 schema

---

### Step 2: Integrate recovery into `runPipeline()` (15 min)

**Files to Touch**:
- `scripts/cody/engine/state-machine.ts` (MODIFIED — lines 29-40, add recovery call after loadState)
- `tests/unit/cody/state-machine-recovery.test.ts` (NEW)

**Exact Behavior**:

In `runPipeline()`, after `loadState()` returns a non-null state (resume scenario):

```
let state = loadState(ctx.taskId)
if (!state) {
  state = initState(ctx, ctx.input.mode)
} else {
  // NEW: Recover from previous interrupted run
  state = recoverStaleStages(state)
  
  // Build advisory stages set from pipeline definitions
  const advisoryStages = new Set<string>()
  for (const [name, def] of pipeline.stages) {
    if (def.advisory) advisoryStages.add(name)
  }
  
  const flatOrder = flattenPipelineOrder(pipeline.order)
  state = recoverPipelineState(state, flatOrder, advisoryStages)
  writeState(ctx.taskId, state)
  
  // If recovery determined pipeline is already done, return immediately
  if (state.state === 'completed' || state.state === 'failed') {
    return state
  }
}
```

Import `recoverStaleStages` and `recoverPipelineState` from `./status`.
Import `flattenPipelineOrder` from `../pipeline/definitions`.

**Tests** (MUST FAIL before, PASS after):

1. `runPipeline recovers stale running stages on resume`
   - Setup: write a status.json to disk with a stage stuck as "running" and pipeline state "running"
   - Create a minimal pipeline definition with that stage
   - Call `runPipeline()` (the stage handler can be a simple mock that immediately completes)
   - Assert: after runPipeline returns, the stage was re-executed (completed)
   - Assert: pipeline state is "completed"

2. `runPipeline auto-completes pipeline when all stages done on resume`
   - Setup: write a status.json to disk with all stages completed but pipeline "running"
   - Call `runPipeline()`
   - Assert: pipeline state is "completed"
   - Assert: no stage handlers were called (nothing re-executed)

3. `runPipeline starts fresh when no existing state`
   - Setup: ensure no status.json exists for task
   - Call `runPipeline()` with a single-stage pipeline
   - Assert: pipeline starts from scratch, stage executes, pipeline completes
   - Assert: no recovery logs emitted

**Acceptance Criteria**:
- [FR-001] ✅ Pipeline recovers stale stages on startup
- [FR-002] ✅ Pipeline auto-completes when all stages done
- [NFR-001] ✅ Fresh pipelines (no existing state) are unaffected

---

### Step 3: Improve signal handler in entry.ts (15 min)

**Files to Touch**:
- `scripts/cody/entry.ts` (MODIFIED — lines 131-148, improve `cleanupOnSignal`)
- `tests/unit/cody/signal-handler.test.ts` (NEW)

**Exact Behavior**:

Extract cleanup logic into a testable function:

```typescript
// New exported function (testable)
export function buildInterruptedState(
  state: PipelineStateV2, 
  signal: string
): PipelineStateV2 {
  let updated = state
  // Mark all running stages as failed
  for (const [name, stage] of Object.entries(state.stages)) {
    if (stage.state === 'running') {
      updated = updateStage(updated, name, {
        state: 'failed',
        error: `Process interrupted by ${signal}`,
      })
    }
  }
  // Mark pipeline as failed
  return completeState(updated, 'failed')
}
```

Update `cleanupOnSignal` to:
1. Load current state
2. Call `buildInterruptedState(state, signal)` 
3. Write updated state to disk
4. **In CI mode** (when `GITHUB_ACTIONS` env var is set): attempt best-effort commit+push of status.json
   ```
   git add .tasks/<taskId>/status.json
   git commit -m "ci(cody): save interrupted state for <taskId>"
   git push
   ```
   Wrapped in try/catch — failure is logged but doesn't prevent exit
5. Exit with appropriate code

**Tests** (MUST FAIL before, PASS after):

1. `buildInterruptedState marks running stages as failed`
   - Create state with stages: completed, running, running
   - Call `buildInterruptedState(state, 'SIGTERM')`
   - Assert: both running stages → failed with error containing "SIGTERM"
   - Assert: completed stage unchanged
   - Assert: pipeline state is "failed"

2. `buildInterruptedState preserves already-completed stages`
   - Create state with all stages completed, pipeline running
   - Call `buildInterruptedState(state, 'SIGINT')`
   - Assert: no stages changed (none were running)
   - Assert: pipeline state is "failed"

3. `buildInterruptedState includes signal name in error message`
   - Create state with one running stage
   - Call `buildInterruptedState(state, 'SIGTERM')`
   - Assert: error message contains "SIGTERM"

**Acceptance Criteria**:
- [FR-003] ✅ Signal handler marks individual running stages as failed
- [FR-003] ✅ Signal handler attempts commit+push in CI
- [NFR-001] ✅ No impact on normal execution (cleanup only runs on signal)

---

## Test Commands

```bash
# Run all new tests
pnpm test:unit -- tests/unit/cody/status-recovery.test.ts tests/unit/cody/state-machine-recovery.test.ts tests/unit/cody/signal-handler.test.ts

# Type check
pnpm -s tsc --noEmit

# Lint
pnpm -s lint
```

## Final Acceptance Checklist

- [ ] [FR-001] Stale "running" stages reset to "pending" on pipeline startup
- [ ] [FR-002] Pipelines with all stages done auto-complete (respects advisory)
- [ ] [FR-003] Signal handler marks individual stages as failed + commits in CI
- [ ] [NFR-001] Normal pipeline execution unchanged (fresh starts unaffected)
- [ ] [NFR-002] Recovery is idempotent (running twice = same result)
- [ ] [NFR-003] Works with existing v2 status.json format
- [ ] All tests pass: `pnpm test:unit`
- [ ] Type check passes: `pnpm -s tsc --noEmit`
- [ ] Lint passes: `pnpm -s lint`
