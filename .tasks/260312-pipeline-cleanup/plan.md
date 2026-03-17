# Pipeline Cleanup Plan

## Overview

Three changes: remove dead config, merge commit-fix into commit, add cost tracking.

**Pipeline after changes:**
```
taskify → gap → clarify → architect → plan-gap → build → commit → review → fix → commit(tolerant) → verify → pr
                                                                                                        │
                                                                                                  pass / fail
                                                                                                  │        │
                                                                                                 pr    fix (loop, max 2)
```

**13 stages** (down from 14). `commit` runs twice: once after build (strict), once after fix (tolerant).

---

## Step 1: Remove dead `spec` from opencode.json

**Files:**
- `opencode.json` (MODIFIED) — delete lines 17-20 (`"spec"` agent entry)

**Test:** `pnpm vitest run tests/unit/scripts/cody/agent-subagent-consistency.test.ts --config vitest.config.unit.mts` — no spec.md reference

**Acceptance:**
- [ ] `spec` key gone from opencode.json
- [ ] No test references spec agent config

---

## Step 2: Merge `commit-fix` into `commit`

### Step 2a: Add `tolerant` flag to StageDefinition and GitCommitHandler

**Files:**
- `scripts/cody/engine/types.ts` (MODIFIED ~line 52) — add `tolerant?: boolean` to `StageDefinition`
- `scripts/cody/handlers/git-handler.ts` (MODIFIED ~lines 18-66) — delete `GitCommitFixHandler` class. Modify `GitCommitHandler.execute()` to check `def.tolerant`: if true, treat "No changes" as success
- `scripts/cody/handlers/handler.ts` (MODIFIED ~lines 11, 34) — remove `GitCommitFixHandler` import, remove `case 'commit-fix'`

**Test (FAIL before, PASS after):**
```
// tests/unit/scripts/cody/handlers/git-handler.test.ts (NEW)
describe('GitCommitHandler', () => {
  it('fails on no changes when tolerant is false', ...)
  it('succeeds on no changes when tolerant is true', ...)
})
```

**Acceptance:**
- [ ] `GitCommitFixHandler` class deleted
- [ ] `GitCommitHandler` respects `def.tolerant` flag
- [ ] handler.ts has no `commit-fix` case

### Step 2b: Remove commit-fix from pipeline definitions

**Files:**
- `scripts/cody/pipeline/definitions.ts` (MODIFIED)
  - Remove `'commit-fix'` from `IMPL_ORDER_STANDARD` (~line 50)
  - Remove `'commit-fix'` from `IMPL_ORDER_LIGHTWEIGHT` (~line 61)
  - Remove `'commit-fix'` from `FIX_ORDER` (~line 68)
  - Delete `stages.set('commit-fix', {...})` block (~lines 317-330)
  - Add second `commit` entry with `tolerant: true` after `fix` stage — OR — set `tolerant: true` on the commit definition and rely on pipeline order (commit appears after fix in the verify-fail loop). **Decision: Use tolerant: true always on commit stage. After build, the `validate-src-changes` post-action already catches empty builds before commit runs. So commit tolerating "no changes" is safe — the real guard is the post-action.**

**Actually simpler approach:** Just make `GitCommitHandler` always tolerate "no changes". The `validate-src-changes` post-action on the build stage already catches the case where build produces nothing. By the time commit runs after build, either (a) build made changes and commit will find them, or (b) `validate-src-changes` already failed the pipeline. So commit never needs to be the one that fails on "no changes". This eliminates the need for a `tolerant` flag entirely.

**Revised approach — no tolerant flag needed:**
- `scripts/cody/engine/types.ts` — NO CHANGE
- `scripts/cody/handlers/git-handler.ts` — delete `GitCommitFixHandler`, make `GitCommitHandler` treat "No changes" as `completed` (not `failed`)
- `scripts/cody/handlers/handler.ts` — remove `commit-fix` case

**Files:**
- `scripts/cody/pipeline/definitions.ts` (MODIFIED) — remove commit-fix from all arrays and delete its stage definition
- `scripts/cody/stage-prompts.ts` (MODIFIED) — remove `'commit-fix'` from `ALL_STAGES`, `SCRIPTED_STAGES`, `STAGE_CONTEXT_FILES`, `stageInstructions`
- `scripts/cody/pipeline-utils.ts` (MODIFIED) — remove from `STAGE_COMPLEXITY_THRESHOLDS`, `IMPL_PIPELINE`, `LIGHTWEIGHT_IMPL_PIPELINE`, update comment
- `scripts/cody/agent-runner.ts` (MODIFIED ~line 51) — remove `'commit-fix'` from `STAGE_TIMEOUTS`

**Test (FAIL before, PASS after):**
```
// stage-prompts.test.ts — ALL_STAGES length 14→13, SCRIPTED_STAGES removes commit-fix
expect(ALL_STAGES).toHaveLength(13)
expect([...SCRIPTED_STAGES]).toEqual(['verify', 'commit', 'pr'])
```

**Acceptance:**
- [ ] `commit-fix` not in any stage list
- [ ] ALL_STAGES has 13 entries
- [ ] SCRIPTED_STAGES has 3 entries (verify, commit, pr)

### Step 2c: Update state machine and entry point

**Files:**
- `scripts/cody/engine/state-machine.ts` (MODIFIED ~line 594-602) — verify-fail loop: remove `updateStage(state, 'commit-fix', { state: 'pending' })`. Only reset `fix` + `verify`. Update comment.
- `scripts/cody/entry.ts` (MODIFIED ~line 702-703) — remove `updStage(state, 'commit-fix', { state: 'pending' })`. Update comment.

**Acceptance:**
- [ ] Verify-fail loop resets only `fix` + `verify`
- [ ] Fix-mode init resets only `fix` + `verify`

### Step 2d: Update dashboard UI

**Files:**
- `src/ui/cody/constants.ts` (MODIFIED ~line 18) — remove `'commit-fix'` from `IMPL_STAGES`
- `src/ui/cody/pipeline-utils.ts` (MODIFIED ~lines 24, 43) — remove from `stageLabels` and `stageMaxDurations`

**Acceptance:**
- [ ] Dashboard constants have no commit-fix

### Step 2e: Update config and docs

**Files:**
- `opencode.json` (MODIFIED) — remove `commit-fix` agent entry (lines 82-85)
- `scripts/cody/README.md` (MODIFIED) — update pipeline flow and stage table
- `scripts/cody/engine/pipeline-resolver.ts` (MODIFIED ~line 34) — update comment
- `.opencode/agents/fix.md` (MODIFIED ~line 131) — change "commit-fix stage handles that" → "commit stage handles that"
- `.opencode/agents/cody-expert.md` (MODIFIED ~line 31) — update pipeline flow

### Step 2f: Update all tests

**Files:**
- `tests/unit/scripts/cody/stage-prompts.test.ts` — remove commit-fix from expected arrays, lengths 14→13
- `tests/unit/scripts/cody/lightweight-pipeline.integration.test.ts` — remove from arrays, counts 8→7 and 9→8
- `tests/unit/scripts/cody/pipeline-utils.test.ts` — remove from arrays, counts 9→8 and 8→7
- `tests/int/scripts/cody.int.spec.ts` — remove assertion, update length
- `tests/unit/scripts/cody/analyze-review-findings.test.ts` — remove from mock

**Acceptance:**
- [ ] `pnpm vitest run tests/unit/scripts/cody/ --config vitest.config.unit.mts` — all pass
- [ ] No references to `commit-fix` in source or test files (except git history)

---

## Step 3: Wire up per-stage cost tracking

### Step 3a: Accumulate tokens/cost in agent-runner

**Files:**
- `scripts/cody/agent-runner.ts` (MODIFIED)
  - Add `AgentRunResult.tokenUsage?: { total: number; cacheRead: number }` and `cost?: number`
  - In `runAgentWithFileWatch`: add accumulator vars (`totalTokens`, `totalCost`, `totalCacheRead`)
  - In the stdout parser's `step_finish` case (~line 215): increment accumulators
  - In `finish()` closure (~line 466): include accumulators in resolved `AgentRunResult`

**Test (FAIL before, PASS after):**
```
// tests/unit/scripts/cody/agent-runner.test.ts (MODIFIED)
describe('AgentRunResult', () => {
  it('formatJsonEvent accumulates tokens from step_finish events', () => {
    // Parse mock step_finish events, verify token accumulation
  })
})
```

### Step 3b: Add token/cost fields to types and Zod schema

**Files:**
- `scripts/cody/engine/types.ts` (MODIFIED)
  - Add to `StageResult`: `tokenUsage?: { total: number; cacheRead: number }`, `cost?: number`
  - Add to `StageStateV2`: `tokenUsage?: { total: number; cacheRead: number }`, `cost?: number`
  - Add to `PipelineStateV2`: `totalTokens?: number`, `totalCost?: number`
  - Update `PipelineStateV2Schema` Zod: add optional token/cost fields to stage schema and pipeline schema

**Acceptance:**
- [ ] Types compile with `tsc --noEmit`
- [ ] Zod schema validates status.json with new fields

### Step 3c: Pass token/cost through handlers

**Files:**
- `scripts/cody/handlers/agent-handler.ts` (MODIFIED) — map `AgentRunResult.tokenUsage` and `.cost` → `StageResult.tokenUsage` and `.cost`
- `scripts/cody/handlers/scripted-handler.ts` (MODIFIED) — accumulate token/cost across autofix iterations, return total in `StageResult`

### Step 3d: Persist to status.json

**Files:**
- `scripts/cody/engine/state-machine.ts` (MODIFIED) — in `handleStageResult()` (~line 535) and `executeParallelStep()` (~line 444): include `tokenUsage` and `cost` in `updateStage()` calls
- `scripts/cody/engine/status.ts` (MODIFIED) — in `completeState()`: compute pipeline-level `totalTokens` and `totalCost` by summing all stages. In `stateToV1()`: map `tokenUsage` to V1 `StageStatus.tokenUsage`

### Step 3e: Display cost in success comment

**Files:**
- `scripts/cody/cody-utils.ts` (MODIFIED ~lines 1027-1040) — in `formatStatusComment()` completed state: add cost display per stage and total

**Before:**
```
✅ Cody completed for `260312-test`!
Mode: full

  ✅ taskify (45s)
  ✅ gap (1m 12s)
  ✅ build (3m 30s)
  ✅ verify (1m 05s)
```

**After:**
```
✅ Cody completed for `260312-test`!
Mode: full

| Stage | Status | Elapsed | Cost |
|-------|--------|---------|------|
| taskify | ✅ | 45s | $0.02 |
| gap | ✅ | 1m 12s | $0.05 |
| build | ✅ | 3m 30s | $0.41 |
| commit | ✅ | 12s | — |
| verify | ✅ | 1m 05s | $0.08 |
| **Total** | | **6m 44s** | **$0.56** |
```

Scripted/git stages show `—` for cost.

**Test (FAIL before, PASS after):**
```
// tests/unit/scripts/cody/cody-utils-extended.test.ts or similar
describe('formatStatusComment', () => {
  it('includes cost column in completed pipeline comment', () => {
    const status = mockCompletedStatus({ stages: { build: { tokenUsage: { total: 1000, cacheRead: 200 }, cost: 0.41 } } })
    const comment = formatStatusComment(input, status)
    expect(comment).toContain('$0.41')
    expect(comment).toContain('Cost')
  })
})
```

**Acceptance:**
- [ ] `status.json` contains `tokenUsage` and `cost` per stage after pipeline run
- [ ] `status.json` contains `totalTokens` and `totalCost` at pipeline level
- [ ] Success comment shows cost table
- [ ] Scripted stages show `—` for cost
- [ ] `pnpm verify` passes

---

## Execution Order

1. Step 1 (trivial, 2 min)
2. Step 2a-2f (commit-fix removal, ~30 min)
3. Step 3a-3e (cost tracking, ~30 min)
4. `pnpm verify` + commit + push

## Decision Log

- **No tolerant flag** — `validate-src-changes` post-action on build already catches empty builds. Commit can always tolerate "no changes" safely.
- **Cost from opencode events** — opencode already computes `cost` per step accounting for model pricing. We just accumulate, no need to know rates.
- **V1 compat** — `stateToV1()` maps new fields to the existing `tokenUsage` placeholder in V1 `StageStatus`.
