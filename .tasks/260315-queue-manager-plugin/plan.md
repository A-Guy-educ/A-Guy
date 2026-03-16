# Plan: Cody Pipeline Queue Manager Plugin

## Research Findings

### File Paths Verified
- ✅ `scripts/inspector/core/types.ts` — InspectorPlugin, ActionRequest, InspectorContext, EvaluatedTask interfaces
- ✅ `scripts/inspector/core/inspector.ts` — Main inspector loop
- ✅ `scripts/inspector/plugins/registry.ts` — PluginRegistry class
- ✅ `scripts/inspector/index.ts` — Plugin registration entry point
- ✅ `scripts/inspector/clients/github.ts` — GitHubClient wrapper (triggerWorkflow, postComment, addLabel, removeLabel, getOpenIssues, etc.)
- ✅ `scripts/inspector/plugins/cody/health-check/index.ts` — Health check plugin (produces `cody:evaluatedTasks` in state)
- ✅ `scripts/inspector/plugins/cody/health-check/discovery.ts` — Task discovery from GitHub issues
- ✅ `scripts/inspector/plugins/cody/failure-analysis/index.ts` — Failure analysis plugin (LLM-powered diagnosis + retry)
- ✅ `scripts/inspector/plugins/cody/failure-analysis/classifier.ts` — Deterministic retry classification
- ✅ `scripts/inspector/plugins/cody/failure-analysis/analyzer.ts` — MiniMax LLM failure analysis
- ✅ `scripts/inspector/plugins/cody/failure-analysis/stage-router.ts` — Deterministic from_stage routing
- ✅ `src/ui/cody/components/TaskDetail.tsx` — Task detail view with action buttons
- ✅ `src/ui/cody/components/CodyDashboard.tsx` — Main dashboard with view modes
- ✅ `src/ui/cody/components/TaskList.tsx` — Task list with status indicators
- ✅ `src/ui/cody/hooks/useTaskActions.ts` — Task action mutations
- ✅ `src/app/api/cody/tasks/[taskId]/actions/route.ts` — Task actions API endpoint
- 🆕 `scripts/inspector/plugins/cody/queue-manager/` — New plugin directory
- 🆕 `tests/unit/scripts/inspector/queue-manager.test.ts` — New test file

### Patterns Observed
- Inspector plugins implement `InspectorPlugin` interface with `run(ctx)` returning `ActionRequest[]`
- Plugins are statically imported and registered in `scripts/inspector/index.ts`
- Inter-plugin communication uses `ctx.state.set()`/`ctx.state.get()` (health-check → failure-analysis handoff)
- LLM analysis uses MiniMax M2.5 via direct HTTP fetch (no SDK)
- GitHub operations use `gh` CLI via `execFileSync` wrapper in `clients/github.ts`
- Labels are the primary mechanism for task state management
- Dedup prevents repeated actions within configurable time windows
- Retry tracking uses comment tags like `[inspector-retry: N/M]`

### Integration Points
- Must register in `scripts/inspector/index.ts` — AFTER `healthCheckPlugin`, BEFORE `failureAnalysisPlugin`
- Reads `cody:evaluatedTasks` from `ctx.state` (produced by health-check plugin)
- Uses `ctx.github.triggerWorkflow('cody.yml', inputs)` to execute tasks
- Uses `ctx.github.postComment()` to approve gates (posts `/cody approve`)
- Uses `ctx.github.addLabel()` / `removeLabel()` for queue state transitions
- Dashboard actions extend `src/app/api/cody/tasks/[taskId]/actions/route.ts`

## Reuse Inventory

### Existing Code to Reuse
- `classifyRetryability()` from `scripts/inspector/plugins/cody/failure-analysis/classifier.ts` — pre-classify retryability without LLM
- `analyzeFailure()` from `scripts/inspector/plugins/cody/failure-analysis/analyzer.ts` — LLM-powered failure diagnosis
- `resolveFromStage()` from `scripts/inspector/plugins/cody/failure-analysis/stage-router.ts` — determine rerun start stage
- `readTaskFile()` from `scripts/inspector/clients/github.ts` — read task output files
- `discoverTasks()` from `scripts/inspector/plugins/cody/health-check/discovery.ts` — may reuse pattern for queue discovery
- `GitHubClient` interface from `scripts/inspector/core/types.ts` — all GitHub operations
- `EvaluatedTask` type from `scripts/inspector/core/types.ts` — task health evaluation results

### New Code Justified
- **`gate-reviewer.ts`** — No existing gate review logic exists. The health-check plugin only nudges humans; this adds AI-powered autonomous approval. Requires a new LLM prompt and review logic.
- **`queue-state.ts`** — Queue lifecycle management (activate/complete/fail/advance) is a new concept not covered by existing state helpers.
- **`index.ts` (plugin)** — The orchestration loop (check active → handle outcome → advance queue) is fundamentally new behavior.
- **UI queue button/view** — No queue concept exists in the dashboard UI today.

---

## Overview

Create a new inspector plugin (`cody-queue-manager`) that implements autonomous sequential task processing. Users add issues to a queue via a UI button (which adds a `cody:queued` label). The plugin picks up queued tasks one-by-one, runs them through the full Cody pipeline, auto-approves gates using AI review, monitors for failures, applies AI-powered diagnosis, and retries up to 2 times — all without human intervention.

## Architecture

```
Inspector (every 5 min) ─── cody-queue-manager plugin
                              │
                              ├── 1. Discover queued tasks (label: cody:queued)
                              ├── 2. Check: is any task currently active? (label: cody:queue-active)
                              │    ├── YES → monitor its health via evaluatedTasks
                              │    └── NO  → pick next from queue (FIFO by issue creation date)
                              ├── 3. Handle active task outcomes:
                              │    ├── RUNNING  → do nothing (wait for next cycle)
                              │    ├── GATED    → AI reviews gate output, auto-approves with feedback
                              │    ├── FAILED   → AI diagnoses, retries (up to 2 retries = 3 total attempts)
                              │    ├── COMPLETED → remove from queue, advance to next task
                              │    └── EXHAUSTED → mark as needs-human, advance to next task
                              └── 4. Save queue state for cross-cycle persistence
```

### Labels

| Label | Color | Purpose |
|-------|-------|---------|
| `cody:queued` | Blue (#0075ca) | Task is in the queue, waiting to be processed |
| `cody:queue-active` | Green (#0e8a16) | Task is currently being processed by the queue manager |
| `cody:queue-failed` | Red (#d73a4a) | Task exhausted retries, needs human intervention |

### State Persistence

Queue state stored in `ctx.state` (persisted to `.inspector/state.json`):

```typescript
// Key: 'queue:state'
{
  activeTaskId: string | null,
  activeIssueNumber: number | null,
  activeStartedAt: string | null,       // ISO timestamp
  retries: Record<string, number>,      // taskId → retry count (0-2)
  gateApprovals: Record<string, string[]> // taskId → list of auto-approved stages
}
```

---

## Step 1: Types (`scripts/inspector/plugins/cody/queue-manager/types.ts`)

**Files to Touch:**
- `scripts/inspector/plugins/cody/queue-manager/types.ts` (NEW)

**Behavior:**
Define TypeScript types for the queue manager:
- `QueueState` — persisted state across inspector cycles
- `QueuedTask` — a task waiting in the queue
- `GateReviewInput` / `GateReviewResult` — AI gate review I/O

**Tests:**
- No dedicated test needed (type-only file, validated by TypeScript compiler)

**Acceptance Criteria:**
- [ ] Types compile without errors (`pnpm tsc --noEmit`)
- [ ] Types are importable from queue-manager/index.ts

---

## Step 2: Queue State Helpers (`scripts/inspector/plugins/cody/queue-manager/queue-state.ts`)

**Files to Touch:**
- `scripts/inspector/plugins/cody/queue-manager/queue-state.ts` (NEW)

**Behavior:**
Helper functions for queue state management:

| Function | Input | Output | Side Effects |
|----------|-------|--------|--------------|
| `getQueueState(ctx)` | InspectorContext | QueueState | Reads from `ctx.state.get('queue:state')`, returns defaults if missing |
| `saveQueueState(ctx, state)` | InspectorContext, QueueState | void | Writes to `ctx.state.set('queue:state', state)` |
| `getQueuedTasks(ctx)` | InspectorContext | QueuedTask[] | Calls `ctx.github.getOpenIssues(['cody:queued'])`, sorts by `updatedAt` ascending (FIFO) |
| `getActiveTask(ctx)` | InspectorContext | QueuedTask \| null | Calls `ctx.github.getOpenIssues(['cody:queue-active'])`, returns first or null |
| `activateTask(ctx, task)` | InspectorContext, QueuedTask | void | Removes `cody:queued`, adds `cody:queue-active` label |
| `completeTask(ctx, task)` | InspectorContext, QueuedTask | void | Removes `cody:queue-active` label |
| `failTask(ctx, task)` | InspectorContext, QueuedTask | void | Removes `cody:queue-active`, adds `cody:queue-failed` label |
| `getRetryCount(state, taskId)` | QueueState, string | number | Returns `state.retries[taskId] ?? 0` |
| `incrementRetry(state, taskId)` | QueueState, string | QueueState | Returns new state with incremented retry count |

**Tests** (`tests/unit/scripts/inspector/queue-manager.test.ts`):
1. `getQueueState` returns defaults when state is empty
2. `getQueuedTasks` returns tasks sorted by updatedAt ascending
3. `activateTask` swaps labels correctly
4. `completeTask` removes active label
5. `failTask` swaps to failed label
6. `incrementRetry` correctly tracks retry count

**Acceptance Criteria:**
- [ ] All 6 helper tests pass
- [ ] State round-trips correctly (save then get returns same data)
- [ ] FIFO ordering confirmed (oldest first)

---

## Step 3: AI Gate Reviewer (`scripts/inspector/plugins/cody/queue-manager/gate-reviewer.ts`)

**Files to Touch:**
- `scripts/inspector/plugins/cody/queue-manager/gate-reviewer.ts` (NEW)

**Behavior:**
LLM-powered gate review using MiniMax M2.5 (same provider as failure-analysis/analyzer.ts):

| Function | Input | Output |
|----------|-------|--------|
| `reviewGate(input: GateReviewInput)` | `{ requirement, gateOutput, gateName, taskId }` | `GateReviewResult { approved, feedback, confidence }` |

**Gate Review Logic:**
1. System prompt: "You are a technical reviewer for an AI coding agent pipeline..."
2. User prompt contains: original requirement (issue body), gate output (task.json for taskify gate, plan.md for architect gate)
3. LLM evaluates: Does the spec/plan adequately address the requirement? Are there red flags?
4. Returns structured JSON: `{ approved: boolean, feedback: string, confidence: 0-1 }`
5. Fallback: If MINIMAX_API_KEY not set or API fails, defaults to `{ approved: true, feedback: "Auto-approved (no LLM available)", confidence: 0 }`

**System Prompt Guidelines:**
- Approve if the spec/plan covers the core requirement and has no critical gaps
- Reject if: requirement is misunderstood, scope is wrong, critical security concerns, or plan references nonexistent files/patterns
- Always provide feedback (even on approval) — refinement suggestions passed as context to next stage

**Tests:**
1. Gate review with valid spec → approves with high confidence
2. Gate review with mismatched spec → rejects with feedback
3. Fallback when no API key → auto-approves
4. API error → auto-approves with warning
5. Response parsing handles malformed JSON gracefully

**Acceptance Criteria:**
- [ ] LLM call uses MiniMax M2.5 endpoint (same as failure-analysis/analyzer.ts)
- [ ] Fallback always approves (fail-open for queue throughput)
- [ ] Feedback is always non-empty
- [ ] JSON parsing handles edge cases

---

## Step 4: Main Plugin (`scripts/inspector/plugins/cody/queue-manager/index.ts`)

**Files to Touch:**
- `scripts/inspector/plugins/cody/queue-manager/index.ts` (NEW)

**Behavior:**
The core orchestration plugin implementing `InspectorPlugin`:

```typescript
export const queueManagerPlugin: InspectorPlugin = {
  name: 'cody-queue-manager',
  description: 'Autonomous sequential task queue processor with AI gate approval and failure recovery',
  domain: 'cody',
  // Runs every cycle (5 min) — needs to be responsive for gate approvals
  run(ctx): Promise<ActionRequest[]>
}
```

**Run Logic (per cycle):**

```
1. Load queue state from ctx.state
2. Load evaluated tasks from ctx.state ('cody:evaluatedTasks')
3. Get active task (label: cody:queue-active)

IF no active task:
  a. Get queued tasks (label: cody:queued, FIFO order)
  b. If queue empty → log "Queue empty", return []
  c. Pick first task
  d. Return ActionRequest to activate and trigger it:
     - activateTask(ctx, task) — swap labels
     - ctx.github.triggerWorkflow('cody.yml', { task_id, mode: 'full' })
     - Post comment: "🚀 Queue Manager: Starting task (position 1 of N)"

IF active task found:
  a. Find its health in evaluatedTasks
  b. Switch on health:

  CASE 'healthy' | 'running':
     → Return [] (wait for next cycle)

  CASE 'gated':
     → Return ActionRequest to review gate:
       1. Read gate output: readTaskFile(taskId, 'task.json') or readTaskFile(taskId, 'plan.md')
       2. Read requirement: ctx.github.getIssue(issueNumber).body
       3. Call reviewGate()
       4. If approved:
          - Post comment: "/cody approve\n\n[queue-manager] AI Review: Approved. {feedback}"
          - Record in state.gateApprovals
       5. If rejected:
          - Post comment: "[queue-manager] AI Review: Changes requested.\n{feedback}"
          - Trigger rerun with feedback
       Dedup: 'queue-gate:{taskId}' / 15 min window

  CASE 'failed':
     → Return ActionRequest to diagnose and retry:
       1. Check retry count from state
       2. If retries >= 2 (MAX_RETRIES):
          - failTask(ctx, task) — swap to cody:queue-failed
          - Post comment: "Queue Manager: Max retries exhausted. Manual intervention needed."
          - Clean up state, advance to next task
       3. If retries < 2:
          - Reuse classifyRetryability() for pre-classification
          - If non-retryable → fail immediately
          - If retryable → call analyzeFailure() for LLM diagnosis
          - Increment retry count in state
          - Trigger rerun: ctx.github.triggerWorkflow('cody.yml', { task_id, mode: 'rerun', from_stage, feedback })
          - Post comment: "[queue-manager-retry: N/2] Failure Analysis: {rootCause}. Retrying from {fromStage}."
       Dedup: 'queue-retry:{taskId}' / 15 min window

  CASE 'completed':
     → Return ActionRequest to complete and advance:
       1. completeTask(ctx, task) — remove cody:queue-active
       2. Clean retry state for this task
       3. Get next queued task
       4. If next exists → activate and trigger it
       5. Post comment: "✅ Queue Manager: Task completed. {next ? 'Starting next: ...' : 'Queue empty.'}"
       Dedup: 'queue-complete:{taskId}' / 30 min window

  CASE 'orphaned' | 'stalled':
     → Treat as failed (same logic as CASE 'failed')

  CASE 'unknown':
     → Check if task was recently activated (< 10 min ago)
       - If yes → wait (pipeline may still be starting)
       - If no → treat as failed

4. Save queue state
5. Return collected actions
```

**Constants:**
- `MAX_RETRIES = 2` (3 total attempts including initial)
- `STARTUP_GRACE_PERIOD_MS = 10 * 60 * 1000` (10 min grace for new tasks)

**Tests:**
1. Empty queue, no active task → no actions
2. Queue has tasks, no active → activates first task and triggers workflow
3. Active task is healthy → no actions (wait)
4. Active task is gated → creates gate review action
5. Active task is gated → gate approval posts `/cody approve` comment
6. Active task is gated → gate rejection triggers rerun with feedback
7. Active task failed, retries remaining → creates retry action with LLM analysis
8. Active task failed, retries exhausted → creates fail action, advances queue
9. Active task failed, non-retryable → fails immediately without retry
10. Active task completed → completes and activates next in queue
11. Active task completed, queue empty → completes without activating next
12. Active task orphaned → treated as failed
13. Active task unknown, recently activated → waits (grace period)
14. Active task unknown, stale → treated as failed
15. Retry count persists across cycles via state
16. Dedup prevents duplicate actions within window

**Acceptance Criteria:**
- [ ] All 16 tests pass
- [ ] Plugin implements `InspectorPlugin` interface correctly
- [ ] Reads `cody:evaluatedTasks` from state (dependency on health-check)
- [ ] Uses dedup keys to prevent duplicate actions
- [ ] Retry tracking survives across inspector cycles
- [ ] Gate approval posts the correct `/cody approve` comment format
- [ ] Workflow triggers use correct input format (`task_id`, `mode`, `from_stage`, `feedback`)

---

## Step 5: Register Plugin (`scripts/inspector/index.ts`)

**Files to Touch:**
- `scripts/inspector/index.ts` (MODIFIED)

**Behavior:**
- Import `queueManagerPlugin` from `./plugins/cody/queue-manager/index`
- Register it after `healthCheckPlugin` and before `failureAnalysisPlugin`
- Registration order matters: health-check produces `cody:evaluatedTasks`, queue-manager consumes it

**Diff (conceptual):**
```typescript
import { queueManagerPlugin } from './plugins/cody/queue-manager/index'

// After: registry.register(healthCheckPlugin)
registry.register(queueManagerPlugin)
// Before: registry.register(failureAnalysisPlugin)
```

**Tests:**
1. Integration: verify plugin is registered and runs without error in inspector loop

**Acceptance Criteria:**
- [ ] Plugin appears in `registry.getAll()`
- [ ] Plugin runs after health-check (can read evaluatedTasks)
- [ ] No duplicate name error
- [ ] `pnpm tsc --noEmit` passes

---

## Step 6: UI — "Add to Queue" / "Remove from Queue" Actions

**Files to Touch:**
- `src/app/api/cody/tasks/[taskId]/actions/route.ts` (MODIFIED — add `add-to-queue` and `remove-from-queue` action handlers)
- `src/ui/cody/components/TaskDetail.tsx` (MODIFIED — add queue buttons to action menu)
- `src/ui/cody/hooks/useTaskActions.ts` (MODIFIED — add `addToQueue` and `removeFromQueue` mutations)

**Behavior:**

### API (`actions/route.ts`):
- `add-to-queue` action: Calls GitHub API to add `cody:queued` label to the issue
- `remove-from-queue` action: Calls GitHub API to remove `cody:queued` label from the issue

### UI (`TaskDetail.tsx`):
- Add "Add to Queue" button in the overflow action menu
  - Shown when: task has NO `cody:queued`, `cody:queue-active`, or `cody:queue-failed` labels
  - On click: calls `addToQueue` mutation
- Add "Remove from Queue" button
  - Shown when: task has `cody:queued` label (waiting, not yet active)
  - On click: calls `removeFromQueue` mutation
- Show queue status indicator when task has queue-related labels

### Hook (`useTaskActions.ts`):
- Add `addToQueue(taskId)` mutation — calls `/api/cody/tasks/{taskId}/actions` with `{ action: 'add-to-queue' }`
- Add `removeFromQueue(taskId)` mutation — calls `/api/cody/tasks/{taskId}/actions` with `{ action: 'remove-from-queue' }`

**Tests:**
1. "Add to Queue" button visible for non-queued tasks
2. "Remove from Queue" button visible for queued (waiting) tasks
3. Neither button visible for active/failed queue tasks
4. API action adds `cody:queued` label
5. API action removes `cody:queued` label

**Acceptance Criteria:**
- [ ] Button visibility logic correct based on labels
- [ ] API actions correctly add/remove labels
- [ ] Toast notification on success
- [ ] Optimistic update in task list

---

## Step 7: UI — Queue View in Dashboard

**Files to Touch:**
- `src/ui/cody/components/CodyDashboard.tsx` (MODIFIED — add "Queue" view mode)
- `src/ui/cody/components/QueueView.tsx` (NEW — queue-specific task list)
- `src/ui/cody/components/TaskList.tsx` (MODIFIED — support queue status rendering)

**Behavior:**

### Dashboard (`CodyDashboard.tsx`):
- Add "Queue" as a third view mode alongside "Running" and "Backlog"
- When "Queue" is selected, show tasks filtered by queue labels (`cody:queued`, `cody:queue-active`, `cody:queue-failed`)
- Show queue summary: "N queued · 1 active · M failed"

### QueueView (`QueueView.tsx`):
- Displays queued tasks in a vertical list with:
  - Position number (1, 2, 3...)
  - Task title and issue number
  - Queue status badge: "Waiting" (blue), "Active" (green), "Failed" (red)
  - For active task: show pipeline progress (reuse MiniPipelineProgress component)
  - For failed task: show retry count and failure reason
  - Action buttons: "Remove from Queue" (for waiting), "Retry" (for failed)
- Empty state: "No tasks in queue. Add tasks from the backlog."

### TaskList (`TaskList.tsx`):
- Add queue position indicator when task has `cody:queued` label
- Show queue status badge in task row

**Tests:**
1. Queue view shows only queue-labeled tasks
2. Tasks are ordered: active first, then queued (FIFO), then failed
3. Queue summary counts are correct
4. Empty state shown when queue is empty

**Acceptance Criteria:**
- [ ] "Queue" tab appears in dashboard navigation
- [ ] Queue view filters correctly by labels
- [ ] Active task shows pipeline progress
- [ ] Failed tasks show retry info
- [ ] Remove from queue works from queue view

---

## Step 8: Create GitHub Labels

**Manual step or script:**
Create three labels in the GitHub repository:
- `cody:queued` — color `#0075ca` (blue), description "Task is in the Cody queue, waiting to be processed"
- `cody:queue-active` — color `#0e8a16` (green), description "Task is currently being processed by the queue manager"
- `cody:queue-failed` — color `#d73a4a` (red), description "Task exhausted queue retries, needs human intervention"

Can be done via:
```bash
gh label create "cody:queued" --color "0075ca" --description "Task is in the Cody queue"
gh label create "cody:queue-active" --color "0e8a16" --description "Active queue task"
gh label create "cody:queue-failed" --color "d73a4a" --description "Queue task failed, needs human help"
```

**Acceptance Criteria:**
- [ ] All 3 labels exist in the repository
- [ ] Labels are visible in the GitHub UI and API

---

## Step 9: Tests

**Files to Touch:**
- `tests/unit/scripts/inspector/queue-manager.test.ts` (NEW)

**Test Structure:**

```
describe('cody-queue-manager plugin')
  describe('queue-state helpers')
    - getQueueState defaults
    - getQueuedTasks FIFO ordering
    - activateTask label swap
    - completeTask label removal
    - failTask label swap
    - incrementRetry tracking

  describe('gate-reviewer')
    - approve valid spec
    - reject mismatched spec
    - fallback without API key
    - handle API error
    - parse malformed JSON

  describe('main plugin')
    - empty queue → no actions
    - queue with tasks, no active → activate first
    - active task healthy → wait
    - active task gated → gate review
    - active task failed + retries remaining → retry
    - active task failed + retries exhausted → fail + advance
    - active task failed + non-retryable → fail immediately
    - active task completed → complete + advance
    - active task completed + queue empty → complete only
    - active task orphaned → treat as failed
    - startup grace period for unknown tasks
    - dedup prevents duplicate actions
    - retry count persists across cycles
```

**Test Approach:**
- Mock `InspectorContext` (same pattern as existing inspector tests)
- Mock `GitHubClient` methods (getOpenIssues, triggerWorkflow, postComment, addLabel, removeLabel)
- Mock `StateStore` (in-memory implementation)
- Mock MiniMax API calls (for gate-reviewer and failure analysis)
- Use vitest

**Acceptance Criteria:**
- [ ] All tests pass: `pnpm vitest run tests/unit/scripts/inspector/queue-manager.test.ts`
- [ ] No type errors: `pnpm tsc --noEmit`
- [ ] Tests cover all critical paths (queue lifecycle, gate approval, failure recovery, state persistence)

---

## Estimated Effort

| Step | Component | Est. Lines | Est. Time |
|------|-----------|-----------|-----------|
| 1 | Types | ~30 | 10 min |
| 2 | Queue state helpers | ~80 | 20 min |
| 3 | AI gate reviewer | ~120 | 25 min |
| 4 | Main plugin | ~250 | 30 min |
| 5 | Register plugin | ~5 | 5 min |
| 6 | UI: Queue buttons + API | ~80 | 20 min |
| 7 | UI: Queue view | ~150 | 25 min |
| 8 | GitHub labels | ~3 commands | 5 min |
| 9 | Tests | ~300 | 30 min |
| **Total** | | **~1015** | **~170 min** |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Gate auto-approval passes bad specs | Fail-open design: worst case is a bad build that gets caught by verify stage. LLM review adds quality, not gates it. |
| Inspector cycle (5 min) too slow for gates | Acceptable per requirements. Gate pauses are not time-critical. Total overhead: ~5-10 min per gate. |
| Queue state lost between cycles | Persisted in `.inspector/state.json` via `ctx.state`. Inspector has atomic write (write-to-temp + rename). |
| Conflict with existing failure-analysis plugin | Queue manager handles retries for `cody:queue-active` tasks only. Non-queued failed tasks still handled by failure-analysis. Add guard in failure-analysis to skip queue-active tasks. |
| MiniMax API unavailable | All LLM calls have fallbacks: gate reviewer auto-approves, failure analyzer uses previous feedback or generic retry. |
| Multiple queue managers running concurrently | Inspector workflow has `concurrency: group: inspector` — only one instance runs at a time. |
