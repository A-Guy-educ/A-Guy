# Plan Phase 2: Cody Pipeline Hardening — Error Handling, Observability, Modularity, Resilience

**Prerequisite:** `.tasks/pipeline-stabilization/plan.md` (type-safe registry + test overhaul) is fully implemented.

---

## Research Findings

### File Paths Verified
- ✅ `scripts/cody/entry.ts` (978 lines) — main catch block at lines 345-397, signal handlers at lines 178-254
- ✅ `scripts/cody/handlers/agent-handler.ts` (96 lines) — poor failure reason at line 69
- ✅ `scripts/cody/pipeline/post-actions.ts` (695 lines) — swallowed git errors at lines 277-288, unknown action at line 641
- ✅ `scripts/cody/engine/state-machine.ts` (694 lines) — handleStageResult at line 555, no elapsed computation, no loop guard
- ✅ `scripts/cody/engine/status.ts` (496 lines) — writeState at line 67, updateStage
- ✅ `scripts/cody/logger.ts` (205 lines) — dead legacy code at lines 77-205, createStageLogger at line 45
- ✅ `scripts/cody/cody-utils.ts` (1152 lines) — god object: types, CLI, status, re-exports, formatting
- ✅ `scripts/cody/pipeline-utils.ts` (954 lines) — god object: schemas, I/O, complexity, pipelines, dry-run
- ✅ `scripts/cody/scripted-stages.ts` (613 lines) — verify, PR, commit stages mixed
- ✅ `scripts/cody/github-api.ts` (843 lines) — postComment, formatStatusComment
- ✅ `scripts/cody/agent-runner.ts` (811 lines) — STAGE_TIMEOUTS (moved to registry by Phase 1)
- 🆕 `scripts/cody/modes/` — will create directory for extracted mode handlers
- 🆕 `scripts/cody/config/constants.ts` — will create for extracted magic numbers

### Patterns Observed
- `entry.ts:388-396`: `setLifecycleLabel()` and `postComment()` in main catch are NOT wrapped in try/catch — if GitHub API fails, `process.exit(1)` never runs
- `agent-handler.ts:69`: Failed agent reason is just `"Agent failed"` string — no validation errors, no exit code, no pointer to artifact files
- `handleStageResult` (line 563-565) writes `completedAt` but never computes or writes `elapsed` — CI summary shows `-ms`
- `logger.ts:77-205`: 130 lines of dead legacy logging code (`logWithContext`, `warnWithContext`, etc.) — never called
- `cody-utils.ts:388-403`: 12 re-exports from `github-api.ts` creating a shadow import path
- `cody-utils.ts:155-382`: ~230 lines of deprecated v1 status management (superseded by `engine/status.ts`)
- `post-actions.ts:641`: Unknown post-action types silently skipped with just a `logger.warn`
- `state-machine.ts:118`: `while (true)` loop with no hard iteration limit — relies on stage-level caps

## Reuse Inventory

### Existing utilities to reuse
- `createStageLogger()` from `scripts/cody/logger.ts:45` — use for stage-scoped logging
- `updateStage()` from `scripts/cody/engine/status.ts` — use for writing `elapsed` field
- `PipelineStateV2Schema` from `scripts/cody/engine/types.ts` — status schema (no changes needed)
- `StageName` type from `scripts/cody/stages/registry.ts` (created in Phase 1) — use everywhere
- `ciGroup`/`ciGroupEnd` from `scripts/cody/logger.ts` — extend for sub-groups

### New utilities (justified)
- `scripts/cody/config/constants.ts` — centralizes 16+ magic numbers scattered across files. No existing constant file serves this purpose.
- `scripts/cody/modes/*.ts` — extracted mode handlers from `entry.ts`. Currently embedded as 6 inline functions.

---

## Step 1: Fix Critical Error Handling Bugs

**Files to Touch:**
- `scripts/cody/entry.ts` (MODIFIED — lines 387-396)
- `scripts/cody/handlers/agent-handler.ts` (MODIFIED — lines 67-71)
- `scripts/cody/pipeline/post-actions.ts` (MODIFIED — lines 271-298, line 641)

**Exact Behavior:**

**1a. Wrap GitHub API calls in entry.ts main catch (lines 387-396):**

Current (buggy):
```typescript
if (input.issueNumber && !input.local) {
  const { setLifecycleLabel } = await import('./github-api')
  setLifecycleLabel(input.issueNumber, 'cody:failed')  // can throw!
  postComment(input.issueNumber, `❌ Pipeline failed...`)  // never reached if above throws
}
process.exit(1)  // never reached if either throws
```

Fix — wrap both in try/catch:
```typescript
if (input.issueNumber && !input.local) {
  try {
    const { setLifecycleLabel } = await import('./github-api')
    setLifecycleLabel(input.issueNumber, 'cody:failed')
  } catch (labelErr) {
    logger.warn({ err: labelErr }, 'Failed to set failure lifecycle label')
  }
  try {
    postComment(input.issueNumber, `❌ Pipeline failed...`)
  } catch (commentErr) {
    logger.warn({ err: commentErr }, 'Failed to post failure comment')
  }
}
process.exit(1)  // ALWAYS reached now
```

**1b. Enrich agent failure reason (agent-handler.ts:67-71):**

Current (unhelpful):
```typescript
return { outcome: 'failed', reason: `Agent failed`, retries: result.retries }
```

Fix — include validation errors, exit info, and artifact paths:
```typescript
const details: string[] = [`Agent "${def.agentName ?? def.name}" failed`]
if (result.validationErrors?.length) {
  details.push(`Validation errors: ${result.validationErrors.join('; ')}`)
}
if (result.exitCode !== undefined) {
  details.push(`Exit code: ${result.exitCode}`)
}
details.push(`Artifacts: ${def.name}-stderr.log, ${def.name}-events.jsonl`)
return {
  outcome: 'failed',
  reason: details.join('. '),
  retries: result.retries,
  tokenUsage: result.tokenUsage,
  cost: result.cost,
}
```

Also: verify `runAgentWithFileWatch` result object exposes `validationErrors` and `exitCode`. If not, propagate them from `agent-runner.ts` result interface.

**1c. Fix misleading error in validate-src-changes (post-actions.ts:271-298):**

Current: Git failures swallowed → `allChanged` is empty → throws misleading "did NOT modify source files."

Fix — when git fails, throw a git-specific error instead of falling through:
```typescript
let diff = ''
let gitFailed = false
try {
  diff = execFileSync('git', ['diff', '--name-only'], { encoding: 'utf-8' }).trim()
} catch (error) {
  logger.error({ err: error }, 'git diff failed during src validation')
  gitFailed = true
}
// ... same for ls-files ...
if (gitFailed) {
  throw new Error('validate-src-changes: git commands failed — cannot verify source changes. Check git state.')
}
```

**1d. Throw on unknown post-action type (post-actions.ts:641):**

Current:
```typescript
default:
  logger.warn(`Unknown post-action type: ${(action as PostAction).type}`)
```

Fix:
```typescript
default:
  throw new Error(`Unknown post-action type: "${(action as PostAction).type}". This is a configuration bug.`)
```

This makes typos in post-action configuration fail loudly instead of silently.

**Tests (FAIL before, PASS after):**

1. `entry.ts catch block always reaches process.exit` — mock `setLifecycleLabel` to throw, verify `process.exit(1)` is called
2. `agent failure reason includes validation errors` — mock agent to fail with validation errors, verify StageResult.reason contains them
3. `validate-src-changes throws git-specific error when git fails` — mock `execFileSync` to throw, verify error message mentions "git commands failed"
4. `unknown post-action type throws instead of warning` — call `executePostAction` with `{ type: 'typo' }`, expect `Error`

**Acceptance Criteria:**
- [ ] `process.exit(1)` is always reached in the entry.ts catch block regardless of GitHub API failures
- [ ] Agent failure reasons contain actionable details (validation errors, exit code, artifact paths)
- [ ] Git failures in `validate-src-changes` produce clear error messages, not misleading ones
- [ ] Unknown post-action types throw errors instead of being silently skipped
- [ ] All existing tests pass; 4 new tests pass

---

## Step 2: Fix Duration Tracking and Enrich Failure Comments

**Files to Touch:**
- `scripts/cody/engine/state-machine.ts` (MODIFIED — lines 555-571)
- `scripts/cody/github-api.ts` or equivalent (MODIFIED — failure comment formatting)
- `scripts/cody/entry.ts` (MODIFIED — failure comment at lines 391-395)

**Exact Behavior:**

**2a. Compute and write `elapsed` in handleStageResult (state-machine.ts:555-571):**

When a stage completes (any terminal state), compute elapsed from `startedAt`:

```typescript
if (result.outcome === 'completed') {
  const startedAt = state.stages[stageName]?.startedAt
  const elapsed = startedAt
    ? Math.round((Date.now() - new Date(startedAt).getTime()) / 1000)
    : undefined

  state = updateStage(state, stageName, {
    state: 'completed',
    completedAt: new Date().toISOString(),
    elapsed,  // <-- NEW: duration in seconds
    retries: result.retries,
    outputFile: result.outputFile,
    tokenUsage: result.tokenUsage,
    cost: result.cost,
    sessionId: result.sessionId,
  })
```

Apply the same pattern for `failed`, `timed_out`, and `skipped` outcomes in the same function.

**2b. Enrich failure comments (entry.ts:391-395):**

Current:
```
❌ Pipeline failed for `taskId`: error message
Run: <url>
```

New format:
```
❌ Pipeline failed for `taskId`

**Failed stage:** `build` (after 12m 34s)
**Error:** TypeScript compilation failed: 3 type errors
**Cost:** $0.47 across 5 stages
**Completed:** taskify ✅ → gap ✅ → architect ✅ → build ❌

Run: <url>
```

Implementation: Read status.json in the catch block (already loaded at line 356), extract failed stage name, elapsed, cost, and stage progression. Format into markdown.

**2c. Add progress comment at pipeline start (entry.ts, after each stage):**

This is OPTIONAL / lower priority. If implemented, post a single comment at pipeline start and EDIT it after each stage completes (using `editComment` from `github-api.ts`). This gives the user real-time visibility.

Simpler alternative: post a progress comment only at the phase transition (after spec stages complete, before impl starts). This is already partially done via `setLifecycleLabel('cody:building')` at state-machine.ts:142 — just add a comment alongside it.

**Tests (FAIL before, PASS after):**

1. `handleStageResult computes elapsed for completed stages` — set `startedAt` to 10 seconds ago, verify `elapsed` ≈ 10
2. `handleStageResult computes elapsed for failed stages` — same pattern
3. `failure comment includes stage name and cost` — mock status.json with failed build stage, verify comment contains "build" and cost

**Acceptance Criteria:**
- [ ] `elapsed` field is written to status.json for every terminal stage state
- [ ] CI step summary shows actual durations instead of `-ms`
- [ ] Failure GitHub comments include the failed stage name, elapsed time, error message, and cost
- [ ] All existing tests pass; 3 new tests pass

---

## Step 3: Clean Up Dead Code and Legacy Logging

**Files to Touch:**
- `scripts/cody/logger.ts` (MODIFIED — delete lines 77-205)
- `scripts/cody/cody-utils.ts` (MODIFIED — delete deprecated status management lines ~155-382, delete re-exports lines 388-403)
- All files that import re-exported functions from `cody-utils` (MODIFIED — update to import directly from `github-api`)

**Exact Behavior:**

**3a. Delete legacy logging functions (logger.ts:77-205):**

Remove:
- `LogContext` interface
- `globalContext` variable
- `setGlobalContext()`, `getGlobalContext()`, `clearGlobalContext()`
- `mergeContext()`, `formatTimestamp()`, `formatPrefix()`
- `logWithContext()`, `warnWithContext()`, `errorWithContext()`, `debugWithContext()`

These are 130 lines of dead code — grep confirms zero callers outside logger.ts itself.

**3b. Delete deprecated v1 status functions (cody-utils.ts:~155-382):**

Remove all functions marked as deprecated / superseded by `engine/status.ts`:
- `readStatus()`
- `writeStatus()`
- `initStatus()`
- `updateStageStatus()`
- `completeStatus()`
- Related types: `CodyPipelineStatus`, `StageStatus`
- Any internal helpers used only by these functions

This is ~230 lines of code that causes confusion about "which status function do I use?"

**3c. Delete re-export proxy (cody-utils.ts:388-403):**

Remove the 12 re-exports from `github-api.ts`. Update all consumers that import `postComment`, `getIssue`, etc. from `cody-utils` to import directly from `github-api`. This eliminates the "two import paths" confusion.

Search for consumers: `grep -r "from.*cody-utils" scripts/cody/ | grep -E "postComment|getIssue|editComment|ensureTaskMarkerComment|getLinkedIssueFromPR"` — update each to import from `./github-api`.

**Tests (FAIL before, PASS after):**

1. `pnpm tsc --noEmit` passes (compiler catches any remaining references to deleted exports)
2. Tests that import deleted functions will fail → update their imports
3. No new test files needed — this is a deletion step

**Acceptance Criteria:**
- [ ] `logger.ts` is under 80 lines (from 205)
- [ ] `cody-utils.ts` is under 800 lines (from 1152, ~350 lines removed)
- [ ] Zero re-exports from `cody-utils` to `github-api` remain
- [ ] No file imports `readStatus`, `writeStatus`, `initStatus`, `updateStageStatus`, or `completeStatus` from `cody-utils`
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm test:unit` passes

---

## Step 4: Extract Magic Numbers into Named Constants

**Files to Touch:**
- `scripts/cody/config/constants.ts` (NEW)
- `scripts/cody/engine/state-machine.ts` (MODIFIED — replace inline numbers)
- `scripts/cody/pipeline/post-actions.ts` (MODIFIED — replace inline numbers)
- `scripts/cody/scripted-stages.ts` (MODIFIED — replace inline numbers)
- `scripts/cody/agent-runner.ts` (MODIFIED — replace inline numbers)
- `scripts/cody/pipeline/definitions.ts` (MODIFIED — replace inline numbers)

**Exact Behavior:**

Create `scripts/cody/config/constants.ts`:

```typescript
// --- Loop & Retry Limits ---
/** Max iterations of the main state-machine loop before circuit-breaking */
export const MAX_PIPELINE_LOOP_ITERATIONS = 200

/** Default max verify→fix loop iterations */
export const DEFAULT_MAX_FIX_ATTEMPTS = 2

/** Max build→quality-gate feedback loops */
export const MAX_BUILD_FEEDBACK_LOOPS = 2

/** State recovery check frequency (every N loop iterations) */
export const RECOVERY_CHECK_INTERVAL = 10

// --- Output Truncation ---
/** Max chars for gate output in verify-failures.md */
export const MAX_GATE_OUTPUT_CHARS = 5000

/** Max chars for passed gate output in verify report */
export const MAX_PASSED_GATE_OUTPUT_CHARS = 1000

/** Max chars for failed gate output in verify report */
export const MAX_FAILED_GATE_OUTPUT_CHARS = 5000

/** Max chars for gate output written to file */
export const MAX_GATE_FILE_OUTPUT_CHARS = 10000

/** Max chars for tsc/test error output in build feedback */
export const MAX_QUALITY_ERROR_OUTPUT_CHARS = 3000

/** Max chars for agent text display in logs */
export const MAX_AGENT_DISPLAY_TEXT_CHARS = 300

// --- Process Lifecycle ---
/** Grace period (ms) before SIGKILL after SIGTERM */
export const SIGKILL_GRACE_MS = 5000

/** Delay (ms) between agent retries */
export const AGENT_RETRY_DELAY_MS = 2000

/** Number of stderr tail lines to capture */
export const STDERR_TAIL_LINES = 50

// --- Git & PR ---
/** Max PR title length */
export const MAX_PR_TITLE_LENGTH = 72

/** Max spec summary length in PR body */
export const MAX_SPEC_SUMMARY_LENGTH = 500

// --- Actor History ---
/** Max entries in the actorHistory audit trail */
export const MAX_ACTOR_HISTORY_ENTRIES = 50
```

Then replace each magic number in its source file with the named constant import.

**Tests (FAIL before, PASS after):**

1. `constants are exported and have expected values` — import each, verify type and value
2. Existing tests continue to pass (values unchanged, just named now)

**Acceptance Criteria:**
- [ ] Zero unnamed magic numbers remain in state-machine.ts, post-actions.ts, scripted-stages.ts
- [ ] All constants are importable from `scripts/cody/config/constants.ts`
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm test:unit` passes

---

## Step 5: Add State Machine Loop Guard

**Files to Touch:**
- `scripts/cody/engine/state-machine.ts` (MODIFIED — lines 117-118)

**Exact Behavior:**

Add a hard loop iteration limit to the `while (true)` loop:

```typescript
const MAX_ITERATIONS = MAX_PIPELINE_LOOP_ITERATIONS  // 200 from constants.ts
let loopCount = 0

while (true) {
  loopCount++

  if (loopCount > MAX_ITERATIONS) {
    logger.error(`Pipeline loop exceeded ${MAX_ITERATIONS} iterations — aborting to prevent infinite loop`)
    state = completeState(state, 'failed')
    writeState(ctx.taskId, state)
    throw new Error(`Pipeline loop guard triggered after ${MAX_ITERATIONS} iterations. This is likely a bug in stage state management.`)
  }

  // ... existing loop body ...
}
```

200 is generous — a normal full pipeline with verify-fix loop runs ~20-25 iterations. 200 allows for pathological retry scenarios without hitting the limit accidentally, while preventing true infinite loops (which would otherwise run for 120 minutes until CI timeout).

**Tests (FAIL before, PASS after):**

1. `pipeline loop guard triggers at MAX_ITERATIONS` — create a mock pipeline where resolveNextStep always returns a stage (never completes), verify it throws after MAX_ITERATIONS
2. `normal pipeline completes well under loop guard` — run a 3-stage pipeline, verify loopCount < MAX_ITERATIONS

**Acceptance Criteria:**
- [ ] `while (true)` is replaced with iteration-guarded loop
- [ ] Error message clearly identifies the bug (loop guard, not a normal failure)
- [ ] Normal pipelines (even with verify-fix loops) complete well under the limit
- [ ] status.json is marked `failed` before throwing
- [ ] 2 new tests pass

---

## Step 6: Decompose `cody-utils.ts` God Object

**Files to Touch:**
- `scripts/cody/cli-parser.ts` (NEW — extracted from cody-utils.ts)
- `scripts/cody/status-format.ts` (NEW — extracted from cody-utils.ts)
- `scripts/cody/cody-utils.ts` (MODIFIED — slim down to types + validation + task dirs)
- All files that import from `cody-utils.ts` (MODIFIED — update import paths)

**Exact Behavior:**

**6a. Extract `cli-parser.ts` (~450 lines):**

Move from `cody-utils.ts`:
- `parseCliArgs()` (lines 409-834)
- `parseCommentBody()` (lines 858-1031)
- Any helper functions used only by these two
- Import `CodyInput` type from the slimmed `cody-utils.ts`

**6b. Extract `status-format.ts` (~100 lines):**

Move from `cody-utils.ts`:
- `formatDuration()` (lines ~1053-1070)
- `formatStatusComment()` (lines ~1071-1100)
- `formatStatusCommentV2()` (lines ~1101-1152)

**6c. Slim `cody-utils.ts` to ~80 lines:**

Keep only:
- `CodyInput` interface (lines 21-85)
- `isValidMode()`, `isValidStage()`, `validateTaskId()` (lines 113-133)
- `getTaskDir()`, `ensureTaskDir()` (lines 139-149)
- `validateAuth()` (lines ~1039-1047)

**6d. Update all consumers:**

Files that import `parseCliArgs` from `cody-utils` → import from `cli-parser`. Use `pnpm tsc --noEmit` to find all breakages.

Files that import `formatDuration`, `formatStatusComment`, `formatStatusCommentV2` from `cody-utils` → import from `status-format`.

**Tests (FAIL before, PASS after):**

1. `pnpm tsc --noEmit` passes (compiler catches all stale imports)
2. Existing `cody-utils.test.ts` and `cody-utils-extended.test.ts` tests need import path updates — split tests across `cli-parser.test.ts` and `status-format.test.ts` matching the new file boundaries
3. No behavioral changes — purely a structural extraction

**Acceptance Criteria:**
- [ ] `cody-utils.ts` is under 100 lines
- [ ] `cli-parser.ts` contains all CLI/comment parsing logic
- [ ] `status-format.ts` contains all formatting logic
- [ ] No circular imports between the three files
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm test:unit` passes

---

## Step 7: Decompose `entry.ts` — Extract Mode Handlers

**Files to Touch:**
- `scripts/cody/modes/spec.ts` (NEW)
- `scripts/cody/modes/impl.ts` (NEW)
- `scripts/cody/modes/full.ts` (NEW)
- `scripts/cody/modes/rerun.ts` (NEW)
- `scripts/cody/modes/fix.ts` (NEW)
- `scripts/cody/modes/status.ts` (NEW)
- `scripts/cody/modes/index.ts` (NEW — barrel export)
- `scripts/cody/entry.ts` (MODIFIED — slim to ~300 lines)

**Exact Behavior:**

Extract each `run*Mode` function into its own file:

| Function | Current lines | New file |
|----------|--------------|----------|
| `runSpecMode()` | 412-473 (~60 lines) | `modes/spec.ts` |
| `runImplMode()` | 478-524 (~50 lines) | `modes/impl.ts` |
| `runFullMode()` | 529-574 (~50 lines) | `modes/full.ts` |
| `runRerunMode()` | 579-765 (~190 lines) | `modes/rerun.ts` |
| `runFixMode()` | 771-947 (~180 lines) | `modes/fix.ts` |
| `runStatusMode()` | 952-971 (~20 lines) | `modes/status.ts` |

Each mode handler:
- Receives `(ctx: PipelineContext, input: CodyInput, taskDir: string)` as parameters
- Returns `Promise<void>`
- Imports its own dependencies (not relying on entry.ts closure scope)

Entry.ts retains:
- `main()` function with CLI parsing and mode dispatch (switch statement)
- Signal handlers (`cleanupOnSignal`)
- OpenCode server lifecycle (`shutdownOpenCodeServer`, `ensureTaskMd`)
- Top-level error handling (catch block)

The switch in `main()` becomes:
```typescript
switch (input.mode) {
  case 'spec': await runSpecMode(ctx, input, taskDir); break
  case 'impl': await runImplMode(ctx, input, taskDir); break
  case 'full': await runFullMode(ctx, input, taskDir); break
  case 'rerun': await runRerunMode(ctx, input, taskDir); break
  case 'fix': await runFixMode(ctx, input, taskDir); break
  case 'status': await runStatusMode(ctx, input, taskDir); break
}
```

**Tests (FAIL before, PASS after):**

1. `pnpm tsc --noEmit` passes
2. Mode handler tests (currently in `entry-modes.int.spec.ts` from Phase 1) continue to pass — they test pipeline resolution, not entry.ts directly
3. Each mode handler can be tested independently by importing from `modes/*.ts` — more testable than testing the monolithic `entry.ts`

**Acceptance Criteria:**
- [ ] `entry.ts` is under 350 lines (from 978)
- [ ] Each mode handler is in its own file with clear inputs/outputs
- [ ] `runRerunMode` (the most complex at 190 lines) is independently importable and testable
- [ ] No circular imports between `entry.ts` and `modes/*.ts`
- [ ] Dynamic imports in signal handler still work (they import from `engine/status`, not from modes)
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm test:unit` passes

---

## Step 8: Decompose `pipeline-utils.ts` — Separate Concerns

**Files to Touch:**
- `scripts/cody/pipeline/task-schema.ts` (NEW — Zod schemas, types, validation)
- `scripts/cody/pipeline/task-io.ts` (NEW — readTask, file I/O)
- `scripts/cody/pipeline/complexity.ts` (NEW — scoring, tiers, control modes)
- `scripts/cody/pipeline-utils.ts` (MODIFIED — slim to parallel utilities + dry-run)

**Exact Behavior:**

**8a. Extract `pipeline/task-schema.ts` (~400 lines):**

Move from `pipeline-utils.ts`:
- `TaskDefinition` interface
- `TaskDefinitionSchema` (Zod)
- `parseTaskDefinition()`, `normalizeTask()`, `validateTask()`
- `InputQuality` interface and `VALID_INPUT_QUALITY_LEVELS`
- All Zod sub-schemas (risk level, task type, etc.)

**8b. Extract `pipeline/task-io.ts` (~50 lines):**

Move from `pipeline-utils.ts`:
- `readTask()` (the function that reads and normalizes task.json from disk)

Import `TaskDefinition` and `normalizeTask` from `task-schema.ts`.

**8c. Extract `pipeline/complexity.ts` (~100 lines):**

Move from `pipeline-utils.ts`:
- `COMPLEXITY_MIN`, `COMPLEXITY_MAX`
- `ComplexityTier` type
- `getComplexityTier()`
- `getStagesForComplexity()`
- `resolveControlMode()`
- `resolvePipelineProfile()`
- `LIGHTWEIGHT_TASK_TYPES`, `CONFIDENCE_MAP`, `CONTROL_MODE_MAP`

Note: `STAGE_COMPLEXITY_THRESHOLDS` was already moved to registry in Phase 1. This file imports from the registry.

**8d. Slim `pipeline-utils.ts` (~200 lines):**

Keep only:
- `PipelineStage` type, `isParallelStage()`, `flattenStage()`, `flattenPipeline()`
- `writeDryRunOutput()`, `DRY_RUN_OUTPUTS`
- Re-export frequently used items from new locations for gradual migration (optional)

**Tests (FAIL before, PASS after):**

1. `pnpm tsc --noEmit` passes
2. `pipeline-utils.test.ts` tests split across new test files matching new boundaries
3. `readTask()` tests move to `task-io.test.ts`
4. Zod schema tests move to `task-schema.test.ts`

**Acceptance Criteria:**
- [ ] `pipeline-utils.ts` is under 250 lines (from 954)
- [ ] Zod schemas and task types are in `pipeline/task-schema.ts`
- [ ] File I/O is in `pipeline/task-io.ts`
- [ ] Complexity scoring is in `pipeline/complexity.ts`
- [ ] No circular imports
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm test:unit` passes

---

## Step 9: Add Preflight Validation for Critical Configuration

**Files to Touch:**
- `scripts/cody/preflight.ts` (MODIFIED — add LLM key and env var checks)

**Exact Behavior:**

Add validation checks to the existing `runPreflightChecks()` function:

1. **Required env vars for CI mode**: Verify `GH_TOKEN` or `GH_PAT` is set. Currently this is only checked when GitHub API calls fail at runtime. Fail early with clear message.

2. **LLM API key presence check**: Read `opencode.json`, determine which models are configured for which stages, check that at least one of the expected API key env vars is set (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `MINIMAX_API_KEY`). Don't validate the key value, just that it's non-empty. This prevents the pipeline from running 10 minutes through taskify before failing because the build model's API key is missing.

3. **`opencode.json` exists and is valid JSON**: Currently `agent-runner.ts:30-36` silently falls back to `{}` if the file doesn't exist or is invalid. Surface this as a warning in preflight.

**Tests (FAIL before, PASS after):**

1. `preflight fails if GH_TOKEN is missing in CI` — set `GITHUB_ACTIONS=true`, unset `GH_TOKEN` and `GH_PAT`, verify preflight throws
2. `preflight warns if no LLM API key is set` — unset all LLM keys, verify preflight logs warning
3. `preflight warns if opencode.json is missing` — delete file, verify warning

**Acceptance Criteria:**
- [ ] Missing `GH_TOKEN` in CI mode fails preflight (not 10 minutes later)
- [ ] Missing LLM keys produce a clear warning at startup
- [ ] Invalid/missing `opencode.json` produces a warning
- [ ] Preflight checks don't fail for local mode with relaxed requirements
- [ ] 3 new tests pass

---

## Step 10: Final Verification

**Files to Touch:** None — verification only.

**Exact Behavior:**

Run full quality gates:
```bash
pnpm tsc --noEmit          # Type check
pnpm lint                   # Lint (including new rules from Phase 1)
pnpm test:unit              # All unit tests
pnpm test:int:cody          # Cody integration tests
```

Verify file size improvements:
| File | Before | After |
|------|--------|-------|
| `cody-utils.ts` | 1152 | ~80 |
| `pipeline-utils.ts` | 954 | ~200 |
| `entry.ts` | 978 | ~300 |
| `logger.ts` | 205 | ~75 |

Verify no circular imports in the new module structure.

**Acceptance Criteria:**
- [ ] All quality gates pass
- [ ] No file over 500 lines in `scripts/cody/` (goal: no file over 300 lines except `github-api.ts` and `git-utils.ts` which are large but focused)
- [ ] No circular imports
- [ ] PR is ready for review

---

## Summary: What Changes in Phase 2

### Error Handling
| Before | After |
|--------|-------|
| GitHub API failure in catch block → `process.exit(1)` never runs | API failures caught, exit always runs |
| `"Agent failed"` — no details | `"Agent 'build' failed. Validation errors: ... Exit code: 1. Artifacts: build-stderr.log"` |
| Git failure in validate-src → misleading "did not modify source files" | Clear "git commands failed" error |
| Unknown post-action type → silently skipped | Throws immediately, catches config bugs |

### Observability
| Before | After |
|--------|-------|
| `elapsed` never written → CI shows `-ms` | Actual durations in status.json and CI summary |
| `"❌ Cody failed"` — no context | Failed stage, error, cost, progression in comment |
| 130 lines dead legacy logging code | Deleted |

### Modularity
| Before | After |
|--------|-------|
| `cody-utils.ts` — 1152 lines, 5+ domains | 80 lines (types + validation) |
| `pipeline-utils.ts` — 954 lines, 6+ domains | 200 lines (parallel utils + dry-run) |
| `entry.ts` — 978 lines, 6 inline mode handlers | 300 lines (main + signals + lifecycle) |
| 12 re-exported functions creating shadow imports | Direct imports only |
| 230 lines deprecated status management | Deleted |

### Resilience
| Before | After |
|--------|-------|
| `while (true)` — no loop guard | 200-iteration circuit breaker |
| 16+ magic numbers scattered | Named constants in `config/constants.ts` |
| LLM key missing → fails after 10 min of CI time | Fails in preflight in 2 seconds |

### Quantified Improvement
- **Lines deleted:** ~1,100 (dead code, deprecated status, legacy logging, re-exports)
- **Lines moved (not new):** ~1,200 (extracted into focused modules)
- **Lines added (new):** ~200 (constants, error enrichment, elapsed computation, loop guard, preflight)
- **Files created:** ~12 (modes/*, config/constants.ts, cli-parser.ts, status-format.ts, pipeline/task-schema.ts, pipeline/task-io.ts, pipeline/complexity.ts)
- **Max file size in scripts/cody/:** 500+ → ~300 (except github-api.ts and git-utils.ts)
- **God objects eliminated:** 3 (cody-utils, pipeline-utils, entry)
