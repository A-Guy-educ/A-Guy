# Plan: Pipeline Hardening Phase 2 — Error Handling, Observability, Modularity, Resilience

**Task ID:** pipeline-stabilization-p2
**Task Type:** refactor
**Branch:** feat/pipeline-type-safe-registry (extends Phase 1 commit 514f10cf)

---

## Research Findings

### File Paths Verified
- ✅ `scripts/cody/entry.ts` (872 lines) — catch block at lines 333-386, mode handlers at 400-865
- ✅ `scripts/cody/handlers/agent-handler.ts` (92 lines) — failure reason at line 63-67
- ✅ `scripts/cody/pipeline/post-actions.ts` (666 lines) — swallowed git errors at lines 257-270, unknown action at line 611-612
- ✅ `scripts/cody/engine/state-machine.ts` (671 lines) — handleStageResult at line 550, loop at line 112-113 (has loopCount but no guard)
- ✅ `scripts/cody/engine/status.ts` (447 lines) — writeState, updateStage, completeState
- ✅ `scripts/cody/logger.ts` (205 lines) — dead legacy code at lines 77-205
- ✅ `scripts/cody/cody-utils.ts` (1125 lines) — types, CLI, deprecated status, re-exports, formatting
- ✅ `scripts/cody/pipeline-utils.ts` (829 lines) — schemas, I/O, complexity, pipelines, dry-run
- ✅ `scripts/cody/agent-runner.ts` (793 lines) — `AgentRunResult` at line 105 (has `validationErrors` but NO `exitCode`)
- ✅ `scripts/cody/preflight.ts` (86 lines) — existing preflight checks
- 🆕 `scripts/cody/modes/` — will create directory for extracted mode handlers
- 🆕 `scripts/cody/config/constants.ts` — will create for extracted magic numbers
- 🆕 `scripts/cody/cli-parser.ts` — will create for extracted CLI parsing
- 🆕 `scripts/cody/status-format.ts` — will create for extracted formatting

### Patterns Observed
- `entry.ts:375-384`: `setLifecycleLabel()` and `postComment()` in main catch are NOT wrapped in try/catch — if GitHub API fails, `process.exit(1)` never runs
- `agent-handler.ts:63-67`: Failed agent reason is just `"Agent failed"` — no validation errors, no pointer to artifact files
- `handleStageResult` (line 557-566) writes `completedAt` but never computes or writes `elapsed`
- `logger.ts:77-205`: 130 lines of dead legacy logging code — zero callers confirmed via grep
- `cody-utils.ts:373-386`: 12 re-exports from `github-api.ts` creating a shadow import path
- `cody-utils.ts:135-366`: ~230 lines of deprecated v1 status management (BUT types `CodyPipelineStatus` and `StageStatus` are still used by `engine/status.ts:stateToV1`)
- `post-actions.ts:611-612`: Unknown post-action types silently skipped with just a `logger.warn`
- `state-machine.ts:112-113`: Has `loopCount` variable but NO iteration guard — relies on stage-level caps
- `AgentRunResult` does NOT have `exitCode` field — plan adjustment needed

### Integration Warnings
- `CodyPipelineStatus` and `StageStatus` interfaces in `cody-utils.ts` are imported by `engine/status.ts:402` for `stateToV1()` — MUST keep these types even when deleting deprecated functions
- `getLastFailedStage()` and `getLastPausedStage()` are NOT deprecated — they handle both v1/v2 and are actively used by entry.ts — MUST keep
- `clarify-workflow.ts:11` imports `getLatestIssueComment`, `getLatestApprovalComment` from `cody-utils` (re-exports) — MUST update to direct github-api imports
- Test files (14 matches) import from `cody-utils` — need careful import updates

## Reuse Inventory

### Existing utilities to reuse
- `createStageLogger()` from `scripts/cody/logger.ts:45` — stage-scoped logging
- `updateStage()` from `scripts/cody/engine/status.ts` — writing `elapsed` field
- `completeState()` from `scripts/cody/engine/status.ts` — marking pipeline failed
- `StageName` type from `scripts/cody/stages/registry.ts` (Phase 1) — typed stage references
- `ciGroup`/`ciGroupEnd` from `scripts/cody/logger.ts` — CI log grouping

### New utilities (justified)
- `scripts/cody/config/constants.ts` — centralizes 16+ magic numbers scattered across 6 files. No existing constant file.
- `scripts/cody/cli-parser.ts` — extracted CLI parsing from 1125-line god object. Currently 450+ lines embedded.
- `scripts/cody/status-format.ts` — extracted formatting from god object. ~100 lines embedded.
- `scripts/cody/modes/*.ts` — extracted mode handlers from 872-line entry.ts. 6 inline functions totaling ~550 lines.

---

## Step 1: Fix Critical Error Handling Bugs

**Files to Touch:**
- `scripts/cody/entry.ts` (MODIFIED — lines 374-384)
- `scripts/cody/handlers/agent-handler.ts` (MODIFIED — lines 63-67)
- `scripts/cody/pipeline/post-actions.ts` (MODIFIED — lines 257-270, line 611-612)

**Exact Behavior:**

**1a. Wrap GitHub API calls in entry.ts main catch (lines 374-384):**

Current (buggy):
```typescript
if (input.issueNumber && !input.local) {
  const { setLifecycleLabel } = await import('./github-api')
  setLifecycleLabel(input.issueNumber, 'cody:failed')  // can throw!
  postComment(input.issueNumber, `❌ Pipeline failed...`)  // never reached if above throws
}
process.exit(1)  // never reached if either throws
```

Fix — wrap each in its own try/catch:
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

**1b. Enrich agent failure reason (agent-handler.ts:63-67):**

Current:
```typescript
return { outcome: 'failed', reason: `Agent failed`, retries: result.retries }
```

Fix — include validation errors and artifact paths (no `exitCode` — not on `AgentRunResult`):
```typescript
const details: string[] = [`Agent "${def.agentName ?? def.name}" failed`]
if (result.validationErrors?.length) {
  details.push(`Validation errors: ${result.validationErrors.join('; ')}`)
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

Note: `def.agentName` may not exist on `StageDefinition`. Check the type — if not, use `def.name` only.

**1c. Fix misleading error in validate-src-changes (post-actions.ts:257-270):**

Current: Git failures swallowed → `allChanged` is empty → throws misleading "did NOT modify source files."

Fix — when git fails, throw a git-specific error:
```typescript
let diff = ''
let untracked = ''
let gitFailed = false
try {
  diff = execFileSync('git', ['diff', '--name-only'], { encoding: 'utf-8' }).trim()
} catch (error) {
  logger.error({ err: error }, 'git diff failed during src validation')
  gitFailed = true
}
try {
  untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf-8' }).trim()
} catch (error) {
  logger.error({ err: error }, 'git ls-files failed during src validation')
  gitFailed = true
}
if (gitFailed) {
  throw new Error('validate-src-changes: git commands failed — cannot verify source changes. Check git state.')
}
```

**1d. Throw on unknown post-action type (post-actions.ts:611-612):**

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

**Tests (FAIL before, PASS after):**

Test file: `tests/unit/scripts/cody/error-handling.test.ts` (NEW)

1. `entry.ts catch block: process.exit always reached when GitHub API throws` — mock `setLifecycleLabel` to throw, mock `process.exit`, verify `process.exit(1)` is called
2. `agent failure reason includes validation errors when present` — create `AgentHandler`, mock `runAgentWithFileWatch` to return `{ succeeded: false, validationErrors: ['bad output'], retries: 1, timedOut: false }`, verify `result.reason` contains `"Validation errors: bad output"` and artifact paths
3. `validate-src-changes throws git-specific error when git fails` — mock `execFileSync` to throw, call the post-action handler, verify error message mentions `"git commands failed"`
4. `unknown post-action type throws instead of warning` — call `executePostAction` with `{ type: 'nonexistent' as any }`, expect `Error` with message containing `"Unknown post-action type"`

**Acceptance Criteria:**
- [ ] `process.exit(1)` is always reached in the entry.ts catch block regardless of GitHub API failures
- [ ] Agent failure reasons contain actionable details (validation errors, artifact paths)
- [ ] Git failures in `validate-src-changes` produce clear error messages, not misleading ones
- [ ] Unknown post-action types throw errors instead of being silently skipped
- [ ] All existing tests pass; 4 new tests pass

---

## Step 2: Fix Duration Tracking in State Machine

**Files to Touch:**
- `scripts/cody/engine/state-machine.ts` (MODIFIED — handleStageResult at lines 557-668)

**Exact Behavior:**

**2a. Compute and write `elapsed` in handleStageResult:**

In every terminal outcome branch (`completed`, `failed`, `timed_out`), compute elapsed from `startedAt`:

```typescript
// Helper at top of handleStageResult:
const startedAt = state.stages[stageName]?.startedAt
const elapsed = startedAt
  ? Math.round((Date.now() - new Date(startedAt).getTime()) / 1000)
  : undefined
```

Then include `elapsed` in every `updateStage()` call for terminal states.

For `completed` (line 558):
```typescript
state = updateStage(state, stageName, {
  state: 'completed',
  completedAt: new Date().toISOString(),
  elapsed,  // <-- NEW
  retries: result.retries,
  outputFile: result.outputFile,
  tokenUsage: result.tokenUsage,
  cost: result.cost,
  sessionId: result.sessionId,
})
```

For `failed` (line 643):
```typescript
state = updateStage(state, stageName, {
  state: 'failed',
  error: result.reason,
  elapsed,  // <-- NEW
})
```

For `timed_out` (line 657):
```typescript
state = updateStage(state, stageName, {
  state: 'timeout',
  error: result.reason,
  elapsed,  // <-- NEW
})
```

**2b. Verify `elapsed` field is accepted by `updateStage`:**

Check `StageStateV2` in `engine/types.ts` — it should already have `elapsed?: number`. If not, add it.

**Tests (FAIL before, PASS after):**

Test file: `tests/unit/scripts/cody/duration-tracking.test.ts` (NEW)

1. `handleStageResult computes elapsed for completed stages` — create state with `startedAt` = 10 seconds ago, call handleStageResult with completed outcome, verify `state.stages[name].elapsed` ≈ 10
2. `handleStageResult computes elapsed for failed stages` — same pattern with failed outcome
3. `handleStageResult computes elapsed for timed_out stages` — same pattern with timed_out outcome
4. `elapsed is undefined when startedAt is missing` — create state without startedAt, verify elapsed is undefined (no crash)

**Acceptance Criteria:**
- [ ] `elapsed` field is written to status.json for every terminal stage state (completed/failed/timed_out)
- [ ] CI step summary shows actual durations instead of `-ms`
- [ ] No crash when `startedAt` is missing from state
- [ ] All existing tests pass; 4 new tests pass

---

## Step 3: Clean Up Dead Code and Legacy Logging

**Files to Touch:**
- `scripts/cody/logger.ts` (MODIFIED — delete lines 77-205)
- `scripts/cody/cody-utils.ts` (MODIFIED — delete deprecated functions, delete re-exports, keep types)
- `scripts/cody/clarify-workflow.ts` (MODIFIED — update imports from cody-utils → github-api)
- `scripts/cody/entry.ts` (MODIFIED — update `postComment` import from cody-utils → github-api)
- Test files importing re-exported functions from cody-utils (MODIFIED)

**Exact Behavior:**

**3a. Delete legacy logging functions (logger.ts:77-205):**

Remove: `LogContext`, `globalContext`, `setGlobalContext()`, `getGlobalContext()`, `clearGlobalContext()`, `mergeContext()`, `formatTimestamp()`, `formatPrefix()`, `logWithContext()`, `warnWithContext()`, `errorWithContext()`, `debugWithContext()`

130 lines deleted. Zero callers confirmed.

**3b. Delete deprecated v1 status FUNCTIONS (cody-utils.ts:135-366):**

Remove functions only — KEEP the types:
- DELETE: `readStatus()`, `writeStatus()`, `initStatus()`, `updateStageStatus()`, `completeStatus()`
- KEEP: `CodyPipelineStatus` interface (line 53-73), `StageStatus` interface (line 75-91) — imported by `engine/status.ts:402`
- KEEP: `getLastFailedStage()` (line 156-200), `getLastPausedStage()` (line 208-253) — actively used, not deprecated

**3c. Delete re-export proxy (cody-utils.ts:373-386):**

Remove the 12 re-exports. Update consumers:

| Consumer file | Current import from `cody-utils` | Update to |
|---|---|---|
| `entry.ts:41` | `ensureTaskMarkerComment, postComment` from `github-api` (already direct!) | No change needed |
| `entry.ts:42` | `formatStatusComment` from `cody-utils` | Keep (will move in Step 6) |
| `entry.ts:24` | `parseCliArgs, validateAuth, ensureTaskDir, getLastFailedStage, getLastPausedStage` | Keep (these stay in cody-utils) |
| `clarify-workflow.ts:11` | `getLatestIssueComment, getLatestApprovalComment, type CodyInput` from `cody-utils` | Split: functions from `github-api`, type from `cody-utils` |
| `tests/unit/scripts/cody/cody-utils.test.ts:395` | `editComment` from `cody-utils` | Import from `github-api` |
| `tests/unit/scripts/cody/cost-tracking.test.ts:10-11` | `formatStatusComment`, types from `cody-utils` | Keep for now (will move in Step 6) |

**Tests (FAIL before, PASS after):**

1. `pnpm tsc --noEmit` passes (compiler catches any remaining references to deleted exports)
2. Tests that import deleted functions (`readStatus`, `writeStatus`, etc.) will fail → update or remove those test cases
3. No new test files needed — this is a deletion/cleanup step

**Acceptance Criteria:**
- [ ] `logger.ts` is under 80 lines (from 205)
- [ ] No re-exports from `cody-utils` to `github-api` remain
- [ ] `CodyPipelineStatus` and `StageStatus` types still exported from `cody-utils` (needed by engine/status.ts)
- [ ] `getLastFailedStage` and `getLastPausedStage` still work (NOT deprecated)
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

Create `scripts/cody/config/constants.ts` with named constants. Grep the codebase for magic numbers (5000, 3000, 10000, 200, 72, 50, 300, 2000, etc.) and replace them:

```typescript
// --- Loop & Retry Limits ---
export const MAX_PIPELINE_LOOP_ITERATIONS = 200
export const DEFAULT_MAX_FIX_ATTEMPTS = 2
export const MAX_BUILD_FEEDBACK_LOOPS = 2
export const RECOVERY_CHECK_INTERVAL = 10

// --- Output Truncation ---
export const MAX_GATE_OUTPUT_CHARS = 5000
export const MAX_PASSED_GATE_OUTPUT_CHARS = 1000
export const MAX_FAILED_GATE_OUTPUT_CHARS = 5000
export const MAX_GATE_FILE_OUTPUT_CHARS = 10000
export const MAX_QUALITY_ERROR_OUTPUT_CHARS = 3000
export const MAX_AGENT_DISPLAY_TEXT_CHARS = 300

// --- Process Lifecycle ---
export const SIGKILL_GRACE_MS = 5000
export const AGENT_RETRY_DELAY_MS = 2000
export const STDERR_TAIL_LINES = 50

// --- Git & PR ---
export const MAX_PR_TITLE_LENGTH = 72
export const MAX_SPEC_SUMMARY_LENGTH = 500

// --- Actor History ---
export const MAX_ACTOR_HISTORY_ENTRIES = 50
```

Then replace each magic number in source files. `constants.ts` MUST be a leaf dependency (zero imports from other cody modules).

**Tests (FAIL before, PASS after):**

Test file: `tests/unit/scripts/cody/constants.test.ts` (NEW)

1. `all constants are exported with expected types` — import each, verify typeof === 'number' and value > 0
2. `MAX_PIPELINE_LOOP_ITERATIONS is >= 100` — safety check that we don't accidentally set it too low
3. Existing tests continue to pass (values unchanged, just named now)

**Acceptance Criteria:**
- [ ] `scripts/cody/config/constants.ts` exists as a leaf dependency
- [ ] Key magic numbers in state-machine.ts, post-actions.ts, agent-runner.ts are replaced
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm test:unit` passes

---

## Step 5: Add State Machine Loop Guard

**Files to Touch:**
- `scripts/cody/engine/state-machine.ts` (MODIFIED — lines 112-113)

**Exact Behavior:**

The loop already has `loopCount` (line 112). Add a guard after the increment:

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

  // ... existing loop body (periodic recovery, resolveNextStep, etc.) ...
}
```

200 is generous — a normal full pipeline with verify-fix loop runs ~20-25 iterations.

**Tests (FAIL before, PASS after):**

Test file: `tests/unit/scripts/cody/loop-guard.test.ts` (NEW)

1. `pipeline loop guard triggers at MAX_ITERATIONS` — create a mock pipeline context where `resolveNextStep` always returns a stage (never completes), verify it throws after MAX_ITERATIONS with message containing "loop guard"
2. `loop guard sets state to failed before throwing` — verify `state.state === 'failed'` in the thrown error scenario

**Acceptance Criteria:**
- [ ] Loop has iteration guard that triggers at `MAX_PIPELINE_LOOP_ITERATIONS`
- [ ] Error message clearly identifies the bug (loop guard, not a normal failure)
- [ ] `status.json` is marked `failed` before throwing
- [ ] 2 new tests pass

---

## Step 6: Decompose `cody-utils.ts` God Object

**Files to Touch:**
- `scripts/cody/cli-parser.ts` (NEW — extracted from cody-utils.ts)
- `scripts/cody/status-format.ts` (NEW — extracted from cody-utils.ts)
- `scripts/cody/cody-utils.ts` (MODIFIED — slim down)
- All files that import from `cody-utils.ts` (MODIFIED — update import paths)

**Exact Behavior:**

**6a. Extract `cli-parser.ts` (~600 lines):**

Move from `cody-utils.ts`:
- `parseCliArgs()` (lines 392-1004) and all internal helpers
- `parseCommentBody()` helper (if separate, or embedded in parseCliArgs)
- Import `CodyInput` type, `isValidMode`, `isValidStage`, `validateTaskId` from the slimmed `cody-utils.ts`

**6b. Extract `status-format.ts` (~100 lines):**

Move from `cody-utils.ts`:
- `formatDuration()` (lines 1026-1035)
- `formatStatusComment()` (lines 1037-1119)
- `formatStatusCommentV2()` (lines 1121-1125)
- Import `CodyInput`, `CodyPipelineStatus`, `StageStatus` types from `cody-utils.ts`

**6c. Slim `cody-utils.ts` to ~250 lines:**

Keep:
- `CodyInput` interface (lines 21-51)
- `CodyPipelineStatus` interface (lines 53-73)
- `StageStatus` interface (lines 75-91)
- `VALID_MODES`, `VALID_STAGES`, `STAGE_ORDER` (lines 97-104)
- `isValidMode()`, `isValidStage()`, `validateTaskId()` (lines 106-117)
- `getTaskDir()`, `ensureTaskDir()` (lines 123-133)
- `getLastFailedStage()` (lines 156-200)
- `getLastPausedStage()` (lines 208-253)
- `validateAuth()` (lines 1012-1020)

**6d. Update all consumers:**

| Consumer | What it imports | Update to |
|---|---|---|
| `entry.ts:19-24` | `parseCliArgs, validateAuth, ensureTaskDir, getLastFailedStage, getLastPausedStage` | `parseCliArgs` from `cli-parser`, rest from `cody-utils` |
| `entry.ts:42` | `formatStatusComment` | from `status-format` |
| `tests/unit/scripts/cody/commander-cli.test.ts:2` | `parseCliArgs` | from `cli-parser` |
| `tests/unit/scripts/cody/pipeline-cli-contract.test.ts:31` | `parseCliArgs` | from `cli-parser` |
| `tests/unit/scripts/cody/cost-tracking.test.ts:10-11` | `formatStatusComment`, types | `formatStatusComment` from `status-format`, types from `cody-utils` |
| `tests/unit/scripts/cody/cody-utils-extended.test.ts:54` | various | Split across new modules |
| `tests/unit/scripts/cody/cody-utils.test.ts:14` | various | Split across new modules |

**Tests (FAIL before, PASS after):**

1. `pnpm tsc --noEmit` passes (compiler catches all stale imports)
2. Existing test imports updated — tests continue to pass
3. No behavioral changes — purely structural extraction

**Acceptance Criteria:**
- [ ] `cody-utils.ts` is under 300 lines (from 1125)
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
| `runSpecMode()` | 400-461 (~62 lines) | `modes/spec.ts` |
| `runImplMode()` | 466-512 (~47 lines) | `modes/impl.ts` |
| `runFullMode()` | 517-562 (~46 lines) | `modes/full.ts` |
| `runRerunMode()` | 567-729 (~163 lines) | `modes/rerun.ts` |
| `runFixMode()` | 734-841 (~108 lines) | `modes/fix.ts` |
| `runStatusMode()` | 846-865 (~20 lines) | `modes/status.ts` |

Each mode handler:
- Receives `(ctx: PipelineContext)` — context already contains `input`, `taskDir`, etc.
- Returns `Promise<void>`
- Imports its own dependencies (not relying on entry.ts closure scope)

Entry.ts retains:
- `main()` function with CLI parsing and mode dispatch
- Signal handlers (`cleanupOnSignal`)
- OpenCode server lifecycle (`shutdownOpenCodeServer`, `ensureTaskMd`)
- Top-level error handling (catch block)

**Tests (FAIL before, PASS after):**

1. `pnpm tsc --noEmit` passes
2. Each mode handler importable independently from `modes/*.ts`
3. All existing tests pass — no behavioral changes

**Acceptance Criteria:**
- [ ] `entry.ts` is under 350 lines (from 872)
- [ ] Each mode handler is in its own file with clear inputs/outputs
- [ ] No circular imports between `entry.ts` and `modes/*.ts`
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

**8a. Extract `pipeline/task-schema.ts` (~540 lines):**

Move from `pipeline-utils.ts`:
- All `VALID_*` constants (lines 12-33)
- `NON_SKIPPABLE_STAGES`, `SKIPPABLE_STAGES` (lines 36-39)
- `InputQuality` interface (lines 44-48)
- `TaskDefinition` interface (lines 141-158)
- `TaskDefinitionSchema` (Zod, lines 214-425)
- `parseTaskDefinition()` (lines 431-445)
- `normalizeTask()` (lines 455-543)
- `validateTask()` (lines 545-696)
- `PIPELINE_MAP` (lines 161-169)
- `TASK_TYPE_ALIASES` (lines 178-196)
- `CONFIDENCE_MAP` (lines 200-206)
- Helper types: `TaskType`, `Pipeline`, `PipelineProfile`, `ValidationResult` (lines 132-174)

**8b. Extract `pipeline/task-io.ts` (~50 lines):**

Move from `pipeline-utils.ts`:
- `readTask()` (lines 698-741)
- Import `TaskDefinition`, `normalizeTask`, `validateTask` from `task-schema.ts`

**8c. Extract `pipeline/complexity.ts` (~80 lines):**

Move from `pipeline-utils.ts`:
- `COMPLEXITY_MIN`, `COMPLEXITY_MAX` (lines 61-62)
- `ComplexityTier` type (line 65)
- `getComplexityTier()` (lines 67-73)
- `getStagesForComplexity()` (lines 79-81)
- `ControlMode` type (line 84)
- `CONTROL_MODE_MAP` (lines 86-90)
- `resolveControlMode()` (lines 96-102)
- `resolvePipelineProfile()` (lines 111-130)
- `LIGHTWEIGHT_TASK_TYPES` (line 139)

**8d. Slim `pipeline-utils.ts` (~200 lines):**

Keep:
- `PipelineStage` type, `isParallelStage()`, `flattenStage()`, `flattenPipeline()` (lines 801-826)
- `writeDryRunOutput()`, `DRY_RUN_OUTPUTS` (lines 750-793)
- `SPEC_ONLY_STAGES` (line 748)
- Re-export `stageOutputFile` from registry (line 744)
- Add re-exports from new locations for gradual migration: `export { readTask } from './pipeline/task-io'`, etc.

**Tests (FAIL before, PASS after):**

1. `pnpm tsc --noEmit` passes
2. `pipeline-utils.test.ts` tests continue to pass (via re-exports or updated imports)
3. No behavioral changes — purely structural extraction

**Acceptance Criteria:**
- [ ] `pipeline-utils.ts` is under 250 lines (from 829)
- [ ] Zod schemas and task types are in `pipeline/task-schema.ts`
- [ ] File I/O is in `pipeline/task-io.ts`
- [ ] Complexity scoring is in `pipeline/complexity.ts`
- [ ] No circular imports
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm test:unit` passes

---

## Step 9: Add Preflight Validation for LLM Keys

**Files to Touch:**
- `scripts/cody/preflight.ts` (MODIFIED — add LLM key and opencode.json checks)

**Exact Behavior:**

Add validation checks to existing `preflight()` function:

1. **LLM API key presence check**: Check that at least one LLM API key env var is set (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `MINIMAX_API_KEY`). Don't validate the key value, just that it's non-empty. This prevents the pipeline from running through taskify before failing because the build model's API key is missing.

2. **`opencode.json` exists and is valid JSON**: Currently `agent-runner.ts` silently falls back to `{}` if the file doesn't exist or is invalid. Surface as a warning.

Note: GH_TOKEN check already exists in preflight (line 50-58). It throws on missing — no change needed.

Implementation: Add 2 new checks to the `checks` array:
```typescript
{
  name: 'LLM API key (ANTHROPIC_API_KEY or OPENAI_API_KEY)',
  test: () => {
    const hasKey = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'MINIMAX_API_KEY']
      .some(k => process.env[k]?.trim())
    if (!hasKey) throw new Error('No LLM API key found')
  },
  errorMessage: 'Set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env',
},
{
  name: 'opencode.json',
  test: () => {
    if (!fs.existsSync('./opencode.json')) {
      throw new Error('opencode.json not found')
    }
    // Validate it's valid JSON
    JSON.parse(fs.readFileSync('./opencode.json', 'utf-8'))
  },
  errorMessage: 'Create opencode.json with model configuration',
},
```

**Tests (FAIL before, PASS after):**

Test file: `tests/unit/scripts/cody/preflight.test.ts` (NEW)

1. `preflight fails if no LLM API key is set` — unset all LLM keys, verify preflight throws
2. `preflight passes if ANTHROPIC_API_KEY is set` — set key, verify no throw
3. `preflight fails if opencode.json is invalid JSON` — write invalid content, verify throws

**Acceptance Criteria:**
- [ ] Missing LLM keys cause preflight failure with clear message
- [ ] Invalid/missing `opencode.json` causes preflight failure
- [ ] Existing GH_TOKEN check continues to work
- [ ] 3 new tests pass

---

## Step 10: Final Verification

**Files to Touch:** None — verification only.

**Exact Behavior:**

Run full quality gates:
```bash
pnpm tsc --noEmit          # Type check
pnpm lint                   # Lint
pnpm test:unit              # All unit tests
```

Verify file size improvements:
| File | Before | After Target |
|------|--------|-------|
| `cody-utils.ts` | 1125 | ~250 |
| `pipeline-utils.ts` | 829 | ~200 |
| `entry.ts` | 872 | ~300 |
| `logger.ts` | 205 | ~75 |

Verify no circular imports in the new module structure.

**Acceptance Criteria:**
- [ ] All quality gates pass
- [ ] No circular imports
- [ ] PR is ready for review

---

## Summary: What Changes

### Error Handling
| Before | After |
|--------|-------|
| GitHub API failure in catch block → `process.exit(1)` never runs | API failures caught, exit always runs |
| `"Agent failed"` — no details | `"Agent 'build' failed. Validation errors: ... Artifacts: build-stderr.log"` |
| Git failure in validate-src → misleading "did not modify source files" | Clear "git commands failed" error |
| Unknown post-action type → silently skipped | Throws immediately, catches config bugs |

### Observability
| Before | After |
|--------|-------|
| `elapsed` never written → CI shows `-ms` | Actual durations in status.json |
| 130 lines dead legacy logging code | Deleted |

### Modularity
| Before | After |
|--------|-------|
| `cody-utils.ts` — 1125 lines, 5+ domains | ~250 lines (types + validation + status helpers) |
| `pipeline-utils.ts` — 829 lines, 6+ domains | ~200 lines (parallel utils + dry-run) |
| `entry.ts` — 872 lines, 6 inline mode handlers | ~300 lines (main + signals + lifecycle) |
| 12 re-exported functions creating shadow imports | Direct imports only |

### Resilience
| Before | After |
|--------|-------|
| `while (true)` — no loop guard | 200-iteration circuit breaker |
| 16+ magic numbers scattered | Named constants in `config/constants.ts` |
| LLM key missing → fails after 10 min of CI time | Fails in preflight in 2 seconds |
