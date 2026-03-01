# Simplify Cody Orchestration Layer

**Date**: 2026-03-01
**Status**: Draft — awaiting approval before implementation

---

## Context

The Cody pipeline has ~3,500 lines of TypeScript orchestrating OpenCode agents. The initial question was whether to move orchestration into OpenCode's native agent/subagent system. After research, OpenCode has **zero native pipeline capabilities** — it's a single-agent execution tool (`opencode run --agent <stage> <prompt>`). There is no native stage chaining, cross-session state, conditional branching, or parallel execution.

The custom TypeScript orchestration is necessary and the architecture (from the 20260223 state machine rewrite) is sound. However, three areas carry unnecessary complexity that hurts maintainability.

### What We're Doing

Simplify the TypeScript orchestration layer to improve maintainability, without changing the fundamental architecture.

### What We're NOT Doing

- Moving orchestration into LLM prompts (non-deterministic, untestable)
- Using OpenCode's experimental hooks for chaining (fragile, undocumented)
- Changing the state machine core loop (already clean)
- Rewriting handlers (already well-structured)

---

## Change 1: Extract Post-Actions to Individual Modules

### Problem

`post-actions.ts` is a 493-line switch statement with all 12 action implementations inlined. Adding a new action means modifying this growing monolith. Testing individual actions requires reading through the entire file.

### Current Structure

```
scripts/cody/pipeline/
└── post-actions.ts   # 493 lines — everything in one switch
```

### Proposed Structure

```
scripts/cody/pipeline/
├── post-actions.ts                    # REPLACED by post-actions/index.ts
└── post-actions/
    ├── index.ts                       # Registry + executePostAction (~30 lines)
    ├── validate-task-json.ts          # ~15 lines
    ├── resolve-profile.ts             # ~40 lines
    ├── check-gate.ts                  # ~55 lines
    ├── commit-task-files.ts           # ~20 lines
    ├── archive-rerun-feedback.ts      # ~10 lines
    ├── validate-plan-exists.ts        # ~15 lines
    ├── validate-build-content.ts      # ~12 lines
    ├── run-tsc.ts                     # ~12 lines
    ├── run-unit-tests.ts              # ~15 lines
    ├── run-quality-with-autofix.ts    # ~80 lines (most complex action)
    ├── commit-audit-history.ts        # ~20 lines
    └── parallel.ts                    # ~15 lines
```

### Registry Pattern

```typescript
// post-actions/index.ts
import type { PostAction, PipelineContext } from '../engine/types'

type PostActionHandler = (ctx: PipelineContext, action: PostAction, state: unknown) => Promise<void>

const handlers: Record<string, PostActionHandler> = {
  'validate-task-json': (ctx, action, state) => import('./validate-task-json').then(m => m.execute(ctx, action, state)),
  'resolve-profile': (ctx, action, state) => import('./resolve-profile').then(m => m.execute(ctx, action, state)),
  'check-gate': (ctx, action, state) => import('./check-gate').then(m => m.execute(ctx, action, state)),
  // ... etc
}

export async function executePostAction(
  ctx: PipelineContext,
  action: PostAction,
  state: unknown,
): Promise<void> {
  const handler = handlers[action.type]
  if (!handler) {
    console.warn(`Unknown post-action type: ${action.type}`)
    return
  }
  return handler(ctx, action, state)
}
```

Note: Use static imports (not dynamic) to keep tree-shaking and type safety. The dynamic import pattern above is illustrative; actual implementation should use a straightforward map of imported functions:

```typescript
import { execute as validateTaskJson } from './validate-task-json'
import { execute as resolveProfile } from './resolve-profile'
// ...

const handlers = {
  'validate-task-json': validateTaskJson,
  'resolve-profile': resolveProfile,
  // ...
}
```

### Benefits

- Each action is independently readable and testable
- Adding new actions = adding new files, not modifying a switch
- The most complex action (`run-quality-with-autofix`, 80+ lines) gets its own home
- `index.ts` is a simple dispatch table

### Risk

Low. Pure extraction refactor. Existing tests in:
- `tests/unit/scripts/cody/post-actions.test.ts`
- `tests/unit/scripts/cody/pipeline/post-action-feedback-loop.test.ts`
- `tests/unit/scripts/cody/pipeline/build-feedback-loop.integration.test.ts`

All test behavior, not internal structure. They import `executePostAction` from the module path, so we need to update the import path or re-export from the old location.

### Migration Strategy

1. Create `post-actions/` directory with individual modules
2. Create `post-actions/index.ts` with registry
3. Update import in `state-machine.ts`: `from '../pipeline/post-actions'` → `from '../pipeline/post-actions/index'` (or keep same path if we re-export)
4. Delete old `post-actions.ts`
5. Verify all tests pass

---

## Change 2: Eliminate Two-Phase Pipeline Rebuild

### Problem

`pipelineNeedsRebuild` flag on `PipelineContext` + `rebuildPipeline` callback create a confusing flow:

1. Engine starts with an initial pipeline (only spec stages)
2. `taskify` completes and runs `resolve-profile` post-action
3. Post-action sets `ctx.pipelineNeedsRebuild = true`
4. Engine detects the flag in the main loop
5. Engine calls `rebuildPipeline(ctx)` to construct a new pipeline with impl stages
6. Engine continues with the new pipeline

This two-phase construction exists because `taskify` produces `task.json` which determines the pipeline profile (`standard` vs `lightweight`). Since `taskify` is a pipeline stage itself, the pipeline definition doesn't know the profile at construction time.

### Current Code (in state-machine.ts)

```typescript
// Main execution loop
while (true) {
  // Check if pipeline needs rebuilding (two-phase construction)
  if (ctx.pipelineNeedsRebuild && rebuildPipeline) {
    pipeline = rebuildPipeline(ctx)
    ctx.pipelineNeedsRebuild = false
  }
  // ... rest of loop
}
```

### Proposed Fix

**Build the pipeline with ALL stages upfront.** Let skip-conditions handle which stages actually run.

The key insight: the existing `skipIfBelowComplexity` already skips `plan-gap`, `gap`, `auditor`, `apply-audit`, `clarify` for low-complexity tasks. The `skipIfInputQuality` already skips `spec`, `architect`, `build` when input quality is high. The profile distinction only affects **which stages are in the order array** — but if they're all present with proper skip-conditions, the behavior is identical.

**Specifically**:
1. Remove `pipelineNeedsRebuild` from `PipelineContext`
2. Remove `rebuildPipeline` callback from `runPipeline` signature
3. Remove the rebuild check from the main loop
4. In `buildPipeline()`, always include all stages in the order
5. The `resolve-profile` post-action continues to update `ctx.profile` and `ctx.taskDef` (which skip-conditions read)
6. Skip-conditions use `ctx.profile` and `ctx.taskDef` to decide what runs

**Verification needed**: Confirm that for every stage removed from `SPEC_ORDER_LIGHTWEIGHT` and `IMPL_ORDER_LIGHTWEIGHT`, there exists a corresponding skip-condition that would skip it when `ctx.profile === 'lightweight'` or when `ctx.taskDef.complexity` is low.

Current stage differences between profiles:
- `SPEC_ORDER_STANDARD` includes `spec`, `gap` — `SPEC_ORDER_LIGHTWEIGHT` doesn't
- `IMPL_ORDER_STANDARD` includes `plan-gap` — `IMPL_ORDER_LIGHTWEIGHT` doesn't

All three (`spec`, `gap`, `plan-gap`) have `skipIfBelowComplexity` conditions that check `STAGE_COMPLEXITY_THRESHOLDS`. So if the thresholds align with "lightweight" classification, the behavior is preserved.

**Pre-condition check**: Before implementing, verify that `STAGE_COMPLEXITY_THRESHOLDS` for `spec`, `gap`, `plan-gap` match the conditions that make a task "lightweight" via `resolvePipelineProfile()`.

### Risk

Medium. Need careful validation that skip-conditions produce the same effective pipeline as the current profile-based order arrays. Should add integration tests that verify:
- A lightweight task with the unified pipeline skips the same stages as the current `LIGHTWEIGHT` orders
- A standard task runs all stages

### Files Changed

- `scripts/cody/engine/state-machine.ts` — Remove rebuild logic (~10 lines)
- `scripts/cody/engine/types.ts` — Remove `pipelineNeedsRebuild` from `PipelineContext`
- `scripts/cody/pipeline/definitions.ts` — Simplify `buildPipeline`, potentially remove `rebuildPipelineAfterTaskify`
- `scripts/cody/pipeline/post-actions/resolve-profile.ts` — Remove `ctx.pipelineNeedsRebuild = true`
- `scripts/cody/entry.ts` — Remove `rebuildPipelineAfterTaskify` callback from `runPipeline` call

---

## Change 3: Fix Feedback Loop Metrics Breaking Engine's State Ownership

### Problem

In the `run-quality-with-autofix` post-action (`post-actions.ts:392-402`), the action calls `loadState()` and `writeState()` directly to record feedback loop metrics:

```typescript
// Current code — breaks "engine owns state" pattern
if (completedLoops > 0) {
  const currentState = loadState(ctx.taskId)
  if (currentState && currentState.stages?.build) {
    const updatedState = updateStage(currentState, 'build', {
      feedbackLoops: completedLoops,
      feedbackErrors: Array.from(encounteredErrors),
    })
    writeState(ctx.taskId, updatedState)
  }
}
```

This creates a second writer of `status.json` outside the engine, which can cause state drift and makes reasoning about state transitions harder.

### Proposed Fix

Add a `stageMetrics` field to `PipelineContext` that post-actions can write to. The engine reads and incorporates metrics into the state update after executing post-actions.

```typescript
// In engine/types.ts
export interface PipelineContext {
  // ... existing fields
  /** Metrics collected by post-actions, incorporated into state by engine */
  stageMetrics?: Partial<StageStateV2>
}

// In post-action (run-quality-with-autofix.ts):
if (completedLoops > 0) {
  ctx.stageMetrics = {
    feedbackLoops: completedLoops,
    feedbackErrors: Array.from(encounteredErrors),
  }
}

// In state-machine.ts handleStageResult():
if (def.postActions) {
  for (const action of def.postActions) {
    await executePostAction(ctx, action, state)
  }
  // Incorporate any metrics from post-actions
  if (ctx.stageMetrics) {
    state = updateStage(state, stageName, ctx.stageMetrics)
    ctx.stageMetrics = undefined // Reset for next stage
  }
}
```

### Risk

Low. Small, surgical change. Only one post-action currently uses direct state writes.

### Files Changed

- `scripts/cody/engine/types.ts` — Add `stageMetrics` to `PipelineContext`
- `scripts/cody/engine/state-machine.ts` — Read and apply `ctx.stageMetrics` after post-actions
- `scripts/cody/pipeline/post-actions/run-quality-with-autofix.ts` — Write to `ctx.stageMetrics` instead of `loadState/writeState`
- `tests/unit/scripts/cody/engine/feedback-tracking.test.ts` — Update to test new pattern

---

## What We're NOT Changing

These parts are clean and stay as-is:

| Module | Reason |
|--------|--------|
| `engine/state-machine.ts` core loop | Already well-structured deterministic loop |
| `engine/types.ts` | Solid type system with Zod validation |
| `engine/status.ts` | Atomic state persistence with recovery |
| `handlers/*` | Clean `StageHandler` interface pattern |
| `agent-runner.ts` | Complex but necessary (file watching, stability) |
| `runner-backend.ts` | Clean `LocalRunner`/`GitHubRunner` abstraction |
| `skip-conditions.ts` | Pure functions, easily testable |
| `stage-prompts.ts` | Prompt construction — no change needed |
| `definitions.ts` stage configs | Declarative, just cleaner once post-actions are modular |
| All handler implementations | Already well-isolated per handler type |

---

## Estimated Impact

| Metric | Before | After |
|--------|--------|-------|
| `post-actions.ts` | 493 lines, 1 file | ~300 lines across 13 focused files |
| Engine loop (`state-machine.ts`) | Has `pipelineNeedsRebuild` check | Cleaner, ~20 lines removed |
| State writes from post-actions | Direct `loadState`/`writeState` | Via `ctx.stageMetrics` |
| Mental model for new post-action | Read 493-line switch + types | Read one small file + types |
| Net line change | ~493 + ~50 + ~20 = ~563 lines affected | ~300 + ~30 = ~330 lines (net ~230 line reduction) |

---

## Execution Order

| Step | Change | Risk | Dependencies |
|------|--------|------|-------------|
| 1 | Extract post-actions to modules | Low | None |
| 2 | Fix feedback loop metrics | Low | Step 1 (if done as part of extraction) |
| 3 | Verify skip-condition coverage for lightweight profile | Research | None |
| 4 | Eliminate two-phase rebuild | Medium | Step 3 |
| 5 | Update all tests | Parallel with each step | Each step |
| 6 | Quality gates: `tsc --noEmit`, `pnpm test:unit`, `pnpm lint` | N/A | All steps |

---

## Test Files Affected

| Test File | Impact |
|-----------|--------|
| `tests/unit/scripts/cody/post-actions.test.ts` | Update import path |
| `tests/unit/scripts/cody/pipeline/post-action-feedback-loop.test.ts` | Update import path |
| `tests/unit/scripts/cody/pipeline/build-feedback-loop.integration.test.ts` | Update import, verify metrics flow |
| `tests/unit/scripts/cody/engine/feedback-tracking.test.ts` | Update to test `ctx.stageMetrics` pattern |
| `tests/unit/scripts/cody/engine/integration.test.ts` | Verify rebuild removal doesn't break |
| `tests/unit/scripts/cody/lightweight-pipeline.integration.test.ts` | Critical: verify lightweight behavior preserved |
| New: `tests/unit/scripts/cody/post-actions/*.test.ts` | Individual action tests (optional, improves coverage) |

---

## Pre-Implementation Checklist

- [ ] Verify `STAGE_COMPLEXITY_THRESHOLDS` alignment with `resolvePipelineProfile()` for Change 2
- [ ] Run existing test suite to establish baseline: `pnpm vitest run tests/unit/scripts/cody/`
- [ ] Review `entry.ts` for `rebuildPipelineAfterTaskify` usage
- [ ] Confirm no other modules import from `pipeline/post-actions.ts` beyond `state-machine.ts`

---

## Open Questions

1. **Change 2 verification**: Need to check whether `resolvePipelineProfile()` uses complexity score or other heuristics. If it uses heuristics beyond complexity, those need corresponding skip-conditions.
2. **Test granularity**: Should we add per-action unit tests during extraction, or rely on existing integration tests? Per-action tests would improve coverage but add ~100 lines of test code.
3. **Import path compatibility**: Should we re-export `executePostAction` from the old path (`pipeline/post-actions`) to avoid breaking external imports, or update all imports?
