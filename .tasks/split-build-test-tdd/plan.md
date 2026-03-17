# Plan: Split Build into Parallel Test + Build (TDD via OpenCode Server)

## Summary

Split the current monolithic `build` pipeline stage into two **parallel** stages — `test` (TDD test-writing) and `build` (implementation) — running them concurrently via the pipeline's existing `{ parallel: [...] }` mechanism. The OpenCode server enables this by allowing **multiple concurrent agent sessions** that attach to the same server, sharing the warm project context cache.

### Why We Can Now Run Them in Parallel

**Before (no server):** Each agent stage spawns a standalone `opencode` process. Each process:
- Cold-loads the entire project context from disk (~15-30s startup)
- Has **zero shared state** with other agents
- Cannot coordinate — if test-writer and build ran in parallel, they'd both write to the same source files blindly, creating race conditions

**After (OpenCode server via `opencode serve`):** A persistent server process provides:
1. **Shared project cache**: Both agents `--attach` to the same server URL. The server maintains an in-memory project index/file cache. The second agent to connect gets a **warm cache hit** instead of cold-loading — saving ~15-30s per agent.
2. **Concurrent sessions**: The server handles multiple `opencode run --attach` clients simultaneously, each in its own session. No race condition on the server side.
3. **Session forking** (`--session <id> --fork`): After parallel stages complete, downstream stages (review, fix) can fork from either session to inherit context.

**The key insight**: Test-writer and build don't actually conflict because they write to **different file paths**:
- Test-writer: writes to `tests/unit/**` and `tests/int/**`
- Build: writes to `src/**`
- The only shared file is `plan.md` (read-only for both)

The parallel pattern already exists in the pipeline — `{ parallel: ['docs', 'reflect'] }` uses `Promise.allSettled()` in `state-machine.ts:executeParallelStep()`. We just apply the same pattern to `{ parallel: ['test', 'build'] }`.

### Estimated Time Reduction

Based on historical build stage data (11 completed tasks):

| Metric | Current (Sequential) | Parallel Test+Build | Savings |
|--------|---------------------|---------------------|---------|
| **Build stage avg** | 12.4 min | N/A (split below) | — |
| **Test-writing portion** | ~30% of build = ~3.7 min | 3.7 min (parallel) | — |
| **Implementation portion** | ~70% of build = ~8.7 min | 8.7 min (parallel) | — |
| **Quality gates (tsc+tests)** | ~2 min | ~2 min (after both) | 0 |
| **Server warm cache** | N/A | -0.5 min per agent | 1 min |
| **Total build+test time** | **12.4 min** (sequential) | **max(3.7, 8.7) + 2 = ~10.7 min** | **~1.7 min** |
| **Better estimate with TDD** | 12.4 min | **~9 min** (build faster with clear targets) | **~3.4 min** |

**Conservative estimate: 2-4 minutes saved per pipeline run** (~15-25% reduction in build phase).

**Why it's not just `max(test, build)`**: The build agent currently spends ~30% of its time writing tests inline. Offloading that to a parallel test agent means build is ~30% shorter. Plus the build agent runs faster when it has a clear "make these tests pass" target vs. inventing tests.

**Across the full pipeline** (typical ~55 min total):
- Build phase: 12.4 min → ~9 min = **3.4 min saved**
- Net pipeline: ~55 min → ~51.6 min = **~6% faster**
- Plus: **better test quality** (dedicated test agent vs. build agent's afterthought tests)

### Current State

- Build stage does everything: implements code, writes tests inline, runs quality gates
- `test-writer.md` exists as subagent (invoked within build) — not a pipeline stage
- `test.md` agent exists as primary but isn't registered in the pipeline
- Pipeline already supports `{ parallel: [...] }` via `state-machine.ts:executeParallelStep()`
- OpenCode server enables concurrent sessions with shared cache

### Target State

```
architect → plan-gap → { parallel: ['test', 'build'] } → commit → review → fix → commit → verify → docs/reflect → pr
```

- `test` stage: Writes failing tests based on plan. Outputs `test.md`.
- `build` stage: Implements code based on plan. Outputs `build.md`.
- Both run in parallel, attaching to the same OpenCode server.
- Quality gates (`run-quality-with-autofix`) run AFTER both complete (on the next sequential stage or as build's post-action).

### Assumptions

1. OpenCode server handles concurrent `--attach` sessions (confirmed by server architecture)
2. Test-writer writes to `tests/` and build writes to `src/` — no file conflicts
3. Quality gates (tsc, unit tests) run after both agents complete
4. Branch creation (`ensureFeatureBranch`) moves to a `preExecute` on the parallel step itself
5. Session forking still works — downstream stages fork from build's session (implementation context is more valuable)
6. We do NOT touch spec stages or downstream stages (review, fix, verify, etc.)

---

## Step 1: Register `test` as a Pipeline Stage in Definitions

**Files to Touch**:
- `scripts/cody/pipeline/definitions.ts` (MODIFIED — lines 44-66, 85-408)
- `scripts/cody/pipeline-utils.ts` (MODIFIED — lines 66-80, 765-777, 876-919)

**Exact Behavior**:
- Add `test` stage definition to `createStageDefinitions()`:
  - `type: 'agent'`, `timeout: ms('20m')`, `maxRetries: 1`
  - `minComplexity: 0` (always runs)
  - `shouldSkip`: `skipIfSpecOnly(ctx)` — skip for spec-only pipelines
  - `validator`: `createTestValidator()` — validates test.md
  - No `preExecute` (branch creation handled by the parallel group — see Step 5)
  - `postActions`: none (quality gates are on build stage, which runs in parallel)
- Change pipeline orders from sequential to parallel:
  - `IMPL_ORDER_STANDARD`: `['architect', 'plan-gap', { parallel: ['test', 'build'] }, 'commit', ...]`
  - `IMPL_ORDER_LIGHTWEIGHT`: `['architect', { parallel: ['test', 'build'] }, 'commit', ...]`
- Update `IMPL_PIPELINE` and `LIGHTWEIGHT_IMPL_PIPELINE` in `pipeline-utils.ts`
- Add `STAGE_COMPLEXITY_THRESHOLDS['test'] = 0`
- Add `STAGE_TIMEOUTS['test'] = ms('20m')` in `agent-runner.ts`
- Add `stageOutputFile` mapping: `STAGE_OUTPUT_MAP['test'] = 'test.md'`

**Tests** (MUST FAIL before, PASS after):

1. **Test location**: `tests/unit/scripts/cody/pipeline/test-stage-parallel.test.ts`
   - Test: `IMPL_ORDER_STANDARD contains { parallel: ['test', 'build'] }`
   - Test: `IMPL_ORDER_LIGHTWEIGHT contains { parallel: ['test', 'build'] }`
   - Test: `createStageDefinitions includes test with type 'agent'`
   - Test: `test stage shouldSkip returns true for spec_only`
   - Test: `STAGE_COMPLEXITY_THRESHOLDS.test equals 0`
   - Test: `stageOutputFile for test returns test.md`
   - Why they fail: `test` stage doesn't exist in definitions yet

**Acceptance Criteria**:
- [ ] `test` stage defined in `createStageDefinitions()`
- [ ] Pipeline orders use `{ parallel: ['test', 'build'] }` instead of sequential `'build'`
- [ ] `STAGE_COMPLEXITY_THRESHOLDS['test'] = 0`
- [ ] `stageOutputFile(dir, 'test')` returns `{dir}/test.md`
- [ ] `STAGE_TIMEOUTS['test']` = 20 minutes

---

## Step 2: Add `test` Stage Prompts and Context Files

**Files to Touch**:
- `scripts/cody/stage-prompts.ts` (MODIFIED — lines 29-46, 69-94, 109-181)
- `scripts/cody/agent-runner.ts` (MODIFIED — line 48: add test timeout)
- `scripts/cody/pipeline-utils.ts` (MODIFIED — lines 789-831: add DRY_RUN_OUTPUTS)

**Exact Behavior**:
- Add `'test'` to `ALL_STAGES` array
- Add `STAGE_CONTEXT_FILES['test']`: `['spec.md', 'clarified.md', 'plan.md', 'plan-gap.md']`
  - Same planning context as build, but NO `test.md` (test writes it), NO `context.md`, NO `rerun-feedback.md`
- Add `stageInstructions['test']`:
  ```
  TDD RED PHASE — Write Failing Tests
  
  You write tests BEFORE implementation exists. The build agent runs in parallel 
  and will implement code to make your tests pass.
  
  Write tests to tests/unit/ and tests/int/ ONLY.
  DO NOT write implementation code in src/.
  DO NOT run tests (they WILL fail — implementation doesn't exist yet).
  ```
- Add `DRY_RUN_OUTPUTS['test']` for dry-run support
- Do NOT modify `STAGE_CONTEXT_FILES['build']` — build doesn't read test.md since they run in parallel (build implements from plan, not from tests)

**Tests** (MUST FAIL before, PASS after):

1. **Test location**: `tests/unit/scripts/cody/pipeline/test-stage-prompts.test.ts`
   - Test: `ALL_STAGES includes 'test'`
   - Test: `STAGE_CONTEXT_FILES.test has plan.md and spec.md`
   - Test: `STAGE_CONTEXT_FILES.test does NOT have test.md or context.md`
   - Test: `buildStagePrompt for test includes TDD instructions`
   - Test: `dry run for test stage writes mock output`
   - Why they fail: `test` not in prompt system yet

**Acceptance Criteria**:
- [ ] `buildStagePrompt('test')` generates valid prompt
- [ ] Test stage reads planning docs but not build artifacts
- [ ] Dry-run support works

---

## Step 3: Rewrite `test.md` Agent for TDD Red Phase (Parallel)

**Files to Touch**:
- `.opencode/agents/test.md` (MODIFIED — full rewrite)
- `.opencode/agents/build.md` (MODIFIED — minor: remove inline test-writing mandate)

**Exact Behavior**:
- Rewrite `.opencode/agents/test.md`:
  - `mode: primary` (already is)
  - New purpose: "TDD Red Phase — write failing tests BEFORE implementation"
  - Remove "runs after build" — now runs IN PARALLEL with build
  - Core workflow:
    1. Read plan.md and spec.md
    2. For each plan step, write tests asserting expected behavior
    3. Write to `tests/unit/` and `tests/int/` only
    4. Run `pnpm -s tsc --noEmit` (type-check only — tests WILL fail at runtime since no impl)
    5. Write `test.md` report
  - **Critical rule**: "DO NOT write to `src/`. The build agent handles implementation."
  - **Critical rule**: "DO NOT run `pnpm test:unit` — tests WILL fail without implementation."
  - Output format: `## Tests Written`, `## Test Files`, `## Test Cases`
- Update `.opencode/agents/build.md`:
  - Remove section about invoking `@test-writer` subagent for every step
  - Keep `@test-writer` subagent reference for incremental additions
  - Add note: "A parallel test agent writes tests. After both complete, quality gates validate."
  - Keep all other sections (bug fix workflow, deviation protocol, quality checks)

**Tests** (MUST FAIL before, PASS after):

1. **Test location**: `tests/unit/scripts/cody/pipeline/test-agent-config.test.ts`
   - Test: `.opencode/agents/test.md` has `mode: primary`
   - Test: `.opencode/agents/test.md` contains "TDD" or "red phase"
   - Test: `.opencode/agents/test.md` contains "DO NOT write to src"
   - Test: `.opencode/agents/build.md` mentions "parallel test agent"
   - Why they fail: agent files not yet updated

**Acceptance Criteria**:
- [ ] `test.md` agent is TDD red-phase focused
- [ ] `test.md` writes to `tests/` only
- [ ] `build.md` no longer mandates inline test-writing for every step
- [ ] Both agents can coexist in parallel

---

## Step 4: Add Test Stage Validator and Content Validator

**Files to Touch**:
- `scripts/cody/pipeline/validators.ts` (MODIFIED — add `createTestValidator`)
- `scripts/cody/content-validators.ts` (MODIFIED — add `validateTestReport`)

**Exact Behavior**:
- `createTestValidator()`: Returns validator function that:
  - Checks `test.md` exists and has >100 chars
  - Checks content contains `## Tests Written` or `## Test Cases` or `## Test Files`
  - Returns `{ valid: true }` or `{ valid: false, error: '...' }`
- `validateTestReport(content: string)`: Returns boolean:
  - True if content contains `## Tests` (any variant) section
  - False otherwise
- Wire `createTestValidator` into the `test` stage definition (Step 1)

**Tests** (MUST FAIL before, PASS after):

1. **Test location**: `tests/unit/scripts/cody/pipeline/test-stage-validator.test.ts`
   - Test: `createTestValidator returns valid for proper test.md`
   - Test: `createTestValidator returns invalid for empty content`
   - Test: `createTestValidator returns invalid for missing ## Tests section`
   - Test: `validateTestReport returns true for content with ## Tests Written`
   - Test: `validateTestReport returns false for content without test sections`
   - Why they fail: validator functions don't exist yet

**Acceptance Criteria**:
- [ ] `createTestValidator()` validates test.md format correctly
- [ ] `validateTestReport()` works as content validator
- [ ] Validator is wired into test stage definition

---

## Step 5: Move Branch Creation to Parallel Group preExecute

**Files to Touch**:
- `scripts/cody/pipeline/definitions.ts` (MODIFIED — move `preExecute` from build to parallel-group wrapper)

**Exact Behavior**:
- The `{ parallel: ['test', 'build'] }` step needs the feature branch to exist BEFORE either agent runs
- Currently `build` has `preExecute: ensureFeatureBranch`. Move this logic:
  - Option A: Put `preExecute` on the `test` stage (it starts first or simultaneously)
  - Option B: The `executeParallelStep` already runs `preExecute` for each stage — put it on both (idempotent: `ensureFeatureBranch` is safe to call twice)
  - **Chosen: Option A** — put on `test` stage only, since `ensureFeatureBranch` creates the branch and checks it out. Having both agents try to checkout simultaneously could race. Put it on `test` and have `build`'s preExecute removed.
  - Actually: **Best approach** — keep `preExecute` on `build` stage but extract the `ensureFeatureBranch` call into a separate pre-parallel hook. Since the pipeline doesn't have a native "pre-parallel-group" hook, the simplest approach is:
    - Add `preExecute` to the `test` stage that calls `ensureFeatureBranch`
    - Remove `preExecute` from `build` stage
    - In `executeParallelStep`, stages run sequentially through skip-check and preExecute before the actual parallel handler.execute(). But looking at the code — NO, `executeParallelStep` runs ALL stages via `Promise.allSettled` including preExecute. So two stages running `ensureFeatureBranch` simultaneously is a race.
  - **Final approach**: Add the branch creation as a separate sequential stage or as a post-action on `plan-gap`/`architect`. Simplest: add `{ type: 'commit-task-files', ensureBranch: true }` as a post-action on `architect` stage (already runs before the parallel group).
  
**Revised approach**:
- Add `ensureFeatureBranch` to the `architect` stage's `postActions` (it already has post-actions)
- Remove `preExecute` from `build` stage entirely
- `test` stage has no `preExecute`
- The feature branch exists before the parallel group starts

**Tests** (MUST FAIL before, PASS after):

1. **Test location**: `tests/unit/scripts/cody/pipeline/test-branch-creation.test.ts`
   - Test: `build stage has NO preExecute`
   - Test: `test stage has NO preExecute`
   - Test: `architect postActions includes ensureBranch`
   - Why they fail: build still has preExecute, architect doesn't ensure branch

**Acceptance Criteria**:
- [ ] Feature branch created before parallel test+build group
- [ ] No race condition on branch creation
- [ ] `build` stage has no `preExecute`
- [ ] Branch name still persisted to status.json

---

## Step 6: Move Quality Gates to Post-Parallel Execution

**Files to Touch**:
- `scripts/cody/pipeline/definitions.ts` (MODIFIED — adjust build post-actions)

**Exact Behavior**:
- Currently build's `postActions` include:
  1. `validate-src-changes` — checks git diff has src/ changes
  2. `validate-build-content` — checks build.md has ## Changes
  3. `commit-task-files` — commits code before quality gates
  4. `run-quality-with-autofix` — runs tsc + unit tests with autofix loop
- In parallel mode, these post-actions run AFTER the build agent completes (via `executeParallelStep` → post-actions for completed stages). The test agent's tests will already be on disk since both run in parallel and the post-actions run after `Promise.allSettled`.
- **Key insight**: `run-quality-with-autofix` runs `pnpm test:unit` which will now pick up BOTH the test agent's tests AND any tests the build agent wrote. This is the integration point — tests from the test agent validate the build agent's code.
- No structural changes needed to post-actions — they already run sequentially after the parallel execution completes. Just verify the ordering is correct.
- Add `validate-test-output` post-action to `test` stage (validate test.md exists and has content)

**Tests** (MUST FAIL before, PASS after):

1. **Test location**: `tests/unit/scripts/cody/pipeline/test-quality-gates.test.ts`
   - Test: `build post-actions still include run-quality-with-autofix`
   - Test: `test stage has validate-test-output post-action`
   - Test: `run-quality-with-autofix runs pnpm test:unit (picks up all test files)`
   - Why they fail: test stage doesn't have post-actions yet

**Acceptance Criteria**:
- [ ] Quality gates run after both parallel agents complete
- [ ] `pnpm test:unit` picks up tests from test agent
- [ ] Build's autofix loop still works
- [ ] Test stage's output is validated

---

## Step 7: Update Existing Tests for Pipeline Consistency

**Files to Touch**:
- `tests/unit/scripts/cody/complexity-scoring.test.ts` (MODIFIED)
- `tests/unit/scripts/cody/stage-prompts.test.ts` (MODIFIED)
- `tests/unit/scripts/cody/pipeline-utils.test.ts` (MODIFIED)
- `tests/unit/scripts/cody/lightweight-pipeline.integration.test.ts` (MODIFIED)

**Exact Behavior**:
- Update `STAGE_COMPLEXITY_THRESHOLDS` tests to include `test` with value `0`
- Update pipeline order assertions: where they expect `'build'` as a stage, now expect `{ parallel: ['test', 'build'] }`
- Update `ALL_IMPL_STAGE_NAMES` expectations to include `'test'`
- Update `flattenPipelineOrder` tests to verify `test` appears in flattened output
- Update `getStagesForComplexity(1)` to include `test`
- Update stage prompt tests to include `test` stage

**Tests** (existing tests MUST PASS after update):

1. **Test locations**: Multiple existing test files
   - All existing pipeline tests pass with new `test` stage
   - No regressions in complexity scoring
   - `pnpm test:unit` passes
   - `pnpm -s tsc --noEmit` passes

**Acceptance Criteria**:
- [ ] All existing tests updated and passing
- [ ] No regressions
- [ ] `pnpm test:unit` green
- [ ] `pnpm -s tsc --noEmit` green

---

## Step 8: End-to-End Pipeline Validation

**Files to Touch**:
- `tests/unit/scripts/cody/pipeline/test-parallel-e2e.test.ts` (NEW)

**Exact Behavior**:
- Integration test that validates the full pipeline wiring:
  - `buildPipeline('impl', 'standard')` — has `{ parallel: ['test', 'build'] }`
  - `buildPipeline('impl', 'lightweight')` — has `{ parallel: ['test', 'build'] }`
  - `flattenPipelineOrder()` for standard: `['taskify', 'gap', 'architect', 'plan-gap', 'test', 'build', 'commit', ...]`
  - Pipeline order invariants:
    - `test` and `build` are in a parallel group
    - `architect` comes before the parallel group
    - `commit` comes after the parallel group
  - Both stages have correct definitions (type, timeout, validator)
  - Dry run works for both `test` and `build`
  - `STAGE_CONTEXT_FILES.test` and `STAGE_CONTEXT_FILES.build` don't conflict on writes

**Tests** (MUST FAIL before, PASS after):

1. **Test location**: `tests/unit/scripts/cody/pipeline/test-parallel-e2e.test.ts`
   - Test: `standard pipeline has parallel test+build group`
   - Test: `lightweight pipeline has parallel test+build group`
   - Test: `flattened order includes test and build`
   - Test: `parallel group is between architect/plan-gap and commit`
   - Test: `no file write conflicts between test and build context`
   - Why they fail: parallel group not wired yet

**Acceptance Criteria**:
- [ ] Full pipeline integration test passes
- [ ] Pipeline order invariants validated
- [ ] Both `pnpm test:unit` and `pnpm -s tsc --noEmit` pass
- [ ] No regressions in existing pipeline

---

## Implementation Notes

### What Changes
- `'build'` in pipeline order → `{ parallel: ['test', 'build'] }`
- New `test` stage definition (agent, 20min timeout, validator)
- `test.md` agent rewritten for TDD red phase
- Branch creation moved from build preExecute to architect postActions
- `build.md` agent: minor update (no longer mandates inline test-writing)

### What Stays the Same
- Spec stages (taskify, gap, clarify) — untouched
- Downstream stages (review, fix, verify, docs, reflect, pr) — untouched
- Build's quality gates (`run-quality-with-autofix`) — stay on build
- Fix mode pipeline (`FIX_ORDER`) — no test stage
- `test-writer.md` subagent — still available for build agent's incremental test additions
- `build-manager.md` — remains unused

### Risk Mitigation
- **File conflicts**: Test writes to `tests/`, build writes to `src/`. No overlap.
- **Branch race**: Solved by moving branch creation to architect post-action (runs before parallel group)
- **Quality gates**: Still run after both agents complete. `pnpm test:unit` picks up ALL test files regardless of which agent wrote them.
- **Fallback**: If test agent fails, build agent still has its own inline test-writing capability. Pipeline continues.
- **Session forking**: Downstream review/fix stages fork from build's session (more relevant implementation context).

### Time Reduction Summary

| Scenario | Current | With Parallel | Saved |
|----------|---------|---------------|-------|
| Small task (3-7 min build) | 5 min | ~4 min | ~1 min |
| Medium task (7-15 min build) | 12 min | ~9 min | ~3 min |
| Large task (15-27 min build) | 20 min | ~14 min | ~6 min |
| **Weighted average** | **12.4 min** | **~9 min** | **~3.4 min (27%)** |

