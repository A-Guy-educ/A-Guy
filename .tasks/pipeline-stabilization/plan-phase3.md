# Plan Phase 3: Strategic Pipeline Stabilization — Canary Test, Architectural Boundaries, Declarative Retry

**Prerequisites:** Phase 1 (type-safe registry + test overhaul) and Phase 2 (error handling + observability + modularity) are fully implemented.

**Context:** After Phase 1 and Phase 2, the pipeline has type-safe stage names, decomposed god objects, proper error handling, and shared test infrastructure. But the root cause data reveals deeper problems that those plans don't address.

---

## The Data That Drives This Plan

| Metric | Value | Implication |
|--------|-------|-------------|
| Fix:Feature ratio | 3.5:1 (174 fixes / 50 features) | The pipeline generates 3.5 bugs per feature |
| Tests that catch real breakages | ~100 of 1,494 (8%) | 92% of tests are cosmetic |
| Fix commits with zero tests | 40% (8 of 20 recent) | Bugs ship untested |
| Smoke test effectiveness | Ignores failures (`\|\| true`) | CI gives false green |
| Entry.ts fix rate | 68% (34 of 50 commits) | Every mode change breaks routing |
| Files with fix rate < 50% | Zero | No stable core exists |
| Week 8 (worst) | 75 fixes in one week | Combinatorial interaction between modes |

**The #1 trigger for cascading breaks: new pipeline modes interacting with existing modes through the entry.ts god object.** `--fresh` triggered 7 fixes. Gate approval triggered 14 fixes. Rerun triggered 12 fixes. Each mode is an `if/else` branch sharing mutable state with every other branch.

**The #1 missing test: a pipeline canary.** A single dry-run E2E test that exercises CLI parsing → mode routing → pipeline building → state machine loop → stage ordering → status file output. This test would take 30 minutes to write and would have caught 6 of 8 recent untested breakages.

---

## Research Findings

### File Paths Verified
- ✅ `scripts/cody/entry.ts` — `process.exit(0)` at line 406, `process.exit(1)` at line 397
- ✅ `scripts/cody/engine/state-machine.ts` — `handleStageResult` has `if (stageName === 'verify')` at line 588
- ✅ `scripts/cody/engine/state-machine.ts` — dry-run shortcircuit at lines 268-271
- ✅ `scripts/cody/pipeline/post-actions.ts` — `run-quality-with-autofix` at lines 344-478 runs nested LLM loops
- ✅ `scripts/cody/pipeline/definitions.ts` — stage definitions with postActions arrays
- ✅ `scripts/cody/runner-backend.ts` — `RunnerBackend` interface at lines 27-36, injectable via `PipelineContext.backend`
- ✅ `tests/unit/scripts/cody/engine/integration.test.ts` — the only test that calls `runPipeline()`
- ✅ `.github/workflows/cody.yml` — smoke test at lines 226-310 with `|| true`
- ✅ `tests/int/scripts/cody.int.spec.ts` — 28 tests, zero call `runPipeline()` or `main()`
- ✅ `vitest.config.cody-int.mts` — basic config, no special infrastructure
- 🆕 `tests/canary/pipeline-canary.test.ts` — will create
- 🆕 `vitest.config.canary.mts` — will create
- 🆕 `scripts/cody/engine/retry-policy.ts` — will create

### Patterns Observed
- `engine/integration.test.ts` successfully mocks handlers and runs `runPipeline()` — proving the state machine is testable in isolation
- `RunnerBackend` interface is clean and injectable — a `TestRunner` is trivially buildable
- `entry.ts:406` does `process.exit(0)` which would kill a test process — needs `--no-exit` flag or spy
- Dry-run mode (`ctx.input.dryRun`) skips handlers AND post-actions — exercises only state machine loop + stage ordering
- The verify→fix loop at `state-machine.ts:588` uses hardcoded `stageName === 'verify'` — not declarative
- Post-actions have no visibility in status.json — the build stage shows `state: 'running'` during the entire autofix feedback loop

---

## Step 1: Pipeline Canary Test — The Single Most Impactful Change

**Files to Touch:**
- `tests/canary/pipeline-canary.test.ts` (NEW)
- `vitest.config.canary.mts` (NEW)
- `scripts/cody/entry.ts` (MODIFIED — add testability hook to avoid `process.exit`)
- `package.json` (MODIFIED — add `test:canary` script)

**Exact Behavior:**

**1a. Make entry.ts testable (entry.ts, line 406):**

The current `process.exit(0)` on success and `process.exit(1)` on failure kills any test process. Add a testability escape hatch:

```typescript
// At top of entry.ts
const isTestMode = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test'

// Replace process.exit(0) at line 406:
if (!isTestMode) process.exit(0)

// Replace process.exit(1) at line 397:
if (!isTestMode) throw error  // Let test catch it
else process.exit(1)
```

Alternative (cleaner): Extract the exit logic into a function that can be spied on:
```typescript
export function exitProcess(code: number): never {
  process.exit(code)
}
```
Tests can then `vi.spyOn(entryModule, 'exitProcess').mockImplementation(() => { throw new Error('exit') })`.

**1b. Create the canary test:**

```typescript
// tests/canary/pipeline-canary.test.ts
describe('Pipeline Canary', () => {
  it('full-mode dry-run traverses all stages to completion', async () => {
    // 1. Create temp task dir with task.md
    // 2. Call main(['--task-id', id, '--mode', 'full', '--dry-run', '--local'])
    // 3. Assert status.json state === 'completed'
    // 4. Assert all expected stages are completed or skipped
    // 5. Assert stage ordering matches pipeline definition
  })

  it('spec-mode dry-run produces only spec stages', async () => {
    // Same pattern, --mode=spec
    // Assert: only taskify, gap, clarify stages present
    // Assert: no impl stages (architect, build, etc.)
  })

  it('impl-mode dry-run produces only impl stages', async () => {
    // Create task dir with pre-existing task.json (so taskify is skipped)
    // Assert: architect, build, commit, verify, pr stages present
    // Assert: no spec stages
  })

  it('rerun-mode resumes from specified stage', async () => {
    // Create task dir with status.json showing build as failed
    // Call main(['--task-id', id, '--mode', 'rerun', '--from', 'build', '--dry-run', '--local'])
    // Assert: stages before build are skipped, build onwards are completed
  })

  it('fix-mode runs fix pipeline', async () => {
    // Create task dir with previous run artifacts
    // Call main(['--task-id', id, '--mode', 'fix', '--dry-run', '--local'])
    // Assert: FIX_ORDER stages run
  })

  it('pipeline rebuilds after taskify with correct profile', async () => {
    // This is the key two-phase construction test
    // Create task.md, run full mode
    // Taskify (dry-run) produces task.json with complexity
    // Assert: pipeline includes/excludes stages based on complexity threshold
  })
})
```

**1c. Fix the smoke test (`cody.yml`):**

Remove `|| true` from the smoke test command (line ~280):
```yaml
# Before:
- run: pnpm cody --mode=spec --task-id=260225-smoke-test || true

# After:
- run: pnpm cody --mode=spec --task-id=260225-smoke-test --dry-run --local
```

Or at minimum, check the exit code and fail the job if non-zero.

**1d. Create vitest config and npm script:**

```typescript
// vitest.config.canary.mts
export default defineConfig({
  test: {
    include: ['tests/canary/**/*.test.ts'],
    testTimeout: 30_000,  // 30s — these are integration-level
    environment: 'node',
  },
})
```

```json
// package.json
"test:canary": "vitest run --config vitest.config.canary.mts"
```

**Why this is the #1 priority:**

This single test file exercises the FULL call chain: `main()` → `parseCliArgs()` → mode routing → `resolvePipelineForMode()` → `buildPipeline()` → `runPipeline()` → `resolveNextStep()` → stage ordering → `writeState()`. Every import, every wiring, every mode path. If it passes, the pipeline's skeleton works. If it fails, something fundamental broke.

The 30-minute investment would have caught:
- `1f9b16fd` (profile/fromStage crash in rerun) — rerun canary would crash
- `5d28c955` (fix/verify resilience) — fix-mode canary would show wrong stages
- `9ac93db3` (lifecycle label) — would surface import errors
- `a4fcc120` (stale state in full-mode rerun) — full-mode canary would fail
- `5cea003f` (GSD revert) — all canaries would fail (stages don't exist)
- `57154029` (10 P0/P1 fixes) — several would crash pipeline construction

**Tests (FAIL before, PASS after):**

All 6 canary tests must pass. They exercise:
1. CLI parsing (parseCliArgs)
2. Mode routing (switch in main)
3. Pipeline construction (buildPipeline, rebuildPipelineAfterTaskify)
4. State machine loop (runPipeline, resolveNextStep)
5. Stage ordering (IMPL_ORDER_STANDARD, SPEC_ORDER_STANDARD)
6. State persistence (writeState, loadState)
7. Two-phase rebuild (pipelineNeedsRebuild flag)
8. Rerun resumption (resetFromStage, skipCompleted)

**Acceptance Criteria:**
- [ ] `pnpm test:canary` runs 6 tests, all pass
- [ ] Tests exercise entry.ts main() directly (not just sub-functions)
- [ ] Each pipeline mode (full, spec, impl, rerun, fix) has a canary
- [ ] Smoke test in CI no longer ignores failures
- [ ] Tests run in < 10 seconds total (dry-run, no LLMs, no git, no network)
- [ ] Adding `test:canary` to CI pipeline (as a required check)

---

## Step 2: Post-Action Observability — Make the Shadow Layer Visible

**Files to Touch:**
- `scripts/cody/engine/state-machine.ts` (MODIFIED — add post-action tracking in status.json)
- `scripts/cody/engine/types.ts` (MODIFIED — extend StageStateV2)
- `scripts/cody/pipeline/post-actions.ts` (MODIFIED — emit post-action start/end events)

**Exact Behavior:**

**Problem:** Post-actions are invisible. The build stage shows `state: 'running'` for the entire duration, including the 15-minute autofix feedback loop. There's no way to know whether the stage is in its handler or in its post-actions, or which post-action is running.

**Solution:** Track post-action execution in status.json.

**2a. Extend StageStateV2 (engine/types.ts):**

```typescript
export interface StageStateV2 {
  // ... existing fields ...

  /** Currently executing post-action (null when in handler) */
  currentPostAction?: string
  /** Completed post-actions with their outcomes */
  postActionLog?: Array<{
    type: string
    state: 'completed' | 'failed' | 'skipped'
    elapsed?: number   // seconds
    error?: string
  }>
}
```

**2b. Wrap post-action execution (state-machine.ts, in handleStageResult):**

Before each post-action call, write the current post-action name to status.json. After, log the result:

```typescript
if (def.postActions) {
  const postActionLog: StageStateV2['postActionLog'] = []
  for (const action of def.postActions) {
    const actionType = action.type === 'parallel' ? 'parallel' : action.type
    state = updateStage(state, stageName, { currentPostAction: actionType })
    writeState(ctx.taskId, state)

    const start = Date.now()
    try {
      await executePostAction(ctx, action, state)
      postActionLog.push({
        type: actionType,
        state: 'completed',
        elapsed: Math.round((Date.now() - start) / 1000),
      })
    } catch (error) {
      postActionLog.push({
        type: actionType,
        state: 'failed',
        elapsed: Math.round((Date.now() - start) / 1000),
        error: error instanceof Error ? error.message : String(error),
      })
      // Re-throw to preserve existing behavior
      throw error
    }
  }
  state = updateStage(state, stageName, {
    currentPostAction: undefined,
    postActionLog,
  })
}
```

**Why this matters:**

This makes the build stage's 15-minute autofix loop visible in status.json:
```json
{
  "build": {
    "state": "running",
    "currentPostAction": "run-quality-with-autofix",
    "postActionLog": [
      { "type": "validate-src-changes", "state": "completed", "elapsed": 1 },
      { "type": "validate-build-content", "state": "completed", "elapsed": 0 },
      { "type": "commit-task-files", "state": "completed", "elapsed": 5 },
      { "type": "run-mechanical-autofix", "state": "completed", "elapsed": 8 }
    ]
  }
}
```

The dashboard can show "Build: running quality gates (3/5 done)" instead of just "Build: running."

**Tests (FAIL before, PASS after):**

1. `post-action execution is logged in stage state` — run a pipeline with a stage that has 3 post-actions (mock), verify `postActionLog` has 3 entries
2. `failed post-action is logged with error` — mock a post-action to throw, verify log entry has `state: 'failed'` and error message
3. `currentPostAction updates in real-time` — spy on `writeState`, verify it's called with `currentPostAction` before each action

**Acceptance Criteria:**
- [ ] Every post-action execution is logged in status.json with type, state, elapsed, and error
- [ ] `currentPostAction` field reflects the currently running post-action
- [ ] Dashboard can distinguish "stage running handler" from "stage running post-action X"
- [ ] No behavioral change to existing pipeline flow (just additional state writes)
- [ ] Zod schema updated for new fields (optional fields, backward compatible)

---

## Step 3: Declarative Retry Policy — Generalize the Verify→Fix Loop

**Files to Touch:**
- `scripts/cody/engine/retry-policy.ts` (NEW)
- `scripts/cody/engine/state-machine.ts` (MODIFIED — replace hardcoded verify→fix with declarative policy)
- `scripts/cody/engine/types.ts` (MODIFIED — add retry policy to StageDefinition)
- `scripts/cody/pipeline/definitions.ts` (MODIFIED — define retry policy on verify stage)

**Exact Behavior:**

**Problem:** The verify→fix retry loop is hardcoded in `handleStageResult` at line 588: `if (stageName === 'verify' && !def.advisory)`. This is a special case in the generic engine that knows about specific stage names. It prevents generalization (e.g., what if you want a "lint→autofix" retry cycle for a different stage?).

**Solution:** Make retry-with-fix a declarative policy on stage definitions.

**3a. Define retry policy types (engine/retry-policy.ts):**

```typescript
import type { StageName } from '../stages/registry'

/**
 * Declarative retry policy for stages.
 * When a stage fails, instead of failing the pipeline,
 * reset the fixStage to pending and retry.
 */
export interface RetryWithFixPolicy {
  /** The stage that performs the fix (e.g., 'fix') */
  fixStage: StageName
  /** Maximum retry attempts */
  maxAttempts: number
  /** File to write failure details into (e.g., 'verify-failures.md') */
  failureArtifact: string
  /** Gate output files to collect on failure */
  gateOutputFiles?: Array<{ name: string; file: string }>
}

/**
 * Check if a stage has retries remaining.
 */
export function hasRetriesRemaining(
  state: StageStateV2,
  fixStageState: StageStateV2 | undefined,
  policy: RetryWithFixPolicy,
): boolean {
  const currentAttempt = fixStageState?.fixAttempt ?? 0
  return currentAttempt < policy.maxAttempts
}
```

**3b. Add to StageDefinition (engine/types.ts):**

```typescript
export interface StageDefinition {
  // ... existing fields ...

  /** Declarative retry-with-fix policy. When this stage fails,
   *  reset the fixStage to pending instead of failing the pipeline. */
  retryWithFix?: RetryWithFixPolicy
}
```

**3c. Define policy on verify stage (pipeline/definitions.ts):**

```typescript
stages.set('verify', {
  name: 'verify',
  type: 'scripted',
  timeout: getStageTimeout('verify'),
  maxRetries: 0,
  retryWithFix: {
    fixStage: 'fix',
    maxAttempts: DEFAULT_MAX_FIX_ATTEMPTS,
    failureArtifact: 'verify-failures.md',
    gateOutputFiles: [
      { name: 'TypeScript Errors', file: 'typescript-output.txt' },
      { name: 'Lint Errors', file: 'lint-output.txt' },
      { name: 'Format Errors', file: 'format-output.txt' },
      { name: 'Unit Test Errors', file: 'unit-tests-output.txt' },
    ],
  },
})
```

**3d. Generalize handleStageResult (state-machine.ts:588):**

Replace:
```typescript
if (stageName === 'verify' && !def.advisory) {
  const maxAttempts = state.stages['fix']?.maxFixAttempts ?? 2
  // ... 60 lines of hardcoded verify-specific logic ...
}
```

With:
```typescript
if (def.retryWithFix && !def.advisory) {
  const policy = def.retryWithFix
  const fixStageState = state.stages[policy.fixStage]
  
  if (hasRetriesRemaining(state, fixStageState, policy)) {
    // Collect failure details
    const failureContent = collectFailureDetails(ctx, result, policy)
    writeFailureArtifact(ctx.taskDir, policy.failureArtifact, failureContent)
    
    // Reset fix + this stage to pending
    const newAttempt = (fixStageState?.fixAttempt ?? 0) + 1
    state = updateStage(state, policy.fixStage, {
      state: 'pending',
      fixAttempt: newAttempt,
      maxFixAttempts: policy.maxAttempts,
    })
    state = updateStage(state, stageName, { state: 'pending' })
    writeState(ctx.taskId, state)
    
    logger.info(`🔄 ${stageName} failed, looping to ${policy.fixStage} (attempt ${newAttempt}/${policy.maxAttempts})`)
    return state
  }
}
```

**Why this matters:**

- The engine no longer knows about "verify" or "fix" by name — it only knows about the policy
- Adding a new retry-with-fix cycle (e.g., lint→autofix) is a config change, not an engine change
- The policy is testable in isolation (`hasRetriesRemaining` is a pure function)
- The gate output file collection is data-driven, not hardcoded

**Tests (FAIL before, PASS after):**

1. `stage with retryWithFix policy retries on failure` — define a policy, fail the stage, verify fix stage reset to pending
2. `retry stops at maxAttempts` — fail 3 times, verify pipeline fails on attempt 3
3. `stage without retryWithFix fails normally` — verify no retry behavior for stages without the policy
4. `hasRetriesRemaining returns correct boolean` — unit test the pure function
5. `failure artifact is written with collected gate outputs` — mock gate output files, verify artifact content

**Acceptance Criteria:**
- [ ] Zero hardcoded stage names in the state machine's retry logic
- [ ] `retryWithFix` policy on verify stage produces identical behavior to the old hardcoded logic
- [ ] Adding a new retry cycle to any stage requires only a `retryWithFix` config addition
- [ ] `hasRetriesRemaining` is a pure, testable function
- [ ] All existing verify→fix tests continue to pass
- [ ] 5 new tests pass

---

## Step 4: State/Artifact Boundary — Decouple Pipeline State from Filesystem

**Files to Touch:**
- `scripts/cody/engine/state-store.ts` (NEW — interface + filesystem implementation)
- `scripts/cody/engine/state-machine.ts` (MODIFIED — use StateStore interface)
- `scripts/cody/engine/status.ts` (MODIFIED — implement StateStore interface)
- `scripts/cody/engine/types.ts` (MODIFIED — add StateStore to PipelineContext)

**Exact Behavior:**

**Problem:** The state machine directly calls `loadState()`, `writeState()`, `updateStage()` which are hardcoded to filesystem. This makes testing impossible without real files. It also means the pipeline's "state" is entangled with filesystem artifacts — skip conditions read files, validators read files, post-actions create/delete files. The `resetFromStage` function has to know about output filenames to delete them.

**Solution:** Put state operations behind an interface. The default implementation remains filesystem (no behavior change), but tests can use an in-memory implementation.

**4a. Define StateStore interface (engine/state-store.ts):**

```typescript
import type { PipelineStateV2 } from './types'

export interface StateStore {
  load(taskId: string): PipelineStateV2 | null
  write(taskId: string, state: PipelineStateV2): void
  delete(taskId: string): void
  /** Check if an artifact file exists (e.g., 'verify-failures.md') */
  artifactExists(taskId: string, filename: string): boolean
  /** Read an artifact file */
  readArtifact(taskId: string, filename: string): string | null
  /** Write an artifact file */
  writeArtifact(taskId: string, filename: string, content: string): void
  /** Delete an artifact file */
  deleteArtifact(taskId: string, filename: string): void
}

/** Filesystem-backed state store (default) */
export class FileSystemStateStore implements StateStore {
  load(taskId: string): PipelineStateV2 | null {
    // Delegates to existing loadState() logic
  }
  write(taskId: string, state: PipelineStateV2): void {
    // Delegates to existing writeState() logic (atomic write + fsync)
  }
  // ... etc, wrapping existing functions from status.ts
}

/** In-memory state store for testing */
export class InMemoryStateStore implements StateStore {
  private states = new Map<string, PipelineStateV2>()
  private artifacts = new Map<string, string>()

  load(taskId: string) { return this.states.get(taskId) ?? null }
  write(taskId: string, state: PipelineStateV2) { this.states.set(taskId, structuredClone(state)) }
  delete(taskId: string) { this.states.delete(taskId) }
  artifactExists(taskId: string, filename: string) { return this.artifacts.has(`${taskId}/${filename}`) }
  readArtifact(taskId: string, filename: string) { return this.artifacts.get(`${taskId}/${filename}`) ?? null }
  writeArtifact(taskId: string, filename: string, content: string) { this.artifacts.set(`${taskId}/${filename}`, content) }
  deleteArtifact(taskId: string, filename: string) { this.artifacts.delete(`${taskId}/${filename}`) }
}
```

**4b. Add StateStore to PipelineContext (engine/types.ts):**

```typescript
export interface PipelineContext {
  // ... existing fields ...
  stateStore: StateStore
}
```

**4c. Update state machine to use ctx.stateStore:**

Replace all direct calls:
- `loadState(ctx.taskId)` → `ctx.stateStore.load(ctx.taskId)`
- `writeState(ctx.taskId, state)` → `ctx.stateStore.write(ctx.taskId, state)`
- `fs.existsSync(path.join(ctx.taskDir, 'verify-failures.md'))` → `ctx.stateStore.artifactExists(ctx.taskId, 'verify-failures.md')`

**4d. Wire default FileSystemStateStore in entry.ts:**

```typescript
const ctx: PipelineContext = {
  // ... existing fields ...
  stateStore: new FileSystemStateStore(),
}
```

**Why this matters:**

- **Testing becomes trivial.** The canary test from Step 1 can use `InMemoryStateStore` — no temp directories, no filesystem cleanup, no flaky path issues.
- **State operations are explicit.** Instead of scattered `fs.existsSync` calls to check if an artifact file exists (which is implicit state), the code explicitly calls `stateStore.artifactExists()`.
- **Future extensibility.** If you ever need to persist state to a database (for the dashboard to query in real-time), you implement a `DatabaseStateStore` without changing any engine code.

**This step is INCREMENTAL.** You don't need to migrate ALL filesystem access at once. Start with:
1. `loadState` / `writeState` / `deleteState` (the core state operations)
2. `verify-failures.md` read/write (used in the retry loop from Step 3)
3. Gradually migrate other artifact access in future PRs

**Tests (FAIL before, PASS after):**

1. `InMemoryStateStore load/write roundtrip` — write state, load it back, verify equality
2. `InMemoryStateStore artifact operations` — write/read/delete/exists work correctly
3. `FileSystemStateStore delegates to existing functions` — verify atomic write is preserved
4. `state machine uses ctx.stateStore` — run pipeline with InMemoryStateStore, verify state is written there (not filesystem)

**Acceptance Criteria:**
- [ ] `StateStore` interface defined with load/write/delete/artifact methods
- [ ] `FileSystemStateStore` wraps existing `status.ts` functions (no behavior change)
- [ ] `InMemoryStateStore` works for testing
- [ ] `PipelineContext.stateStore` is the sole access point for state in the engine
- [ ] Existing tests continue to pass (FileSystemStateStore is the default)
- [ ] 4 new tests pass
- [ ] `engine/integration.test.ts` can switch to `InMemoryStateStore` (cleaner tests)

---

## Step 5: CI Canary Gate — Make Pipeline Stability a Required Check

**Files to Touch:**
- `.github/workflows/cody.yml` (MODIFIED — fix smoke test, add canary as required check)
- `.github/workflows/ci.yml` or equivalent (MODIFIED — add `test:canary` to PR checks)

**Exact Behavior:**

**5a. Fix the smoke test:**

Replace the `|| true` in the smoke test step with proper error handling:
```yaml
- name: Run pipeline canary
  run: pnpm test:canary
  timeout-minutes: 2
```

This replaces the fake smoke test (which silently ignores failures) with the real canary test from Step 1.

**5b. Add canary to PR required checks:**

Any PR that modifies `scripts/cody/**` must pass the canary test:
```yaml
- name: Pipeline canary (if cody files changed)
  if: contains(github.event.pull_request.changed_files, 'scripts/cody/')
  run: pnpm test:canary
```

Or simpler: add `pnpm test:canary` to the existing CI checks that run on every PR.

**Why this matters:**

This creates a **feedback loop**: every pipeline change must pass the canary before merging. The canary exercises the full entry.ts → state machine → status file chain. If a mode interaction bug is introduced, the canary catches it before it reaches production.

Currently, the feedback loop is: change → merge → run in production → discover bug → fix → merge → repeat. The canary shortcircuits this to: change → canary fails → fix before merge.

**Tests:** N/A — this is CI configuration, not code.

**Acceptance Criteria:**
- [ ] `pnpm test:canary` is a required check for PRs touching `scripts/cody/`
- [ ] Smoke test in `cody.yml` no longer ignores failures
- [ ] CI fails if any canary test fails
- [ ] Canary tests run in < 30 seconds total

---

## Step 6: Mock Handler Infrastructure for Rich Canary Tests

**Files to Touch:**
- `tests/helpers/cody/test-runner.ts` (NEW)
- `tests/helpers/cody/test-handler.ts` (NEW)
- `tests/canary/pipeline-canary.test.ts` (MODIFIED — add richer tests using mock handlers)

**Exact Behavior:**

Dry-run canaries (Step 1) only test the pipeline skeleton. They skip handlers and post-actions entirely. To catch handler dispatch bugs, post-action ordering bugs, and retry loop bugs, we need canary tests that run with mock handlers.

**6a. Create TestRunner (tests/helpers/cody/test-runner.ts):**

A `RunnerBackend` implementation that, instead of spawning a real LLM process, writes canned output files:

```typescript
export class TestRunner implements RunnerBackend {
  name = 'test-runner'
  private outputs: Map<string, string>  // stage name -> output content

  constructor(outputs: Record<string, string>) {
    this.outputs = new Map(Object.entries(outputs))
  }

  spawn(stage: string, prompt: string, env: Record<string, string>, cwd: string): ChildProcess {
    // Write the canned output file for this stage
    // Return a mock ChildProcess that exits immediately with code 0
  }
}
```

**6b. Create TestHandler (tests/helpers/cody/test-handler.ts):**

A `StageHandler` that returns configurable results:

```typescript
export class TestHandler implements StageHandler {
  private results: Map<string, StageResult>

  constructor(results: Record<string, StageResult>) {
    this.results = new Map(Object.entries(results))
  }

  async execute(ctx: PipelineContext, def: StageDefinition): Promise<StageResult> {
    const result = this.results.get(def.name)
    if (!result) return { outcome: 'completed', retries: 0 }
    return result
  }
}
```

**6c. Rich canary tests:**

```typescript
it('verify failure triggers fix→verify retry loop', async () => {
  // Create pipeline with TestHandler where verify fails first time, passes second
  // Assert: fix stage runs, verify retries, pipeline completes
  // Assert: status.json shows fixAttempt=1
})

it('build post-action failure marks stage as failed', async () => {
  // Create pipeline with build handler that succeeds but quality gate post-action fails
  // Assert: build stage state is 'failed', error mentions quality gate
})

it('parallel stages both execute', async () => {
  // Create pipeline with { parallel: ['test', 'build'] }
  // Assert: both stages complete
})

it('gate pause produces PipelinePausedError', async () => {
  // Create pipeline with check-gate post-action
  // Assert: pipeline state is 'paused'
})
```

**Tests (FAIL before, PASS after):**

4 new rich canary tests that exercise:
1. The verify→fix retry loop (with declarative policy from Step 3)
2. Post-action failure propagation
3. Parallel stage execution
4. Gate pause behavior

**Acceptance Criteria:**
- [ ] `TestRunner` and `TestHandler` are reusable across all pipeline tests
- [ ] Rich canary tests exercise handler dispatch, post-actions, and retry loops
- [ ] Tests don't spawn real processes, touch the real filesystem (via InMemoryStateStore), or make network calls
- [ ] Tests run in < 5 seconds

---

## Summary: What Phase 3 Achieves

### The Strategic Shift

| Phase | Approach | What it prevents |
|-------|----------|-----------------|
| Phase 1 | Type-safe registry | Stage name drift (compile-time) |
| Phase 2 | Error handling + modularity | Silent failures + blast radius |
| **Phase 3** | **Canary test + architectural boundaries** | **Mode interaction bugs (the #1 cause of 174 fixes)** |

### Before Phase 3
- No test exercises `entry.ts main()` end-to-end
- Smoke test ignores failures (`|| true`)
- 92% of tests can't catch a real pipeline breakage
- Post-actions are invisible in status.json
- Verify→fix loop is hardcoded with `if (stageName === 'verify')`
- State machine can't be tested without filesystem
- New modes trigger 5-14 cascading fix commits

### After Phase 3
- 6 canary tests exercise every mode through the full call chain
- CI blocks merges that break the pipeline canary
- Post-actions are tracked per-stage with type, duration, and errors
- Retry-with-fix is a declarative policy on stage definitions
- State machine is testable with in-memory state store
- New modes are tested before merge via canary

### Quantified Impact

| Metric | Before All Phases | After Phase 3 |
|--------|------------------|---------------|
| Tests catching real breakages | ~100 (8%) | ~150 + 10 canaries covering entry.ts |
| Stage name compile safety | 0 files | All files |
| Post-action visibility | None | Per-action log in status.json |
| Hardcoded stage names in engine | 1 (`verify`) | 0 (declarative policy) |
| State machine testability | Requires filesystem | In-memory store available |
| CI catches pipeline breaks | Never (smoke ignores failures) | Always (canary is required check) |
| Estimated fix:feature ratio | 3.5:1 | Target: <1:1 |

### Effort Estimate

| Step | Effort | Impact |
|------|--------|--------|
| Step 1: Pipeline canary test | ~2-3 hours | **HIGHEST — catches mode interaction bugs** |
| Step 2: Post-action observability | ~3-4 hours | High — visibility into shadow layer |
| Step 3: Declarative retry policy | ~3-4 hours | Medium — generalizes engine, removes hardcoding |
| Step 4: StateStore interface | ~4-5 hours | High — enables testability for all future work |
| Step 5: CI canary gate | ~1 hour | **HIGHEST — prevents broken code from merging** |
| Step 6: Rich canary tests | ~3-4 hours | High — tests handler dispatch, post-actions, retries |
| **Total** | **~16-21 hours** | |

### The One Thing That Matters Most

If you only do ONE thing from all three plans, do **Step 1 + Step 5: the pipeline canary test + CI gate.** This is 3-4 hours of work that fundamentally changes the pipeline's stability trajectory from "discover bugs in production" to "catch bugs before merge."

The rest is important but incremental. The canary is transformational.
