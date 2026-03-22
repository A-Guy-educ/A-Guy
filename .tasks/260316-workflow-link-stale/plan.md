# Plan: Fix Stale Workflow Run Links on Dashboard

**Task Type**: fix_bug
**Issue**: #839 — Cody runs issue but dashboard workflow links to ended workflow

## Research Findings

### File paths verified
- ✅ `src/ui/cody/github-client.ts` — `fetchWorkflowRuns()` at lines 602-632, maps workflow run data from GitHub API
- ✅ `src/app/api/cody/tasks/route.ts` — Task list API with workflow run matching at lines 162-227
- ✅ `src/app/api/cody/tasks/[taskId]/route.ts` — Single task detail API, also matches workflow runs at lines 148, 214
- ✅ `src/app/api/cody/pipeline/[taskId]/route.ts` — Pipeline route with matching at lines 67-68
- ✅ `src/ui/cody/types.ts` — `WorkflowRun` type at line 191, includes `head_branch?: string` (defined but never populated)
- ✅ `src/ui/cody/components/MiniPipelineProgress.tsx` — Uses `workflowRun.html_url` for external link at line 138
- ✅ `src/ui/cody/components/WorkflowRunsPopover.tsx` — Popover shows `run.head_branch` at line 161
- ✅ `tests/unit/ui/cody/pipeline-display-state.test.ts` — Existing test patterns
- ✅ `tests/unit/scripts/cody/get-column-for-issue.test.ts` — Column derivation test patterns

### Root Cause Analysis

The dashboard shows a stale/ended workflow run link for issue 839 while the actual run is still active. The bug is in **workflow run matching** across three API routes:

**Bug A — Missing `head_branch` in `fetchWorkflowRuns()`**
- `fetchWorkflowRuns()` in `github-client.ts` (line 620-628) maps workflow run data from GitHub but OMITS the `head_branch` field
- The `WorkflowRun` type has `head_branch?: string` and the `WorkflowRunsPopover` component uses `run.head_branch` for display
- GitHub API provides `head_branch` in the response but we don't include it in our mapping

**Bug B — Workflow run matching prefers stale completed runs over active runs**
- In `tasks/route.ts` (lines 172-180), `runsByTitle` map keeps only the FIRST (most recent by date) run per `display_title`
- When there are multiple runs for the same task (reruns), the most recent run could be the COMPLETED old run (still showing in API before the new active run), causing the dashboard to link to the ended workflow
- For `workflow_dispatch` triggers, `display_title` may be generic (e.g., "cody"), causing ALL dispatch runs to map to a single key → cross-task mismatches
- The matching should prefer `in_progress` > `queued` > most recent `completed`

**Bug C — Unreliable fallback matching across all routes**
- `tasks/route.ts` (line 226): `run.html_url.includes(taskId)` — html_url contains numeric run ID, not task ID
- `tasks/[taskId]/route.ts` (line 148): `r.html_url.includes(issueNumberFromUrl.toString())` — issue number `839` could match run ID `12839456` (substring match)
- `pipeline/[taskId]/route.ts` (line 68): `r.html_url.includes(taskId)` — same unreliable pattern

### Patterns observed
- Workflow runs from GitHub API include: `id`, `status`, `conclusion`, `created_at`, `updated_at`, `html_url`, `display_title`, `head_branch`
- The `runsByTitle` map in `tasks/route.ts` is a flat `Map<string, WorkflowRun>` (single entry per title)
- All three route files independently implement run matching with slightly different (all broken) approaches
- Existing `WorkflowRun` type already has `head_branch?: string` — just needs to be populated

### Integration points
- `fetchWorkflowRuns()` is called from: `tasks/route.ts`, `tasks/[taskId]/route.ts`, `pipeline/[taskId]/route.ts`, `workflows/route.ts`
- `task.workflowRun` is set in `tasks/route.ts` lines 296-304 → consumed by `MiniPipelineProgress`, `TaskDetail`, `TaskList`
- New shared matching function needs to be importable from all three API routes

## Reuse Inventory
- Reuse `WorkflowRun` type from `src/ui/cody/types.ts` — already has `head_branch?: string` ✅
- Reuse `fetchWorkflowRuns()` from `src/ui/cody/github-client.ts` — modify to include `head_branch`
- Reuse test patterns from `tests/unit/scripts/cody/get-column-for-issue.test.ts`
- No existing matching utility — creating `matchWorkflowRunToTask` (justified: DRY across 3 routes)

---

## Step 1: Add `head_branch` to `fetchWorkflowRuns()` mapping (Bug A)

**Root Cause**: `fetchWorkflowRuns()` maps GitHub API data but omits `head_branch`, losing useful data that the `WorkflowRunsPopover` already tries to render.

**Files to Touch:**
- `src/ui/cody/github-client.ts` (MODIFIED — line 627)

**Fix:**
In `fetchWorkflowRuns()` (line 620-628), add to the mapped object:
```typescript
head_branch: (run as any).head_branch ?? undefined,
```

**Reproduction Test:**
- Test location: `tests/unit/ui/cody/workflow-run-matching.test.ts` (NEW)
- Test: `WorkflowRun type includes head_branch field`
  - Verify the field is properly typed (this is a type-level check, not runtime — verified by TypeScript compilation)
  - Why it fails: `head_branch` is always `undefined` because it's never mapped from the API response

**Acceptance Criteria:**
- [ ] `WorkflowRun` objects include `head_branch` from GitHub API
- [ ] `WorkflowRunsPopover` can display branch info (it already renders `run.head_branch`)
- [ ] TypeScript compiles

---

## Step 2: Create shared `matchWorkflowRunToTask` utility and update task list route (Bug B + C)

**Root Cause**: The workflow run matching in `tasks/route.ts` keeps only one run per `display_title` (the most recent). When a completed run is more recent than an active rerun (timing/caching), or when `display_title` is generic for dispatch triggers, the wrong (stale) run is shown. Additionally, the fallback `html_url.includes(taskId)` matching is unreliable.

**Files to Touch:**
- `src/ui/cody/workflow-matching.ts` (NEW — shared utility)
- `src/app/api/cody/tasks/route.ts` (MODIFIED — lines 172-227, replace matching logic)

**Behavior:**

Create a pure function in `src/ui/cody/workflow-matching.ts`:

```typescript
export function matchWorkflowRunToTask(
  runs: WorkflowRun[],
  issueTitle: string,
  issueNumber: number,
  taskId: string,
): WorkflowRun | undefined
```

Algorithm:
1. Collect ALL candidate runs matching the task:
   - `display_title === issueTitle` (exact title match)
   - `display_title` contains `#${issueNumber}` (issue reference)
   - `taskId` is non-empty and `display_title` includes `taskId`
2. From candidates, prefer by status priority:
   - `in_progress` (actively running) — best for active tasks
   - `queued` (waiting to start) — next best
   - Most recent `completed` (finished) — fallback
3. If no candidates found, return `undefined` (no weak fallback via html_url — that causes false positives)

In `tasks/route.ts`, replace lines 172-227 (the `runsByTitle` map + matching):
- Remove the `runsByTitle` map entirely
- In the `issues.map()` loop, call `matchWorkflowRunToTask(workflowRuns, issue.title, issue.number, taskId)` directly

**Reproduction Test:**
- Test location: `tests/unit/ui/cody/workflow-run-matching.test.ts` (NEW)

Test 1: `prefers in_progress run over completed run with same display_title`
- Input: `runs = [{ status: 'completed', display_title: 'Fix widget' }, { status: 'in_progress', display_title: 'Fix widget' }]`, issueTitle = 'Fix widget'
- Expected: Returns the `in_progress` run
- Why it fails now: Current code keeps only the first run per title (most recent = completed)

Test 2: `returns most recent completed run when no active runs exist`
- Input: `runs = [{ status: 'completed', display_title: 'Fix widget', created_at: '2026-03-16T12:00:00Z' }, { status: 'completed', display_title: 'Fix widget', created_at: '2026-03-15T12:00:00Z' }]`
- Expected: Returns the first (most recent) completed run
- Why it fails: N/A (should pass from the start, verifies fallback behavior)

Test 3: `does not match by issue number substring in html_url (prevents false positives)`
- Input: `runs = [{ status: 'in_progress', html_url: '.../runs/12839456', display_title: 'Other task' }]`, issueNumber = 839
- Expected: Returns `undefined`
- Why it fails now: Current code's `html_url.includes('839')` would false-positive match

Test 4: `matches by issue number reference in display_title`
- Input: `runs = [{ status: 'in_progress', display_title: 'Fix #839 - widget' }]`, issueNumber = 839
- Expected: Returns the run
- Why it fails: Current code only does exact title match

Test 5: `returns undefined when no runs match`
- Input: `runs = [{ status: 'completed', display_title: 'Other task' }]`, issueTitle = 'Fix widget'
- Expected: Returns `undefined`

Test 6: `prefers queued over completed when no in_progress exists`
- Input: `runs = [{ status: 'completed', display_title: 'Fix widget' }, { status: 'queued', display_title: 'Fix widget' }]`
- Expected: Returns the `queued` run

**Acceptance Criteria:**
- [ ] `matchWorkflowRunToTask` is exported from `src/ui/cody/workflow-matching.ts`
- [ ] Active tasks show link to active workflow run, not stale completed one
- [ ] No false-positive matches from html_url substring
- [ ] `tasks/route.ts` uses the shared function
- [ ] All 6 tests pass

---

## Step 3: Update task detail and pipeline routes to use shared matching (Bug C)

**Root Cause**: `tasks/[taskId]/route.ts` (lines 148, 214) and `pipeline/[taskId]/route.ts` (line 68) use unreliable `html_url.includes()` matching. This must be replaced with the shared `matchWorkflowRunToTask` function.

**Files to Touch:**
- `src/app/api/cody/tasks/[taskId]/route.ts` (MODIFIED — lines 148, 214)
- `src/app/api/cody/pipeline/[taskId]/route.ts` (MODIFIED — lines 67-68)

**Fix:**

In `tasks/[taskId]/route.ts`:
- Import `matchWorkflowRunToTask` from `@/ui/cody/workflow-matching`
- Line 148: Replace `runs.find((r) => r.html_url.includes(issueNumberFromUrl.toString()))` with `matchWorkflowRunToTask(runs, issue.title, issueNumber, taskId)`
- Line 214: Replace `runs.find((r) => r.html_url.includes(taskId))` with `matchWorkflowRunToTask(runs, issue.title, issue.number, taskId)`

In `pipeline/[taskId]/route.ts`:
- Import `matchWorkflowRunToTask` from `@/ui/cody/workflow-matching`
- Line 68: Replace `workflowRuns.find((r) => r.html_url.includes(taskId))` with `matchWorkflowRunToTask(workflowRuns, '', 0, taskId)` (pipeline route may not have issue title/number context — pass what's available)

**Tests:**
- Add to `tests/unit/ui/cody/workflow-run-matching.test.ts`:
- Test 7: `handles empty issueTitle and zero issueNumber gracefully`
  - Input: `runs = [{ status: 'in_progress', display_title: 'cody' }]`, issueTitle = '', issueNumber = 0, taskId = '260315-auto-839'
  - Expected: Returns `undefined` if display_title doesn't match taskId

**Acceptance Criteria:**
- [ ] All three API routes use `matchWorkflowRunToTask` from shared utility
- [ ] No `html_url.includes()` matching remains in any route
- [ ] TypeScript compiles: `pnpm tsc --noEmit`

---

## Step 4: Run quality gates and verify

**Files to Touch:** None (verification only)

**Commands:**
```bash
pnpm tsc --noEmit
pnpm vitest run tests/unit/ui/cody/
pnpm lint
```

**Acceptance Criteria:**
- [ ] TypeScript compilation succeeds
- [ ] All unit tests pass (new + existing)
- [ ] Lint passes
- [ ] No `html_url.includes(taskId)` patterns remain in route files
- [ ] Active tasks show links to active workflow runs
