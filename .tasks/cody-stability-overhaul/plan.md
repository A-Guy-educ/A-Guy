# Cody Pipeline Stability Overhaul — Implementation Plan

**Task ID**: cody-stability-overhaul
**Generated**: 2026-03-16
**Task Type**: refactor + testing
**Estimated Effort**: ~15h across 4 phases, 29 steps

---

## Research Findings

### File Paths Verified
- ✅ `scripts/cody/stages/registry.ts` — StageName type (line 37), STAGE_NAMES (line 21)
- ✅ `scripts/cody/engine/types.ts` — StageDefinition (line 51), PipelineContext (line 98)
- ✅ `scripts/cody/engine/state-machine.ts` — verify loop lines 612-675, fix timeout lines 699-710
- ✅ `scripts/cody/pipeline/definitions.ts` — verify def lines 331-347, createStageDefinitions
- ✅ `scripts/cody/pipeline/skip-conditions.ts` — 5 skip functions, 153 lines
- ✅ `scripts/cody/handlers/scripted-handler.ts` — ScriptedVerifyHandler, 152 lines
- ✅ `scripts/cody/config/constants.ts` — DEFAULT_MAX_FIX_ATTEMPTS, MAX_GATE_OUTPUT_CHARS
- ✅ `tests/helpers/cody/` — mock-logger.ts, pipeline-test-harness.ts, fixtures.ts, index.ts
- ✅ `tests/unit/scripts/cody/error-handling.test.ts` — 12 mocks, 259 lines
- ✅ `tests/unit/scripts/cody/cody-utils-extended.test.ts` — 33 mocks, 1034 lines
- ✅ `tests/unit/scripts/cody/scripted-stages.test.ts` — 10 mocks, 1462 lines
- ✅ `tests/int/scripts/cody.int.spec.ts` — 797 lines, ghost stages
- ✅ `tests/unit/scripts/cody/pipeline-bugfixes.test.ts` — 509 lines, 4 no-op blocks
- ✅ `tests/unit/scripts/cody/stage-registry.test.ts` — line 50 exact toEqual, line 59 toHaveLength(13)
- ✅ `tests/unit/scripts/cody/stage-prompts.test.ts` — line 45 toEqual, line 51 toEqual, line 74 toHaveLength(14)
- ✅ `tests/unit/scripts/cody/pipeline-utils.test.ts` — line 520 hardcoded count, line 528 ≥9 (already ok)
- ✅ `tests/unit/scripts/cody/lightweight-pipeline.integration.test.ts` — line 132 toHaveLength(7), lines 141/329 toEqual exact
- ✅ `tests/unit/scripts/cody/post-actions.test.ts` — inline mock logger
- ✅ `tests/unit/scripts/cody/pipeline/post-action-feedback-loop.test.ts` — exists
- ✅ `tests/unit/scripts/cody/validate-src-changes.test.ts` — inline mock logger
- 🆕 `scripts/cody/pipeline/verify-failures.ts` — will create
- 🆕 `tests/unit/scripts/cody/cody-pure-utils.test.ts` — will create
- 🆕 `tests/unit/scripts/cody/handlers/verify-handler.test.ts` — will create
- 🆕 `tests/unit/scripts/cody/handlers/pr-handler.test.ts` — will create
- 🆕 `tests/unit/scripts/cody/pipeline/skip-conditions.test.ts` — will create
- 🆕 `tests/unit/scripts/cody/engine/retry-loop.test.ts` — will create
- 🆕 `tests/unit/scripts/cody/engine/parallel-execution.test.ts` — will create
- 🆕 `tests/unit/scripts/cody/handlers/scripted-handler.test.ts` — will create
- 🆕 `tests/unit/scripts/cody/pipeline/verify-failures.test.ts` — will create
- 🆕 `tests/helpers/cody/assertions.ts` — will create
- 🆕 `tests/helpers/cody/TESTING-GUIDELINES.md` — will create
- 🆕 `scripts/lint-test-fragility.ts` — will create

### Patterns Observed
- Registry pattern: `STAGE_NAMES` + `STAGE_REGISTRY` in `registry.ts` is the source of truth
- Stage definitions use factory pattern: `createStageDefinitions()` in `definitions.ts`
- Test helpers centralized in `tests/helpers/cody/` with barrel export
- Existing tests use `vi.mock()` heavily — some files have 5-12 mocks
- `handleStageResult()` in state-machine.ts (line 574) contains hardcoded `'verify'`/`'fix'` logic
- Constants from `scripts/cody/config/constants.ts` are used throughout

### Integration Points
- `STAGES` constant (Step 1.1) will be imported by new tests; existing code migrates incrementally
- `retryWith` (Step 1.2) must extend `StageDefinition` interface in `engine/types.ts`
- `verify-failures.ts` (Step 1.3) extracted from state-machine.ts lines 620-653
- Verify stage definition in `definitions.ts` (line 331) gets `retryWith` property
- State-machine `handleStageResult()` generic retry replaces lines 612-675 + 699-710
- New test files all follow vitest patterns and import from `tests/helpers/cody/`

---

## Reuse Inventory

### Existing Utilities to Reuse
- `createMockLogger()` from `tests/helpers/cody/mock-logger.ts` — use in all new tests
- `createMockPipelineContext()` from `tests/helpers/cody/pipeline-test-harness.ts` — use in integration tests
- `createValidPipelineState()` from `tests/helpers/cody/fixtures.ts` — use for state assertions
- `createValidTaskDefinition()` from `tests/helpers/cody/fixtures.ts` — use for task def mocks
- `createMockRunnerBackend()` from `tests/helpers/cody/pipeline-test-harness.ts` — use for backend mocks
- `DEFAULT_MAX_FIX_ATTEMPTS` from `scripts/cody/config/constants.ts` — use in retry logic
- `MAX_GATE_OUTPUT_CHARS` from `scripts/cody/config/constants.ts` — use in verify-failures.ts
- `updateStage()`, `writeState()` from `scripts/cody/engine/status` — use in retry loop
- `STAGE_NAMES`, `StageName` from `scripts/cody/stages/registry` — use in STAGES constant

### New Utilities (Justified)
- `STAGES` constant: Provides compile-time typo detection & single-point rename — no existing equivalent
- `captureVerifyFailures()`: Extracted from state-machine.ts — keeps engine domain-agnostic
- `assertPipelineContains()` / `expectStageOrder()`: Test assertion helpers — no existing equivalent for pipeline-specific checks
- `lint-test-fragility.ts`: CI lint script — no existing fragility checker

---

## Phase 1: Make the Engine Stage-Agnostic

### Step 1.1 — Add `STAGES` constant to registry.ts

**Files to Touch**:
- `scripts/cody/stages/registry.ts` (MODIFIED — after line 37)

**Behavior**:
Add a `STAGES` constant object mapping PascalCase keys to stage name string values. It must satisfy `Record<string, StageName>` via the `satisfies` keyword. This is purely additive — no existing code changes.

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

**Tests** (FAIL before, PASS after):
- File: `tests/unit/scripts/cody/stage-registry.test.ts`
- Test: `STAGES constant maps all stage names` — import `STAGES`, verify `Object.values(STAGES)` contains all `STAGE_NAMES` entries and vice versa
- Test: `STAGES values match STAGE_NAMES exactly` — verify `new Set(Object.values(STAGES))` equals `new Set(STAGE_NAMES)`

**Acceptance Criteria**:
- [ ] `STAGES` constant exported from `registry.ts`
- [ ] TypeScript compilation succeeds (`pnpm -s tsc --noEmit`)
- [ ] Each `STAGES` value is a valid `StageName`
- [ ] `Object.values(STAGES)` and `STAGE_NAMES` are identical sets

---

### Step 1.2 — Add `retryWith` to StageDefinition

**Files to Touch**:
- `scripts/cody/engine/types.ts` (MODIFIED — after line 76 in StageDefinition)

**Behavior**:
Add an optional `retryWith` property to `StageDefinition`:

```typescript
retryWith?: {
  stage: StageName
  maxAttempts: number
  onFailure?: (ctx: PipelineContext, taskDir: string) => Promise<void>
  onTimeout?: 'retry' | 'fail'
}
```

This is purely additive — no consumers use it yet.

**Tests** (FAIL before, PASS after):
- File: `tests/unit/scripts/cody/engine/retry-loop.test.ts` (created in Step 2.6)
- At this step: typecheck only — the tests reference `retryWith` and would fail to compile without this type

**Acceptance Criteria**:
- [ ] `retryWith` is optional on `StageDefinition`
- [ ] TypeScript compilation succeeds
- [ ] Importing `StageDefinition` and accessing `.retryWith` compiles

---

### Step 1.3 — Create `pipeline/verify-failures.ts`

**Files to Touch**:
- `scripts/cody/pipeline/verify-failures.ts` (NEW)

**Behavior**:
Extract the verify failure capture logic from `state-machine.ts` lines 620-653 into a standalone function:

```typescript
export async function captureVerifyFailures(
  ctx: PipelineContext,
  taskDir: string,
  errorReason?: string
): Promise<void>
```

The function:
1. Reads gate output files: `typescript-output.txt`, `lint-output.txt`, `format-output.txt`, `unit-tests-output.txt`
2. Assembles `verify-failures.md` from header + each gate's output (truncated to `MAX_GATE_OUTPUT_CHARS`)
3. Writes the file to `taskDir/verify-failures.md`
4. Logs a warning if the write fails

Imports `MAX_GATE_OUTPUT_CHARS` from `../config/constants`.

**Tests** (FAIL before, PASS after):
- File: `tests/unit/scripts/cody/pipeline/verify-failures.test.ts` (created in Step 2.9)
- At this step: verify file exists and exports the function

**Acceptance Criteria**:
- [ ] Function extracted to standalone module
- [ ] Imports constants from config, not magic numbers
- [ ] No `'fix'` or `'verify'` stage name hardcoded in the function
- [ ] TypeScript compilation succeeds

---

### Step 1.4 — Wire `retryWith` into verify stage definition

**Files to Touch**:
- `scripts/cody/pipeline/definitions.ts` (MODIFIED — verify stage def around line 331)

**Behavior**:
Add `retryWith` configuration to the verify stage definition:

```typescript
stages.set('verify', {
  name: 'verify',
  type: 'scripted',
  timeout: getStageTimeout('verify'),
  maxRetries: 0,
  retryWith: {
    stage: 'fix',
    maxAttempts: DEFAULT_MAX_FIX_ATTEMPTS,
    onFailure: captureVerifyFailures,
    onTimeout: 'retry',
  },
  postActions: [
    // ... existing postActions
  ],
})
```

Import `captureVerifyFailures` from `./verify-failures` and `DEFAULT_MAX_FIX_ATTEMPTS` from `../config/constants`.

**Tests** (FAIL before, PASS after):
- File: `tests/unit/scripts/cody/engine/retry-loop.test.ts` (Step 2.6)
- At this step: verify pipeline builds without error (typecheck)

**Acceptance Criteria**:
- [ ] Verify stage has `retryWith` pointing to `'fix'`
- [ ] Uses `DEFAULT_MAX_FIX_ATTEMPTS` constant
- [ ] `onFailure` calls `captureVerifyFailures`
- [ ] TypeScript compilation succeeds

---

### Step 1.5 — Replace hardcoded verify-fix loop with generic retry

**Files to Touch**:
- `scripts/cody/engine/state-machine.ts` (MODIFIED — lines 612-675, 699-710)

**Behavior**:

**Part A — Replace verify failure loop (lines 612-675)**:
In `handleStageResult()`, after the `result.outcome === 'failed'` check, replace the `if (stageName === 'verify' && !def.advisory)` block with generic `retryWith` logic:

```typescript
if (result.outcome === 'failed') {
  // Generic declarative retry via retryWith
  if (def.retryWith && !def.advisory) {
    const { stage: retryStage, maxAttempts, onFailure } = def.retryWith
    const retryState = state.stages[retryStage]
    const currentAttempt = retryState?.fixAttempt ?? 0

    if (currentAttempt < maxAttempts) {
      if (onFailure) {
        await onFailure(ctx, ctx.taskDir)
      }
      const newAttempt = currentAttempt + 1
      state = updateStage(state, retryStage, {
        state: 'pending',
        fixAttempt: newAttempt,
        maxFixAttempts: maxAttempts,
      })
      state = updateStage(state, stageName, { state: 'pending' })
      writeState(ctx.taskId, state)
      logger.info(`🔄 ${stageName} failed, looping to ${retryStage} (attempt ${newAttempt}/${maxAttempts})`)
      return state
    } else {
      logger.error(`Max retry attempts (${maxAttempts}) reached for ${retryStage}, pipeline failing`)
    }
  }
  // ... existing normal failure handling (unchanged)
}
```

**Part B — Replace fix timeout recovery (lines 699-710)**:
Replace `if (stageName === 'fix')` with generic lookup:

```typescript
if (result.outcome === 'timed_out') {
  // ... existing state update ...

  // Generic timeout recovery: if any stage declares retryWith pointing to this timed-out stage,
  // reset that stage to pending so it can re-evaluate
  const retryingDef = [...pipeline.stages.values()].find(
    (s) => s.retryWith?.stage === stageName && s.retryWith.onTimeout === 'retry'
  )
  if (retryingDef) {
    logger.info(`⚠️ ${stageName} timed out — running ${retryingDef.name} to check if partial work suffices`)
    state = updateStage(state, retryingDef.name, { state: 'pending' })
    writeState(ctx.taskId, state)
    return state
  }

  // ... existing non-advisory failure handling (unchanged)
}
```

**Important**: `handleStageResult` now needs `pipeline: PipelineDefinition` param for the timeout lookup. Add it to the signature and update the call site in `executeSingleStep` (line 311).

**Tests** (FAIL before, PASS after):
- File: `tests/unit/scripts/cody/engine/retry-loop.test.ts` (Step 2.6) — these tests define stages with `retryWith` and verify the generic loop works

**Acceptance Criteria**:
- [ ] No references to `'verify'` or `'fix'` remain in `state-machine.ts`
- [ ] `handleStageResult` uses `def.retryWith` instead of hardcoded stage names
- [ ] Timeout recovery uses generic `retryWith.onTimeout` lookup
- [ ] Behavior is identical to before for the verify→fix loop
- [ ] TypeScript compilation succeeds

---

### Step 1.6 — Typecheck

**Files to Touch**: None (validation only)

**Command**: `pnpm -s tsc --noEmit`

**Acceptance Criteria**:
- [ ] Zero TypeScript errors
- [ ] All Phase 1 changes compile cleanly

---

## Phase 2: Delete Fragile Tests and Write Resilient Replacements

### Step 2.1 — Delete 5 fragile test files + 4 no-op blocks

**Files to Touch**:
- `tests/unit/scripts/cody/error-handling.test.ts` (DELETE — 259 lines, 12 mocks)
- `tests/unit/scripts/cody/cody-utils-extended.test.ts` (DELETE — 1034 lines, 33 mocks)
- `tests/unit/scripts/cody/scripted-stages.test.ts` (DELETE — 1462 lines, 10 mocks)
- `tests/int/scripts/cody.int.spec.ts` (DELETE — 797 lines, ghost stages)
- `tests/unit/scripts/cody/pipeline-bugfixes.test.ts` (MODIFIED — remove 4 no-op blocks):
  - Lines ~248-274: "CRITICAL 3" block — asserts only that function exists
  - Lines ~448-456: "HIGH 8" block — asserts module exists
  - Lines ~462-472: "HIGH 10" block — asserts function exists
  - Lines ~478-496: "HIGH 11" block — tests `Promise.allSettled` behavior, not our code

**Tests**: Run `pnpm test:unit` to verify remaining tests still pass.

**Acceptance Criteria**:
- [ ] 4 files deleted entirely
- [ ] 4 no-op blocks removed from pipeline-bugfixes.test.ts
- [ ] Remaining test suite passes

---

### Step 2.2 — Create `cody-pure-utils.test.ts`

**Files to Touch**:
- `tests/unit/scripts/cody/cody-pure-utils.test.ts` (NEW)

**Replaces**: Pure-function tests from deleted `cody-utils-extended.test.ts`

**Pattern**: ZERO vi.mock() calls. Import functions directly and test with real inputs/outputs.

**Functions to test** (from `scripts/cody/cody-utils.ts`):
- `parseCommentBody()` — various @cody comment formats
- `formatDuration()` — ms to human-readable string
- `isValidMode()` — valid/invalid mode strings
- `isValidStage()` — valid/invalid stage names (uses `isValidStageName` from registry)
- `formatStatusComment()` — pipeline state to GitHub comment markdown

**Estimated tests**: ~40

**Acceptance Criteria**:
- [ ] Zero `vi.mock()` calls
- [ ] All pure functions from deleted file are covered
- [ ] Tests pass

---

### Step 2.3 — Create `handlers/verify-handler.test.ts`

**Files to Touch**:
- `tests/unit/scripts/cody/handlers/verify-handler.test.ts` (NEW)

**Replaces**: `ScriptedVerifyHandler` tests from deleted `scripted-stages.test.ts`

**Pattern**: ≤2 vi.mock() calls (child_process, git-utils). Test the `ScriptedVerifyHandler` class.

**Test scenarios**:
1. All gates pass → outcome `'completed'`
2. TSC fails → outcome `'failed'` with reason
3. Lint/format fails → autofix loop runs → passes after fix → outcome `'completed'`
4. Autofix exhausted (MAX_AUTOFIX_ATTEMPTS) → outcome `'failed'`
5. Timeout during autofix → outcome `'timed_out'`
6. Commit of autofix changes after successful fix

**Estimated tests**: ~12

**Acceptance Criteria**:
- [ ] ≤2 `vi.mock()` calls
- [ ] Covers all handler outcomes: completed, failed, timed_out
- [ ] Tests autofix loop retry logic
- [ ] Tests pass

---

### Step 2.4 — Create `handlers/pr-handler.test.ts`

**Files to Touch**:
- `tests/unit/scripts/cody/handlers/pr-handler.test.ts` (NEW)

**Replaces**: PR tests from deleted `scripted-stages.test.ts`

**Pattern**: ≤2 vi.mock() calls.

**Test scenarios**:
1. PR created with correct title/body
2. No source changes → appropriate handling
3. GitHub token validation

**Estimated tests**: ~8

**Acceptance Criteria**:
- [ ] ≤2 `vi.mock()` calls
- [ ] Tests pass

---

### Step 2.5 — Create `pipeline/skip-conditions.test.ts`

**Files to Touch**:
- `tests/unit/scripts/cody/pipeline/skip-conditions.test.ts` (NEW)

**NEW coverage** for `scripts/cody/pipeline/skip-conditions.ts` (153 lines, 0 existing direct tests)

**Pattern**: Uses real filesystem (temp dir via `fs.mkdtempSync`). Zero vi.mock() calls.

**Test scenarios**:
1. `skipIfInputQuality`: skip when file exists with valid content; don't skip when stub; don't skip when no file; don't skip when stage not in skip_stages
2. `skipIfClarifyDisabled`: creates `clarified.md`; removes `questions.md`; returns skip
3. `skipIfSpecHasNoOpenQuestions`: skip when no "Open Questions" section; don't skip when section exists; don't skip when no spec file
4. `skipIfSpecOnly`: skip when `pipeline === 'spec_only'`; don't skip otherwise
5. `skipIfBelowComplexity`: skip when below threshold; don't skip when above; don't skip when no complexity

**Estimated tests**: ~15

**Acceptance Criteria**:
- [ ] Zero `vi.mock()` calls — uses real filesystem
- [ ] All 5 skip functions tested
- [ ] Edge cases covered (missing files, empty content, boundary values)
- [ ] Tests pass

---

### Step 2.6 — Create `engine/retry-loop.test.ts`

**Files to Touch**:
- `tests/unit/scripts/cody/engine/retry-loop.test.ts` (NEW)

**NEW coverage** for the declarative retry loop (Phase 1 Step 1.5)

**Pattern**: Uses mock handler (from `tests/helpers/cody/`) and real state machine logic. Mocks: ≤3 (handler, status module, logger).

**Test scenarios**:
1. Stage with `retryWith` fails → retryWith.stage reset to pending → retries → passes → pipeline completes
2. Stage with `retryWith` fails → max attempts reached → pipeline fails
3. `onFailure` callback called with correct args when stage fails
4. retryWith.stage times out with `onTimeout: 'retry'` → source stage reset to pending
5. retryWith.stage times out with `onTimeout: 'fail'` → pipeline fails
6. Stage without `retryWith` → normal failure handling (pipeline fails immediately)

**Estimated tests**: ~10

**Acceptance Criteria**:
- [ ] Tests use `retryWith` property on stage definitions (no hardcoded `'verify'`/`'fix'`)
- [ ] Verifies generic retry mechanism works for any stage pair
- [ ] Tests pass

---

### Step 2.7 — Create `engine/parallel-execution.test.ts`

**Files to Touch**:
- `tests/unit/scripts/cody/engine/parallel-execution.test.ts` (NEW)

**NEW coverage** for `executeParallelStep` in `state-machine.ts` (lines 340-569)

**Pattern**: Mock handler, mock status module, real state machine. ≤3 vi.mock() calls.

**Test scenarios**:
1. All parallel stages pass → both completed in state
2. One critical stage fails → pipeline fails
3. One advisory stage fails → pipeline continues
4. PipelinePausedError in parallel → pipeline paused
5. Post-action failure in parallel stage → collected as failure
6. Session ID propagation (last one wins)

**Estimated tests**: ~10

**Acceptance Criteria**:
- [ ] Tests verify parallel execution semantics
- [ ] Advisory vs critical distinction tested
- [ ] Tests pass

---

### Step 2.8 — Create `handlers/scripted-handler.test.ts`

**Files to Touch**:
- `tests/unit/scripts/cody/handlers/scripted-handler.test.ts` (NEW)

**NEW coverage** for `ScriptedVerifyHandler` class in `scripts/cody/handlers/scripted-handler.ts`

**Pattern**: ≤2 vi.mock() calls (child_process, git-utils). Tests handler interface directly.

**Test scenarios**:
1. `execute()` returns `{ outcome: 'completed' }` when all gates pass first try
2. `execute()` returns `{ outcome: 'failed' }` when gates fail after max autofix attempts
3. `execute()` returns `{ outcome: 'timed_out' }` when timeout exceeded
4. Autofix loop respects `MAX_AUTOFIX_ATTEMPTS` constant
5. Remaining timeout calculated correctly across retries
6. Commit of autofix changes on success

**Note**: This overlaps with Step 2.3 — the build agent should decide if both are needed or merge them.

**Estimated tests**: ~8

**Acceptance Criteria**:
- [ ] Tests the handler class directly (not via pipeline)
- [ ] ≤2 `vi.mock()` calls
- [ ] Tests pass

---

### Step 2.9 — Create `pipeline/verify-failures.test.ts`

**Files to Touch**:
- `tests/unit/scripts/cody/pipeline/verify-failures.test.ts` (NEW)

**NEW coverage** for `captureVerifyFailures()` (from Step 1.3)

**Pattern**: Real filesystem (temp dir). Zero vi.mock() calls.

**Test scenarios**:
1. Writes `verify-failures.md` with all 4 gate outputs present
2. Missing gate output files → graceful fallback (file still written with available gates)
3. Truncates long gate output to `MAX_GATE_OUTPUT_CHARS`
4. File content format: markdown with `## <GateName>` sections and code blocks
5. No gate files exist → writes minimal file with error reason only

**Estimated tests**: ~6

**Acceptance Criteria**:
- [ ] Zero `vi.mock()` calls
- [ ] Tests use real temp directory
- [ ] All edge cases covered
- [ ] Tests pass

---

### Step 2.10 — Typecheck + run all tests

**Files to Touch**: None (validation only)

**Command**: `pnpm -s tsc --noEmit && pnpm test:unit`

**Acceptance Criteria**:
- [ ] Zero TypeScript errors
- [ ] All unit tests pass (old and new)

---

## Phase 3: Make Existing Tests Resilient

### Step 3.1 — Refactor `stage-registry.test.ts`

**Files to Touch**:
- `tests/unit/scripts/cody/stage-registry.test.ts` (MODIFIED)

**Changes**:
- Line 50: Replace `expect([...STAGE_NAMES]).toEqual(expected)` with `toContain` checks for essential stages + `toBeGreaterThanOrEqual(10)` for length
- Line 59-61: Replace `toHaveLength(13)` with `toBeGreaterThanOrEqual(10)`
- Lines 240-246: Keep exact `toHaveLength(3)` and `toHaveLength(2)` for SPEC orders (these are intentionally exact — adding a spec stage is a deliberate architectural change)
- Keep ghost stage assertions (lines 53-57) — they guard against regression

**Tests**: Run `pnpm test:unit -- tests/unit/scripts/cody/stage-registry.test.ts`

**Acceptance Criteria**:
- [ ] No `toHaveLength(13)` for `STAGE_NAMES`
- [ ] Uses `toContain` for essential stages
- [ ] Ghost stage assertions preserved
- [ ] Tests pass

---

### Step 3.2 — Refactor `stage-prompts.test.ts`

**Files to Touch**:
- `tests/unit/scripts/cody/stage-prompts.test.ts` (MODIFIED)

**Changes**:
- Line 45: Replace `toEqual(['taskify', 'gap', 'clarify'])` with individual `toContain` checks
- Line 51: Replace `toEqual(['verify', 'commit', 'pr'])` with individual `toContain` checks
- Line 74: Replace `toHaveLength(14)` with `toBeGreaterThanOrEqual(10)`
- Lines 82-133: Replace exact context file list assertions with `toContain` for critical files + `expect(Array.isArray(...)).toBe(true)`
- Lines 172-213: Replace `toEqual` exact stage lists with `toContain` + ordering assertions (use `indexOf` comparisons)

**Tests**: Run `pnpm test:unit -- tests/unit/scripts/cody/stage-prompts.test.ts`

**Acceptance Criteria**:
- [ ] No `toEqual` with exact stage lists
- [ ] `toContain` for critical stages
- [ ] Ordering assertions preserved where important
- [ ] Tests pass

---

### Step 3.3 — Refactor `pipeline-utils.test.ts`

**Files to Touch**:
- `tests/unit/scripts/cody/pipeline-utils.test.ts` (MODIFIED)

**Changes**:
- Line 520-528: Already uses `toBeGreaterThanOrEqual(9)` — verify and adjust if any exact counts remain
- Scan for any `toHaveLength` with hardcoded pipeline stage counts and replace with `toBeGreaterThanOrEqual`

**Tests**: Run `pnpm test:unit -- tests/unit/scripts/cody/pipeline-utils.test.ts`

**Acceptance Criteria**:
- [ ] No hardcoded stage counts remain
- [ ] Tests pass

---

### Step 3.4 — Refactor `lightweight-pipeline.integration.test.ts`

**Files to Touch**:
- `tests/unit/scripts/cody/lightweight-pipeline.integration.test.ts` (MODIFIED)

**Changes**:
- Line 132: Replace `toHaveLength(7)` with `toBeGreaterThanOrEqual(5)` (lightweight impl pipeline)
- Lines 141-150: Replace `toEqual(['architect', 'test', ...])` with `toContain` for each + ordering via `indexOf`
- Lines 176-179: Replace `toHaveLength(8)` with `toBeGreaterThanOrEqual(6)`
- Lines 289-296: Replace `toHaveLength(9)` with `toBeGreaterThanOrEqual(7)` (standard impl pipeline)
- Lines 329-338: Replace `toEqual([...exact list...])` with `toContain` + ordering + minimum length

**Tests**: Run `pnpm test:unit -- tests/unit/scripts/cody/lightweight-pipeline.integration.test.ts`

**Acceptance Criteria**:
- [ ] No exact `toHaveLength` with pipeline stage counts
- [ ] No `toEqual` with full stage lists
- [ ] Essential stages verified via `toContain`
- [ ] Ordering verified via `indexOf` comparisons
- [ ] Tests pass

---

### Step 3.5 — Refactor `post-actions.test.ts` and `post-action-feedback-loop.test.ts`

**Files to Touch**:
- `tests/unit/scripts/cody/post-actions.test.ts` (MODIFIED)
- `tests/unit/scripts/cody/pipeline/post-action-feedback-loop.test.ts` (MODIFIED)

**Changes**:
- Replace inline mock logger definitions with `createMockLogger()` from `tests/helpers/cody/mock-logger.ts`
- In `post-actions.test.ts`: Replace the `vi.hoisted` logger mock (lines 39-60) with import from shared helper
- In `post-action-feedback-loop.test.ts`: Same pattern — use shared mock logger

**Tests**: Run both test files

**Acceptance Criteria**:
- [ ] No inline mock logger definitions
- [ ] Uses shared `createMockLogger()`
- [ ] Tests pass

---

### Step 3.6 — Refactor `validate-src-changes.test.ts`

**Files to Touch**:
- `tests/unit/scripts/cody/validate-src-changes.test.ts` (MODIFIED)

**Changes**:
- Use shared `createMockLogger()` if it has an inline logger mock
- Remove any hardcoded stage counts or names

**Tests**: Run `pnpm test:unit -- tests/unit/scripts/cody/validate-src-changes.test.ts`

**Acceptance Criteria**:
- [ ] Uses shared helpers where applicable
- [ ] Tests pass

---

### Step 3.7 — Clean `pipeline-bugfixes.test.ts`

**Files to Touch**:
- `tests/unit/scripts/cody/pipeline-bugfixes.test.ts` (MODIFIED)

**Changes**: Delete the 4 no-op test blocks identified in Step 2.1:
- "CRITICAL 3" (~lines 248-274)
- "HIGH 8" (~lines 448-456)
- "HIGH 10" (~lines 462-472)
- "HIGH 11" (~lines 478-496)

**Note**: This is the same action as Step 2.1 for this file — just listed separately for clarity. The build agent should do this once.

**Tests**: Run `pnpm test:unit -- tests/unit/scripts/cody/pipeline-bugfixes.test.ts`

**Acceptance Criteria**:
- [ ] 4 no-op blocks removed
- [ ] Remaining tests still pass

---

### Step 3.8 — Typecheck + run all tests

**Files to Touch**: None (validation only)

**Command**: `pnpm -s tsc --noEmit && pnpm test:unit`

**Acceptance Criteria**:
- [ ] Zero TypeScript errors
- [ ] All tests pass

---

## Phase 4: Test Infrastructure

### Step 4.1 — Enhance `tests/helpers/cody/pipeline-test-harness.ts`

**Files to Touch**:
- `tests/helpers/cody/pipeline-test-harness.ts` (MODIFIED)

**Add**:
- `createTestPipeline(mode, profile, ctx)` — wraps `buildPipeline()` from definitions.ts for testing
- `createMockHandler(outcomes?)` — creates a mock handler with configurable per-stage outcomes (returns `StageResult`)
- `assertPipelineValid(pipeline)` — validates all stages are valid, no duplicates, no ghost stages

**Update barrel export** in `tests/helpers/cody/index.ts`.

**Tests**: Existing + new tests use these helpers (validated in Phase 2 tests)

**Acceptance Criteria**:
- [ ] 3 new helper functions exported
- [ ] Barrel export updated
- [ ] TypeScript compilation succeeds

---

### Step 4.2 — Add assertion helpers to `tests/helpers/cody/assertions.ts`

**Files to Touch**:
- `tests/helpers/cody/assertions.ts` (NEW)

**Functions**:
- `expectPipelineContains(pipeline, stage)` — asserts stage exists in pipeline.order (flattened)
- `expectStageOrder(pipeline, before, after)` — asserts `before` comes before `after` in flattened order
- `expectMinimumStages(pipeline, min)` — asserts flattened pipeline has at least `min` stages
- `expectNoGhostStages(pipeline)` — asserts no stage references `'spec'`, `'autofix'`, or `'reflect'`

**Update barrel export** in `tests/helpers/cody/index.ts`.

**Acceptance Criteria**:
- [ ] 4 assertion helpers exported
- [ ] Each uses vitest `expect` internally
- [ ] Barrel export updated

---

### Step 4.3 — Create `tests/helpers/cody/TESTING-GUIDELINES.md`

**Files to Touch**:
- `tests/helpers/cody/TESTING-GUIDELINES.md` (NEW)

**Content**:
- Max 3 `vi.mock()` calls per file
- Use `toContain` / `toBeGreaterThanOrEqual` not `toEqual` / `toHaveLength` for stage assertions
- Use shared helpers from `tests/helpers/cody/`
- Use `STAGES` constants from `registry.ts`, never raw string literals in new tests
- No ghost stage references (`'spec'`, `'autofix'`, `'reflect'`)
- Prefer integration tests over unit tests
- Test file naming convention

**Acceptance Criteria**:
- [ ] Guidelines document created
- [ ] Covers all patterns from this overhaul

---

### Step 4.4 — Create `scripts/lint-test-fragility.ts`

**Files to Touch**:
- `scripts/lint-test-fragility.ts` (NEW)
- `package.json` (MODIFIED — add `"lint:test-fragility"` script)

**Behavior**:
Scans test files in `tests/unit/scripts/cody/` for fragility patterns:
1. `toHaveLength(N)` where N is 7-15 (near pipeline stage counts) — ERROR
2. `toEqual([...` with 5+ stage names — WARNING
3. `vi.mock()` count > 4 per file — WARNING
4. String literals `'spec'`, `'autofix'`, `'reflect'` (ghost stages) — ERROR
5. Reports violations with file:line references

Exit code 1 on ERRORs, 0 on warnings-only.

Wire into `package.json`: `"lint:test-fragility": "tsx scripts/lint-test-fragility.ts"`

**Tests**: Run the script against the codebase — should pass after Phase 3 refactoring

**Acceptance Criteria**:
- [ ] Script detects fragile patterns
- [ ] ERRORs for ghost stages and hardcoded stage counts
- [ ] WARNINGs for heavy mocking
- [ ] `pnpm lint:test-fragility` exits 0 after all phases complete

---

### Step 4.5 — Final validation

**Files to Touch**: None (validation only)

**Command**: `pnpm -s tsc --noEmit && pnpm test:unit && pnpm lint:test-fragility`

**Acceptance Criteria**:
- [ ] Zero TypeScript errors
- [ ] All unit tests pass
- [ ] Fragility lint passes
- [ ] Net test count: original minus ~95 (from ~1148 to ~1053), but coverage of critical paths significantly improved

---

## Summary

| Phase | Steps | Files Created | Files Modified | Files Deleted | Tests Lost | Tests Gained |
|-------|-------|---------------|----------------|---------------|------------|--------------|
| 1     | 6     | 1             | 3              | 0             | 0          | 0            |
| 2     | 10    | 8             | 1              | 4             | ~200       | ~109         |
| 3     | 8     | 0             | 7              | 0             | ~4         | 0            |
| 4     | 5     | 3             | 2              | 0             | 0          | 0            |
| **Total** | **29** | **12**   | **13**         | **4**         | **~204**   | **~109**     |

**Key outcome**: Adding a new pipeline stage will require updating **0-2 test files** instead of the current **15+**.
