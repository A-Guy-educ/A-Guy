# Plan: Inspector Pipeline Fixer

## Research Findings

### File Paths Verified
- ✅ `scripts/inspector/plugins/cody/health-check/index.ts` (338 lines — EDIT, line 73)
- ✅ `scripts/inspector/plugins/cody/health-check/discovery.ts` (118 lines — reference)
- ✅ `scripts/inspector/plugins/cody/failure-analysis/index.ts` (259 lines — DELETE)
- ✅ `scripts/inspector/plugins/cody/failure-analysis/classifier.ts` (139 lines — DELETE)
- ✅ `scripts/inspector/plugins/cody/failure-analysis/analyzer.ts` (165 lines — DELETE)
- ✅ `scripts/inspector/plugins/cody/failure-analysis/stage-router.ts` (43 lines — DELETE)
- ✅ `scripts/inspector/plugins/cody/queue-manager/index.ts` (527 lines — SIMPLIFY)
- ✅ `scripts/inspector/plugins/cody/queue-manager/gate-reviewer.ts` (136 lines — DELETE)
- ✅ `scripts/inspector/plugins/cody/queue-manager/types.ts` (87 lines — SIMPLIFY)
- ✅ `scripts/inspector/plugins/cody/queue-manager/queue-state.ts` (118 lines — SIMPLIFY)
- ✅ `scripts/inspector/index.ts` (149 lines — EDIT)
- ✅ `scripts/inspector/core/types.ts` (197 lines — reference only)
- ✅ `scripts/inspector/clients/github.ts` (229 lines — reference, has `readTaskFile`, `createIssue`, `triggerWorkflow`)
- ✅ `tests/unit/scripts/inspector/failure-analysis.spec.ts` (320 lines — DELETE)
- ✅ `tests/unit/scripts/inspector/queue-manager.test.ts` (614 lines — EDIT)
- ✅ `tests/unit/scripts/inspector/health-check.spec.ts` (exists — EDIT to add label-based failure test)
- 🆕 `scripts/inspector/plugins/cody/pipeline-fixer/index.ts` (NEW — ~200 lines)
- 🆕 `tests/unit/scripts/inspector/pipeline-fixer.spec.ts` (NEW — ~300 lines)

### Patterns Observed
- Plugins implement `InspectorPlugin` interface from `scripts/inspector/core/types.ts`
- Plugins return `ActionRequest[]` with dedup keys and execute callbacks
- Plugins read `cody:evaluatedTasks` from state (populated by health-check)
- `readTaskFile(taskId, filename)` reads from `.tasks/<taskId>/<filename>` — only works if status.json is on the checked-out branch (default branch). Feature branch task files are NOT accessible.
- `ctx.github.createIssue(title, body, labels)` returns issue number or null
- `ctx.github.triggerWorkflow('cody.yml', inputs)` dispatches workflow
- `ctx.github.postComment(issueNumber, body)` posts comment on issue
- Queue-manager uses `queue:state` key in inspector state store
- **Critical gap found**: health-check evaluates tasks with `cody:failed` label but no status.json as `health: 'unknown'` — these are real failures where status.json is on the feature branch, not the default branch. The pipeline-fixer needs them classified as `failed`.

### Integration Points
- Must register in `scripts/inspector/index.ts` (replaces `failureAnalysisPlugin`)
- Must run AFTER health-check plugin (reads `cody:evaluatedTasks` from state)
- Queue-manager delegates failures to pipeline-fixer via `cody:evaluatedTasks` (no direct coupling)
- Pipeline-fixer uses its own state key `cody:fixerState` (separate from queue state)

## Reuse Inventory

### Existing utilities the plan will reuse
- `readTaskFile(taskId, filename)` from `scripts/inspector/clients/github.ts` — read failure logs
- `createIssue(title, body, labels)` from `scripts/inspector/clients/github.ts` — create fix issues
- `triggerWorkflow(workflow, inputs)` from `scripts/inspector/clients/github.ts` — trigger reruns
- `postComment(issueNumber, body)` from `scripts/inspector/clients/github.ts` — post status comments
- `getIssueComments(issueNumber)` from `scripts/inspector/clients/github.ts` — parse failure comments for error info
- `EvaluatedTask` type from `scripts/inspector/core/types.ts` — task health data
- `ActionRequest` / `InspectorContext` types from `scripts/inspector/core/types.ts`
- `getQueueState` / `saveQueueState` from queue-state.ts — check if task is queue-managed
- `activateTask` / `completeTask` / `failTask` from queue-state.ts — kept for queue operations

### New code justified
- `pipeline-fixer/index.ts` — new plugin replacing 4-file failure-analysis with single file. Justified because the approach is fundamentally different (retry → create fix-issue → retry) vs old (classify → LLM analyze → retry with feedback).
- `FixerTaskState` type — tracks retries, error signatures, fix-issue numbers per task. No existing type fits this.

---

## Step 0: Fix health-check to detect label-based failures

**Files to Touch**:
- `scripts/inspector/plugins/cody/health-check/index.ts` (MODIFIED — lines 72-79)
- `tests/unit/scripts/inspector/health-check.spec.ts` (MODIFIED — add test)

**Exact Behavior**:

The `evaluateHealth` function currently returns `health: 'unknown'` when `status` is null (no status.json found). This happens when a task failed but its status.json is on the feature branch, not the default branch that the inspector checks out.

**Fix**: When `status` is null, check if the task's labels include `cody:failed`. If yes, treat it as `health: 'failed'` instead of `'unknown'`. Extract error details from the issue's failure comment (the pipeline posts a structured comment with `**Failed stage:**` and `**Error:**` fields).

Change lines 72-79 from:
```typescript
// No status = unknown
if (!status) {
  return {
    ...task,
    health: 'unknown',
    healthDetail: 'No status.json found',
  }
}
```

To:
```typescript
// No status.json — check if labels indicate failure
if (!status) {
  if (task.labels.includes('cody:failed')) {
    // status.json is on the feature branch, not accessible here.
    // Extract error from the failure comment posted by the pipeline.
    const { failedStage, failedError } = parseFailureFromComments(ctx, task.issueNumber)
    return {
      ...task,
      health: 'failed',
      healthDetail: 'Pipeline failed (status.json on feature branch)',
      failedStage,
      failedError,
    }
  }
  return {
    ...task,
    health: 'unknown',
    healthDetail: 'No status.json found',
  }
}
```

Add helper function `parseFailureFromComments`:
```typescript
function parseFailureFromComments(
  ctx: InspectorContext,
  issueNumber: number,
): { failedStage: string; failedError: string } {
  try {
    const comments = ctx.github.getIssueComments(issueNumber)
    // Search from newest to oldest for the failure comment
    for (let i = comments.length - 1; i >= 0; i--) {
      const body = comments[i].body
      if (!body.includes('❌ Pipeline failed')) continue

      const stageMatch = body.match(/\*\*Failed stage:\*\*\s*`([^`]+)`/)
      const errorMatch = body.match(/\*\*Error:\*\*\s*(.+)/)

      return {
        failedStage: stageMatch?.[1] || 'unknown',
        failedError: errorMatch?.[1]?.trim() || 'Unknown error (parsed from comment)',
      }
    }
  } catch {
    // Ignore errors — fallback below
  }
  return { failedStage: 'unknown', failedError: 'Unknown error (no failure comment found)' }
}
```

**Why this matters**: Without this fix, issue 822 (and any task that fails and commits status.json to the feature branch) would be invisible to the pipeline-fixer. The task has `cody:failed` label and a failure comment with structured error data — that's enough to treat it as a failed task.

**Tests that FAIL before, PASS after**:
- `tests/unit/scripts/inspector/health-check.spec.ts`:
  - `should evaluate task with cody:failed label and no status as failed`
  - `should parse failed stage and error from failure comment`
  - `should fallback gracefully when no failure comment found`

**Acceptance Criteria**:
- [ ] Task with `cody:failed` label + null status → `health: 'failed'` (not 'unknown')
- [ ] Failed stage and error extracted from `❌ Pipeline failed` comment
- [ ] Graceful fallback when comment parsing fails
- [ ] Existing health-check tests still pass
- [ ] Issue 822 would be detected as `failed` with `failedStage: 'build'`

---

## Step 1: Create pipeline-fixer plugin

**Files to Touch**:
- `scripts/inspector/plugins/cody/pipeline-fixer/index.ts` (NEW — ~200 lines)

**Exact Behavior**:

The plugin reads `cody:evaluatedTasks` from state, filters to failed tasks, and for each:

1. Loads per-task fixer state from `cody:fixerState` (stored in inspector state store):
   ```typescript
   interface FixerTaskState {
     retries: number           // 0-5
     errorSignature: string    // `${failedStage}:${error.slice(0,200)}`
     fixIssueNumber: number | null  // issue# created for pipeline fix
     fixIssueCreatedAt: string | null // ISO timestamp
   }
   ```

2. Computes current error signature: `${failedStage}:${error.slice(0,200).trim()}`

3. Routes based on retry count:

   **retries < 2 (simple retry)**:
   - Determine `fromStage` using inline logic:
     - `commit` → `commit`, `pr` → `pr`, `verify`/`autofix` → `build`, else passthrough
   - Read the error details from task files (verify.md, build.md, etc.) for feedback — note these may be empty if status.json is on feature branch
   - Call `ctx.github.triggerWorkflow('cody.yml', { task_id, mode: 'rerun', from_stage, feedback: error })`
   - Post comment: `🔄 **[pipeline-fixer: retry N/5]** Retrying from \`{fromStage}\``
   - Increment retries, save error signature

   **retries == 2 AND same error signature AND no fix-issue yet**:
   - Build fix-issue body with:
     - Original issue reference and task ID
     - Failed stage and error message
     - Relevant task file contents (truncated to 3000 chars each): `{failedStage}.md`, `verify.md`, `status.json` — note: may be empty for feature-branch tasks
     - Original issue body excerpt (first 2000 chars)
     - Retry history (what was tried)
     - Clear instructions: "Analyze why Cody's pipeline keeps failing on this and fix the pipeline code. Push as PR to dev."
   - Call `ctx.github.createIssue(title, body, labels)` with labels `['cody:pipeline-fix']`
   - Call `ctx.github.postComment(fixIssueNumber, '@cody')` to trigger Cody
   - Post comment on original issue: `🔧 **[pipeline-fixer]** Created fix issue #{fixIssueNumber}`
   - Save `fixIssueNumber` and `fixIssueCreatedAt` to state

   **retries == 2 AND different error signature** (error changed between retries):
   - Reset error signature, treat as a new failure cycle
   - Simple retry (same as retries < 2 path)
   - Keep retry count at 2 (don't reset — still count toward total budget)

   **retries 3-4 AND fixIssueNumber exists**:
   - Simple rerun of original task
   - Post comment: `🔄 **[pipeline-fixer: retry N/5]** Retrying after fix issue #{fixIssueNumber}`
   - Increment retries

   **retries >= 5**:
   - Post comment: `⛔ **[pipeline-fixer]** Exhausted 5 retry attempts. Manual intervention required.`
   - Clean up fixer state for this task

4. Skips tasks managed by queue-manager's active slot (reads `queue:state.activeTaskId` — queue-manager handles its own failure→advance flow, but the failed task AFTER being dequeued will be picked up by pipeline-fixer via its `cody:failed` label).

5. Checks for truly non-retryable errors inline (5 lines):
   - Missing API keys (`api key`, `secret`, `_api_key`)
   - Disk full (`enospc`, `no space left`)
   - Posts "Non-retryable infrastructure failure" and skips

**Dedup**: `dedupKey: pipeline-fixer:${taskId}`, `dedupWindowMinutes: 15`

**Tests that FAIL before, PASS after**:
- `tests/unit/scripts/inspector/pipeline-fixer.spec.ts`:
  - `should return no actions when no failed tasks`
  - `should create retry action on first failure (retries=0)`
  - `should create retry action on second failure (retries=1)`
  - `should create fix-issue when same error repeats at retry 2`
  - `should create post-fix retry at retries 3-4`
  - `should give up after 5 retries`
  - `should skip non-retryable infrastructure errors`
  - `should skip queue-managed active tasks`
  - `should reset error signature when error changes`

**Acceptance Criteria**:
- [ ] Plugin exports `pipelineFixerPlugin` implementing `InspectorPlugin`
- [ ] Plugin name is `cody-pipeline-fixer`, domain is `cody`
- [ ] Uses `cody:fixerState` state key (not `cody:evaluatedTasks` for writes)
- [ ] Reads `cody:evaluatedTasks` from state for input
- [ ] Creates GitHub issues with `cody:pipeline-fix` label
- [ ] Triggers `@cody` on created fix-issues
- [ ] Triggers `cody.yml` workflow for retries
- [ ] 5 total retry budget per task
- [ ] 15-minute dedup window per task
- [ ] All 9 unit tests pass

---

## Step 2: Simplify queue-manager — strip retry/gate logic

**Files to Touch**:
- `scripts/inspector/plugins/cody/queue-manager/index.ts` (MODIFIED — lines 1-527, net ~250 lines removed)
- `scripts/inspector/plugins/cody/queue-manager/gate-reviewer.ts` (DELETE)
- `scripts/inspector/plugins/cody/queue-manager/types.ts` (MODIFIED — lines 22-87)
- `scripts/inspector/plugins/cody/queue-manager/queue-state.ts` (MODIFIED — lines 86-118)

**Exact Behavior**:

**queue-manager/types.ts** changes:
- Remove `GateReviewInput` and `GateReviewResult` interfaces
- Remove `MAX_RETRIES` constant
- Remove `retries` and `gateApprovals` from `QueueState` interface
- Remove them from `DEFAULT_QUEUE_STATE`
- Keep: `QUEUE_LABELS`, `QueuedTask`, `STARTUP_GRACE_PERIOD_MS`, `QueueState` (simplified)

**queue-manager/queue-state.ts** changes:
- Remove `getRetryCount`, `incrementRetry` functions
- Simplify `cleanTaskState` to only clear `activeTaskId`, `activeIssueNumber`, `activeStartedAt`
- Keep: `getQueueState`, `saveQueueState`, `getQueuedTasks`, `getActiveTask`, `activateTask`, `completeTask`, `failTask`

**queue-manager/index.ts** changes:
- Remove `createFailureAction` function entirely (~120 lines)
- Remove `createGateReviewAction` function entirely (~75 lines)
- Remove imports: `classifyRetryability`, `analyzeFailure`, `resolveFromStage`, `reviewGate`, `readTaskFile`
- Remove imports: `getRetryCount`, `incrementRetry` from queue-state
- In the `switch(evaluated.health)` block:
  - `'failed'` case: Create a simple `fail-and-advance` action that calls `failTask()`, `cleanTaskState()`, `advanceQueue()`
  - `'gated'` case: Remove entirely (no gate handling)
  - `'orphaned'` / `'stalled'` case: Same as `'failed'` — fail and advance
- Keep: `createActivateAction`, `createCompleteAction`, `advanceQueue`

**The key insight**: Queue-manager only manages the queue (FIFO ordering, activation, advancement). When a queued task fails, queue-manager marks it failed, advances to the next task, and moves on. The original task (now with `cody:failed` label, no longer queue-active) gets picked up by pipeline-fixer on the next health-check cycle via `cody:evaluatedTasks`.

**Tests that FAIL before, PASS after**:
- Update `tests/unit/scripts/inspector/queue-manager.test.ts`:
  - Remove: `creates gate review action when active task is gated`
  - Remove: `creates failure action when active task failed with retries remaining`
  - Remove: retry count tests (`getRetryCount`, `incrementRetry`)
  - Remove: gate approval state tests
  - Add: `creates fail-and-advance action when active task failed`
  - Add: `fail-and-advance action marks task failed and advances queue`
  - Update: `cleanTaskState` tests (no retry/gate fields)

**Acceptance Criteria**:
- [ ] `gate-reviewer.ts` deleted
- [ ] No imports from `failure-analysis/` in queue-manager
- [ ] `QueueState` has no `retries` or `gateApprovals` fields
- [ ] No `getRetryCount` or `incrementRetry` exports from queue-state
- [ ] Failed tasks get `cody:queue-failed` label and queue advances
- [ ] Gated case removed from switch
- [ ] All queue-manager tests pass

---

## Step 3: Delete failure-analysis directory

**Files to Touch**:
- `scripts/inspector/plugins/cody/failure-analysis/index.ts` (DELETE)
- `scripts/inspector/plugins/cody/failure-analysis/classifier.ts` (DELETE)
- `scripts/inspector/plugins/cody/failure-analysis/analyzer.ts` (DELETE)
- `scripts/inspector/plugins/cody/failure-analysis/stage-router.ts` (DELETE)
- `tests/unit/scripts/inspector/failure-analysis.spec.ts` (DELETE)

**Exact Behavior**: Delete the entire `failure-analysis/` directory and its test file. All functionality is replaced by the pipeline-fixer plugin in Step 1.

**Acceptance Criteria**:
- [ ] Directory `scripts/inspector/plugins/cody/failure-analysis/` does not exist
- [ ] File `tests/unit/scripts/inspector/failure-analysis.spec.ts` does not exist
- [ ] No remaining imports from `failure-analysis/` anywhere in the codebase

---

## Step 4: Update entry point and plugin registration

**Files to Touch**:
- `scripts/inspector/index.ts` (MODIFIED — lines 14, 75, 88-105)

**Exact Behavior**:

1. Replace import:
   ```typescript
   // OLD
   import { failureAnalysisPlugin } from './plugins/cody/failure-analysis/index'
   // NEW
   import { pipelineFixerPlugin } from './plugins/cody/pipeline-fixer/index'
   ```

2. Replace registration:
   ```typescript
   // OLD
   registry.register(failureAnalysisPlugin)
   // NEW
   registry.register(pipelineFixerPlugin)
   ```

3. Update ordering validation:
   ```typescript
   // OLD
   const failureIdx = pluginNames.indexOf('cody-failure-analysis')
   // NEW
   const fixerIdx = pluginNames.indexOf('cody-pipeline-fixer')
   ```
   And update the error message and check accordingly.

4. Remove the `MINIMAX_API_KEY` warning (lines 60-63) — no longer needed for failure handling. Keep it only if other plugins still need it (audit plugin uses MiniMax). Check: audit plugin and queue-manager gate-reviewer used MiniMax. Gate-reviewer is deleted. Audit plugin still uses it. So keep the warning but update the message to only mention audit.

**Tests that FAIL before, PASS after**:
- Existing `tests/unit/scripts/inspector/inspector.test.ts` should still pass (it tests the core loop, not specific plugins)
- TypeScript compilation: `pnpm tsc --noEmit` must pass

**Acceptance Criteria**:
- [ ] `pipelineFixerPlugin` is registered instead of `failureAnalysisPlugin`
- [ ] Plugin ordering validation checks `cody-pipeline-fixer`
- [ ] `MINIMAX_API_KEY` warning updated to reference audit only
- [ ] `pnpm tsc --noEmit` passes
- [ ] No import of `failure-analysis` anywhere

---

## Step 5: Write pipeline-fixer tests

**Files to Touch**:
- `tests/unit/scripts/inspector/pipeline-fixer.spec.ts` (NEW — ~300 lines)

**Exact Behavior**:

Tests use the same mock pattern as existing inspector tests (see `queue-manager.test.ts` for the `createMockContext` helper pattern).

**Test cases**:

1. **Plugin metadata**: name is `cody-pipeline-fixer`, domain is `cody`
2. **No actions when no failed tasks**: state has only healthy/completed tasks → returns `[]`
3. **Retry 1 (retries=0)**: Failed task with no prior state → creates retry action → execute triggers `cody.yml` with `mode: rerun`, posts retry comment, increments state
4. **Retry 2 (retries=1)**: Same flow as retry 1
5. **Fix-issue at retry 2 (same error)**: Failed task with retries=2 and matching error signature → creates fix-issue action → execute calls `createIssue`, posts `@cody` comment, saves fix-issue number to state
6. **Error signature change at retry 2**: retries=2 but different error → creates retry action (not fix-issue), resets signature
7. **Post-fix retry 3-4**: retries=3 with fixIssueNumber set → creates retry action referencing fix issue
8. **Give up at retry 5**: retries=5 → posts "manual intervention required", cleans state
9. **Non-retryable skip**: error contains "MINIMAX_API_KEY" → posts non-retryable notice, no retry
10. **Skip queue-managed active task**: task is in `queue:state.activeTaskId` → skipped
11. **Dedup key**: verify dedupKey format is `pipeline-fixer:${taskId}`
12. **Label-based failure**: Task with `cody:failed` label and no status.json (detected by health-check Step 0) → pipeline-fixer creates retry action with error from failure comment

**Acceptance Criteria**:
- [ ] All 12 test cases pass
- [ ] Tests use vitest (describe/it/expect/vi)
- [ ] Tests mock InspectorContext (state, github, log)
- [ ] No real GitHub API calls in tests

---

## Step 6: Validate everything

**Commands**:
```bash
pnpm tsc --noEmit
pnpm vitest run tests/unit/scripts/inspector/pipeline-fixer.spec.ts
pnpm vitest run tests/unit/scripts/inspector/queue-manager.test.ts
pnpm vitest run tests/unit/scripts/inspector/inspector.test.ts
pnpm vitest run tests/unit/scripts/inspector/health-check.spec.ts
pnpm vitest run tests/unit/scripts/inspector/
pnpm lint
```

**Acceptance Criteria**:
- [ ] TypeScript compiles with no errors
- [ ] All inspector tests pass
- [ ] No lint errors
- [ ] No remaining references to `failure-analysis` directory
- [ ] No remaining references to `gate-reviewer`
- [ ] `MINIMAX_API_KEY` not required for failure handling (only audit)
- [ ] Issue 822 scenario: task with `cody:failed` label + no status.json → detected as failed → pipeline-fixer triggers rerun

---

## Summary

| Metric | Before | After |
|--------|--------|-------|
| failure-analysis files | 4 | 0 (deleted) |
| pipeline-fixer files | 0 | 1 (~200 lines) |
| gate-reviewer files | 1 | 0 (deleted) |
| queue-manager responsibility | retry + gate + queue | queue only |
| LLM dependency for failure handling | MiniMax required | None |
| Failure recovery approach | Classify → LLM analyze → retry with feedback | Retry 2x → create fix-issue for Cody → retry 2x more → give up |
| Label-based failure detection | ❌ Not supported | ✅ `cody:failed` label → health: failed |
| Total files deleted | 6 | — |
| Total files created | 2 | — |
| Total files modified | 5 | — |

### Issue 822 Flow (after deployment)

1. Inspector wakes up → health-check discovers issue 822 (open, has `cody:failed` label)
2. No status.json on default branch → health-check sees `cody:failed` label → parses failure comment → `health: 'failed'`, `failedStage: 'build'`, `failedError: 'Agent "build" failed...'`
3. Pipeline-fixer picks it up → retries=0 → triggers `cody.yml` rerun from `build`
4. If fails again with same error → retries=1 → triggers another rerun
5. If fails again with same error → retries=2 → creates pipeline-fix issue describing the problem, triggers Cody on it
6. Cody creates PR to fix the pipeline → you review and merge
7. Pipeline-fixer retries original task 2 more times with fixed pipeline
8. Task completes → PR created for issue 822 ✅
