# Cody Pipeline Stability Overhaul — Execution Plan

## Problem

Every architectural change to the Cody pipeline breaks tests. The test suite has 1,148 test cases across 57 files, but many are brittle:
- 188 hardcoded stage name strings across 20 source files
- Tests assert on exact stage counts (`toHaveLength(13)`) and names
- 5 files use 5-11 `vi.mock()` calls, testing mock orchestration instead of behavior
- Fix-verify loop hardcoded in state-machine.ts with raw string literals
- No test coverage on critical paths: skip-conditions, scripted-handler, verify-fix loop, parallel execution
- Ghost stage references (`'spec'` that was merged into `'gap'`)

## Root Causes (ranked by impact)

1. **Stage names are raw string literals** — 188 occurrences across 20 source files, ~15 test files
2. **Tests assert on exact stage counts and names** — `toHaveLength(13)`, `toEqual(['taskify', 'gap', ...])`
3. **Heavy mocking** — 5 files use 5-11 `vi.mock()` calls, testing mock orchestration instead of behavior
4. **Fix-verify loop hardcoded in engine** — Domain-specific stage names in the "generic" state machine
5. **No test coverage on critical paths** — skip-conditions, scripted-handler, verify-fix loop, parallel execution
6. **Ghost stage references** — Tests still reference `'spec'` stage that was merged into `'gap'` months ago

---

## Phase 1: Make the Engine Stage-Agnostic

### Step 1.1 — Add `STAGES` constant to registry.ts
**File**: `scripts/cody/stages/registry.ts`
**Action**: Add after line 37 (`export type StageName = ...`):
```typescript
export const STAGES = {
  TASKIFY: 'taskify',
  GAP: 'gap',
  CLARIFY: 'clarify',
  ARCHITECT: 'architect',
  PLAN_GAP: 'plan-gap',
  TEST: 'test',
  BUILD: 'build',
  COMMIT: 'commit',
  REVIEW: 'review',
  FIX: 'fix',
  VERIFY: 'verify',
  DOCS: 'docs',
  PR: 'pr',
} as const satisfies Record<string, StageName>
```
This is purely additive — zero breakage risk.

### Step 1.2 — Add `retryWith` to StageDefinition
**File**: `scripts/cody/engine/types.ts`
**Action**: Add to `StageDefinition` interface (after line 76):
```typescript
/**
 * Declarative retry loop: when this stage fails, reset both this stage
 * and `retryWith.stage` to pending, up to `retryWith.maxAttempts` times.
 */
retryWith?: {
  stage: StageName
  maxAttempts: number
  /** Called before retry to capture failure details (e.g., write verify-failures.md) */
  onFailure?: (ctx: PipelineContext, taskDir: string) => Promise<void>
  /** When the retryWith.stage times out: 'retry' resets this stage to pending; 'fail' fails the pipeline */
  onTimeout?: 'retry' | 'fail'
}
```

### Step 1.3 — Create `pipeline/verify-failures.ts`
**File**: New file `scripts/cody/pipeline/verify-failures.ts`
**Action**: Extract lines 620-653 from `state-machine.ts` into:
```typescript
export async function captureVerifyFailures(ctx: PipelineContext, taskDir: string): Promise<void>
```
This function reads the 4 gate output files (`typescript-output.txt`, `lint-output.txt`, `format-output.txt`, `unit-tests-output.txt`), assembles the `verify-failures.md` content, and writes it. The hardcoded gate file names live in this domain-specific file, not the engine.

### Step 1.4 — Wire `retryWith` into verify stage definition
**File**: `scripts/cody/pipeline/definitions.ts`
**Action**: Update the verify stage definition (lines 331-347) to add:
```typescript
retryWith: {
  stage: 'fix',
  maxAttempts: DEFAULT_MAX_FIX_ATTEMPTS,
  onFailure: captureVerifyFailures,
  onTimeout: 'retry',
},
```

### Step 1.5 — Replace hardcoded logic in state-machine.ts with generic retry
**File**: `scripts/cody/engine/state-machine.ts`
**Action**: Replace lines 612-675 (verify-specific retry loop) and lines 699-710 (fix timeout recovery) with ~20 lines of generic logic:
```typescript
// Generic retry loop via declarative retryWith
if (def.retryWith) {
  const { stage: retryStage, maxAttempts, onFailure } = def.retryWith
  const currentAttempt = state.stages[retryStage]?.fixAttempt ?? 0
  if (currentAttempt < maxAttempts) {
    if (onFailure) await onFailure(ctx, ctx.taskDir)
    state = updateStage(state, retryStage, {
      state: 'pending',
      fixAttempt: currentAttempt + 1,
      maxFixAttempts: maxAttempts,
    })
    state = updateStage(state, stageName, { state: 'pending' })
    writeState(ctx.taskId, state)
    return state
  }
}
```

And for the timeout path (lines 692-710), replace the `if (stageName === 'fix')` block with:
```typescript
// Check if any stage has retryWith pointing to this timed-out stage
const retryingStage = [...pipeline.stages.values()].find(
  s => s.retryWith?.stage === stageName && s.retryWith.onTimeout === 'retry'
)
if (retryingStage) {
  state = updateStage(state, retryingStage.name, { state: 'pending' })
  writeState(ctx.taskId, state)
  return state
}
```

**Net result**: ~100 lines of hardcoded `'fix'`/`'verify'` logic → ~20 lines of generic retry logic. Zero behavior change.

### Step 1.6 — Typecheck
**Command**: `pnpm -s tsc --noEmit`
**Purpose**: Verify Phase 1 compiles cleanly before touching tests.

---

## Phase 2: Delete and Rewrite Fragile Tests

### Step 2.1 — Delete 5 test files
**Files to delete**:
1. `tests/unit/scripts/cody/error-handling.test.ts` (8 tests, 12 mocks)
2. `tests/unit/scripts/cody/cody-utils-extended.test.ts` (92 tests, 33 mocks)
3. `tests/unit/scripts/cody/scripted-stages.test.ts` (76 tests, 10 mocks, 1462 lines)
4. `tests/int/scripts/cody.int.spec.ts` (28 tests, ghost stages)
5. Partial delete from `tests/unit/scripts/cody/pipeline-bugfixes.test.ts` — remove 4 no-op test blocks: "CRITICAL 3" (lines ~252-274), "HIGH 8" (lines ~448-456), "HIGH 10" (lines ~462-472), "HIGH 11" (lines ~478-496)

### Step 2.2 — Create `tests/unit/scripts/cody/cody-pure-utils.test.ts`
**Replaces**: Pure-function tests from deleted `cody-utils-extended.test.ts`
**Pattern**: Zero mocks. Tests `parseCommentBody`, `formatDuration`, `isValidMode`, `isValidStage`, `formatStatusComment`.
**Estimated tests**: ~40

### Step 2.3 — Create `tests/unit/scripts/cody/handlers/verify-handler.test.ts`
**Replaces**: `ScriptedVerifyHandler` tests from deleted `scripted-stages.test.ts`
**Pattern**: ≤2 mocks (child_process, git-utils). Tests:
- All gates pass → completed
- TSC fails → failed with reason
- Lint/format fails → autofix loop runs → passes after fix
- Autofix exhausted → failed
- Timeout during autofix → timed_out
- Commit of autofix changes
**Estimated tests**: ~12

### Step 2.4 — Create `tests/unit/scripts/cody/handlers/pr-handler.test.ts`
**Replaces**: PR tests from deleted `scripted-stages.test.ts`
**Pattern**: ≤2 mocks. Tests:
- PR created with correct title/body
- No source changes → skip with message
- Token validation
**Estimated tests**: ~8

### Step 2.5 — Create `tests/unit/scripts/cody/pipeline/skip-conditions.test.ts`
**NEW coverage** for `pipeline/skip-conditions.ts` (153 lines, 0 existing direct tests)
**Pattern**: Uses real filesystem (temp dir). Tests:
- `skipIfInputQuality`: skip when file exists with valid content, don't skip when stub, don't skip when no file
- `skipIfClarifyDisabled`: creates `clarified.md`, removes `questions.md`, returns skip
- `skipIfSpecHasNoOpenQuestions`: skip when no "Open Questions" section, don't skip when section exists
- `skipIfSpecOnly`: skip when `pipeline === 'spec_only'`
- `skipIfBelowComplexity`: skip when below threshold, don't skip when above, don't skip when no complexity
**Estimated tests**: ~15

### Step 2.6 — Create `tests/unit/scripts/cody/engine/retry-loop.test.ts`
**NEW coverage** for the declarative retry loop (Phase 1 refactor)
**Pattern**: Uses the engine integration test pattern (real filesystem, mock handler). Tests:
- Verify fails → fix+verify reset to pending → fix runs → verify passes → pipeline completes
- Verify fails → max attempts reached → pipeline fails
- `onFailure` callback called with correct args
- Fix times out with `onTimeout: 'retry'` → verify reset to pending
- Fix times out with `onTimeout: 'fail'` → pipeline fails
- `retryWith` not defined → normal failure handling
**Estimated tests**: ~10

### Step 2.7 — Create `tests/unit/scripts/cody/engine/parallel-execution.test.ts`
**NEW coverage** for `executeParallelStep` in state-machine.ts
**Pattern**: Mock handler, real state machine. Tests:
- All parallel stages pass → completed
- One critical stage fails → pipeline fails
- One advisory stage fails → pipeline continues
- PipelinePausedError in parallel → pipeline paused
- Post-action failure in parallel stage
- Session ID propagation (last one wins)
**Estimated tests**: ~10

### Step 2.8 — Create `tests/unit/scripts/cody/handlers/scripted-handler.test.ts`
**NEW coverage** for `ScriptedVerifyHandler` class directly
**Pattern**: ≤2 mocks (child_process, git-utils). Tests the handler class interface:
- `execute()` returns correct `StageResult` for pass/fail/timeout
- Autofix loop respects `MAX_AUTOFIX_ATTEMPTS`
- Remaining timeout calculated correctly across retries
- Commit of autofix changes on success
**Estimated tests**: ~8

### Step 2.9 — Create `tests/unit/scripts/cody/pipeline/verify-failures.test.ts`
**NEW coverage** for the extracted `captureVerifyFailures` function (from Step 1.3)
**Pattern**: Real filesystem (temp dir). Tests:
- Writes `verify-failures.md` with all 4 gate outputs
- Missing gate output files → graceful fallback
- Truncates long gate output to `MAX_GATE_OUTPUT_CHARS`
- File content format matches expected markdown structure
**Estimated tests**: ~6

### Step 2.10 — Typecheck + run all tests
**Command**: `pnpm -s tsc --noEmit && pnpm test:unit && pnpm test:canary`

---

## Phase 3: Make Existing Tests Resilient

### Step 3.1 — Refactor `stage-registry.test.ts`
**File**: `tests/unit/scripts/cody/stage-registry.test.ts`
**Changes**:
- Lines 34-51: Replace `toEqual(exact 13-element array)` with `toContain` checks for essential stages + minimum length
- Line 59: Replace `toHaveLength(13)` with `toBeGreaterThanOrEqual(10)`
- Lines 240-246: Replace exact order length assertions with `toBeGreaterThanOrEqual`
- Keep the ghost stage assertions (lines 53-57) — those are valuable guards

### Step 3.2 — Refactor `stage-prompts.test.ts`
**File**: `tests/unit/scripts/cody/stage-prompts.test.ts`
**Changes**:
- Line 46: Replace `toEqual(['taskify', 'gap', 'clarify'])` with `toContain` for each
- Line 51: Replace `toEqual(['verify', 'commit', 'pr'])` with `toContain` for each
- Line 74: Replace `toHaveLength(14)` with `toBeGreaterThanOrEqual(10)`
- Lines 82-133: Replace exact context file list assertions with `toContain` for critical files + minimum length
- Lines 172-213: Replace `toEqual` exact lists with `toContain` + ordering assertions

### Step 3.3 — Refactor `pipeline-utils.test.ts`
**File**: `tests/unit/scripts/cody/pipeline-utils.test.ts`
**Changes**:
- Lines 520-528: Replace hardcoded stage count with structural assertion
- Any `toHaveLength(14)` or similar → `toBeGreaterThanOrEqual`

### Step 3.4 — Refactor `lightweight-pipeline.integration.test.ts`
**File**: `tests/unit/scripts/cody/lightweight-pipeline.integration.test.ts`
**Changes**:
- Lines 127-132: Replace `toHaveLength(7)` with `toBeGreaterThanOrEqual(5)`
- Lines 140-150, 176-179, 290-296: Replace exact stage lists with `toContain` + ordering
- Lines 329-338: Replace `toEqual([...exact list...])` with structural checks

### Step 3.5 — Refactor `post-actions.test.ts` and `post-action-feedback-loop.test.ts`
**Files**: Both in `tests/unit/scripts/cody/`
**Changes**: Replace inline mock logger with shared `createMockLogger()` from `tests/helpers/cody/mock-logger.ts`

### Step 3.6 — Refactor `validate-src-changes.test.ts`
**File**: `tests/unit/scripts/cody/validate-src-changes.test.ts`
**Changes**: Extract the core validation logic check into simpler assertions; use shared `createMockLogger()`

### Step 3.7 — Clean `pipeline-bugfixes.test.ts`
**File**: `tests/unit/scripts/cody/pipeline-bugfixes.test.ts`
**Changes**: Delete the 4 no-op test blocks identified in Step 2.1

### Step 3.8 — Typecheck + run all tests
**Command**: `pnpm -s tsc --noEmit && pnpm test:unit && pnpm test:canary`

---

## Phase 4: Test Infrastructure

### Step 4.1 — Enhance `tests/helpers/cody/pipeline-test-harness.ts`
**Add**:
- `createTestPipeline(mode, profile)` — creates a real pipeline from `buildPipeline()` for testing
- `createMockHandler(outcomes?)` — creates a handler mock with configurable per-stage outcomes
- `assertPipelineValid(pipeline)` — validates all stages are valid, no duplicates, no ghosts

### Step 4.2 — Add assertion helpers to `tests/helpers/cody/assertions.ts`
**New file** with:
- `expectPipelineContains(pipeline, stage)` — asserts stage exists in pipeline
- `expectStageOrder(pipeline, before, after)` — asserts ordering
- `expectMinimumStages(pipeline, min)` — asserts minimum stage count

### Step 4.3 — Create `tests/helpers/cody/TESTING-GUIDELINES.md`
**Purpose**: Document the testing patterns for future contributors:
- Max 3 `vi.mock()` calls per file
- Use `toContain` / `toBeGreaterThan` not `toEqual` / `toHaveLength` for stage assertions
- Use shared helpers from `tests/helpers/cody/`
- Use `STAGES` constants, never raw string literals in new tests
- No ghost stage references

### Step 4.4 — Create `scripts/lint-test-fragility.ts`
**Purpose**: Automated CI check that scans test files for:
- `toHaveLength(N)` where N is near `STAGE_NAMES.length`
- Raw stage name strings not from imports
- `vi.mock()` count > 4 per file (warning)
- Ghost stage string literals (`'spec'`, `'autofix'`)

**Wire into**: `package.json` as `"lint:test-fragility"` script

### Step 4.5 — Final validation
**Command**: `pnpm -s tsc --noEmit && pnpm test:unit && pnpm test:canary && pnpm lint:test-fragility`

---

## Summary

| Phase | Steps | Files Created | Files Modified | Files Deleted | Tests Lost | Tests Gained |
|-------|-------|---------------|----------------|---------------|------------|--------------|
| 1 | 6 | 1 | 4 | 0 | 0 | 0 |
| 2 | 10 | 8 | 0 | 5 | ~200 | ~109 |
| 3 | 8 | 0 | 7 | 0 | ~4 | 0 |
| 4 | 5 | 3 | 1 | 0 | 0 | 0 |
| **Total** | **29** | **12** | **12** | **5** | **~204** | **~109** |

Net test count drops by ~95, but the remaining tests are *resilient* — adding a pipeline stage will require updating **0-2 test files** instead of the current **15+**. The 109 new tests cover 4 previously-untested critical paths (skip-conditions, retry loop, parallel execution, scripted handler).

---

> **NOTE**: A RADICAL v2 plan exists that goes much further. See `.tasks/cody-stability-overhaul-plan-v2.md` for a unified stage configuration that consolidates ALL stage settings into a single file, auto-generates tests from config, and eliminates all hardcoded stage logic from the engine.

## Risk-Effort-Value Table

| # | Fix | Risk | Effort | Value |
|---|-----|------|--------|-------|
| **1a** | Declarative `retryWith` in StageDefinition — move fix-verify loop out of state-machine.ts | Medium — touches the core engine loop | ~2h | **High** — eliminates 100 lines of hardcoded stage names from the engine; future retry patterns are declarative |
| **1b** | Extract verify-failure capture to `pipeline/verify-failures.ts` | Low — pure extraction, no behavior change | ~30m | Medium — removes hardcoded gate output filenames from engine |
| **1c** | Add `STAGES` constant object in registry.ts | Low — additive, no existing code breaks | ~30m | **High** — single-point rename for stage names; compile-time typo detection; incremental adoption |
| **2a** | Delete 5 fragile test files (296 tests) | Medium — temporary coverage drop | ~15m | **High** — removes the tests that break on every change |
| **2b** | Rewrite deleted tests with ≤3 mocks each | Low — new code, no side effects | ~3h | **High** — restores coverage with resilient patterns |
| **2c** | New tests for uncovered critical paths (skip-conditions, verify-fix loop, parallel exec, scripted-handler) | Low — additive | ~2h | **Very High** — these are the most-broken areas with zero tests today |
| **3** | Refactor 8 test files: replace hardcoded stage counts/names with structural assertions | Low — only changes assertions, not behavior | ~2h | **High** — adding a stage stops cascading 15+ test failures |
| **4a** | Enhanced pipeline test harness (createTestPipeline, createMockHandler, assertPipelineValid) | Low — additive helper code | ~1h | Medium — makes future tests resilient by default |
| **4b** | Stage-name-free assertion helpers | Low — additive | ~30m | Medium — DRY pattern for pipeline assertions |
| **4c** | Contract test template + guidelines doc | Low — documentation only | ~15m | Medium — prevents regression to fragile patterns |
| **4d** | CI lint rule for test fragility patterns | Low — additive check | ~45m | Medium — automated guard against `toHaveLength(13)` etc. |

### Highest bang-for-buck (if you want to prioritize):

1. **1c + 3** — `STAGES` constant + refactor assertions. Low risk, ~2.5h, kills the "adding a stage breaks 15 tests" problem immediately.
2. **2a + 2b** — Delete/rewrite fragile tests. Medium risk, ~3h, removes the tests that cause 80% of post-change pain.
3. **2c** — New tests for uncovered paths. Low risk, ~2h, prevents the "fix one thing, break another" cycle in the most fragile areas.
4. **1a** — Declarative retry. Medium risk, ~2h, but the highest long-term architectural payoff.
