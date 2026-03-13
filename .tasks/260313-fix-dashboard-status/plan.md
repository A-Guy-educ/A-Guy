# Plan: Fix Cody Dashboard Status Inconsistencies

**Task ID**: 260313-fix-dashboard-status
**Task Type**: fix_bug
**Risk Level**: medium
**Primary Domain**: frontend

---

## Problem Summary

The Cody dashboard task list shows inaccurate, inconsistent status information:

1. **"Starting" and "Building" shown simultaneously** — contradictory states displayed in parallel
2. **Random/inconsistent dot counts** — some tasks show 6 dots, others show 12, some show none; no consistent bullet pattern per step
3. **No proper status transitions** — tasks don't transition cleanly between states (e.g., risk-gated tasks show "Building" instead of gate status)
4. **Inconsistent descriptions per step** — stage labels vary or are missing across tasks
5. **Each task shows a different visual layout** — some show shimmer bar, some show dots + label, some show spinner, creating a chaotic visual experience
6. **Risk-gated tasks show "Building" phase** — tasks with `risk-gated` label incorrectly display as "Building" with a spinner instead of showing the gate-waiting state

---

## Root Cause Analysis

There are **three interacting bugs**:

### Bug A: Column derivation race condition (`getColumnForIssue`)
In `src/app/api/cody/tasks/route.ts` lines 25-77, `getColumnForIssue()` checks gate labels (`hard-stop`, `risk-gated`) at priority #2, BUT `cody:planning`/`cody:building` labels are checked at priority #3. The problem: when a pipeline hits a risk gate, the `risk-gated` label IS added, but the `cody:planning` label is NOT removed. So the gate check (#2) correctly catches this. However, on a **rerun** or when the gate approval is processed, the `risk-gated` label may still be present while the pipeline is actually running — causing the task to show as `gate-waiting` when it should show as `building`. The inverse can also occur: if the API returns labels in an unexpected order or the `risk-gated` label removal is delayed, the task shows as `building` when it should be `gate-waiting`.

### Bug B: MiniPipelineProgress shows wrong variant for state
In `src/ui/cody/components/MiniPipelineProgress.tsx`, the inline variant (line 90-145) and bar variant (line 191-316) both have 5 rendering cases, but the logic doesn't account for:
- `pipeline.state === 'paused'` when `task.column === 'building'` (the task is at a gate but the column hasn't caught up)
- `pipeline` being `undefined` for actively building tasks where branch discovery failed (falls through to Case 5 which shows a generic "Starting..." shimmer indefinitely)

### Bug C: Inconsistent dot rendering
The `InlineDots` component (line 149-184) shows 6 dots (compressed from 12 stages), while `StageDots` (line 336-364) shows 12 dots (one per stage). These are used in different contexts but look completely different on the same screen, creating visual chaos.

---

## Assumptions

1. The pipeline engine correctly sets `status.json` with accurate `state` and `currentStage` values
2. The GitHub labels are the source of truth for column assignment, but may have timing delays
3. The fix should make the dashboard consistently derive and display status from pipeline data when available, falling back to labels only when pipeline data is absent
4. Tests will be unit tests for the pure logic functions and component rendering tests using Vitest + React Testing Library

---

### Step 1: Fix `getColumnForIssue` to use pipeline state as primary signal

**Root Cause**: `getColumnForIssue()` relies solely on GitHub labels, which have timing delays. When pipeline data IS available (fetched from `status.json` on the branch), it should be the authoritative source for the column, not labels.

**Files to Touch**:
- `src/app/api/cody/tasks/route.ts` (MODIFIED - lines 25-77, 200-210)

**Current behavior**: `getColumnForIssue(issue, workflowRun, associatedPR)` only uses labels/workflow/PR data. Pipeline status (fetched at lines 183-198) is stored on the task but never influences column assignment.

**New behavior**: Add a new function `deriveColumnFromPipeline(pipelineStatus)` that maps pipeline state to column:
- `pipeline.state === 'running'` → `'building'`
- `pipeline.state === 'paused'` → `'gate-waiting'`
- `pipeline.state === 'completed'` → `'review'` (if no PR) or `'done'`
- `pipeline.state === 'failed'` or `'timeout'` → `'failed'`

Then in the task mapping (line 201), use: `const column = pipelineStatus ? deriveColumnFromPipeline(pipelineStatus) : getColumnForIssue(issue, workflowRun, pr)`. Also derive `gateType` from pipeline data: if `pipeline.state === 'paused'` and `pipeline.controlMode` is set, use it; otherwise fall back to label-based detection.

**Reproduction Test**: 
- Test location: `tests/unit/ui/cody/derive-column.test.ts`
- Test: `deriveColumnFromPipeline({ state: 'paused', controlMode: 'risk-gated' })` should return `'gate-waiting'`
- Test: `deriveColumnFromPipeline({ state: 'running', currentStage: 'build' })` should return `'building'`
- Test: Given a task with `risk-gated` label AND pipeline state `running`, the final column should be `'building'` (pipeline wins over stale labels)
- Why it fails now: Function doesn't exist yet; labels produce wrong column when stale

**Fix**:
1. Extract `deriveColumnFromPipeline(pipeline: CodyPipelineStatus): ColumnId` function
2. Extract `deriveGateType(pipeline?: CodyPipelineStatus, labels?: string[]): 'hard-stop' | 'risk-gated' | undefined`
3. Use pipeline-first column derivation: `const column = pipelineStatus ? deriveColumnFromPipeline(pipelineStatus) : getColumnForIssue(issue, workflowRun, pr)`

**Verification**:
- Run test → FAILS before (function doesn't exist)
- After fix → PASSES
- Risk-gated tasks with active pipelines no longer show "Building"

**Acceptance Criteria**:
- [ ] `deriveColumnFromPipeline()` exists and is tested for all 5 pipeline states
- [ ] Tasks with pipeline data use pipeline state for column, not labels
- [ ] Tasks without pipeline data fall back to label-based column (no regression)
- [ ] `gateType` correctly derived from pipeline `controlMode` when available

---

### Step 2: Normalize MiniPipelineProgress rendering to consistent visual patterns

**Root Cause**: The `MiniPipelineProgress` component has 5 rendering cases per variant (inline + bar), producing wildly different visuals per task depending on which case matches. Tasks in the same column look completely different.

**Files to Touch**:
- `src/ui/cody/components/MiniPipelineProgress.tsx` (MODIFIED - lines 78-316)
- `src/ui/cody/pipeline-utils.ts` (MODIFIED - add `derivePipelineDisplayState()`)

**Current behavior**: 
- Case 1 (running + currentStage): dots + label ✓
- Case 2 (running, no currentStage): shimmer "Starting..." — shows indefinitely if branch discovery fails
- Case 3 (paused): Pause icon + "Approval" — but only if `pipeline.state === 'paused'`, which doesn't trigger when column is `building` 
- Case 4 (has stages data): ratio like "7/12"
- Case 5 (no pipeline): generic spinner "Starting..."/"Running"
- InlineDots uses 6 dots, StageDots uses 12 dots — inconsistent

**New behavior**: 
1. Create `derivePipelineDisplayState(task: CodyTask)` in `pipeline-utils.ts` that returns a single discriminated union: `{ kind: 'stage-progress', stageIndex, label, stepNumber, totalStages }` | `{ kind: 'gate-paused', stageIndex, gateType }` | `{ kind: 'starting' }` | `{ kind: 'no-data', workflowStatus }`. This centralizes the decision logic.
2. Both inline and bar variants consume the same display state — guaranteeing consistent visuals.
3. **Normalize dot count**: Always show exactly 12 dots (one per ALL_STAGES) in both variants. Remove the 6-dot `InlineDots` component. The inline variant uses smaller dots (w-1 h-1) but same count. This eliminates the "random number" visual.
4. Add a timeout for "Starting..." — if a task has been in `building` column for >5 minutes with no pipeline data, show "Waiting for pipeline..." instead of indefinite "Starting...".

**Reproduction Test**:
- Test location: `tests/unit/ui/cody/pipeline-display-state.test.ts`
- Test: `derivePipelineDisplayState(taskWithPausedPipeline)` returns `{ kind: 'gate-paused' }`
- Test: `derivePipelineDisplayState(taskRunningWithStage)` returns `{ kind: 'stage-progress', stageIndex: 5 }`
- Test: `derivePipelineDisplayState(taskRunningNoStage)` returns `{ kind: 'starting' }`
- Test: `derivePipelineDisplayState(taskBuildingNoPipeline)` returns `{ kind: 'no-data', workflowStatus: 'in_progress' }`
- Why it fails now: Function doesn't exist

**Fix**:
1. Add `derivePipelineDisplayState()` to `pipeline-utils.ts`
2. Refactor `InlineVariant` and `BarVariant` to use the new function
3. Remove `InlineDots` component, replace with `StageDots` using smaller sizing for inline
4. Both variants always render 12 dots when showing progress

**Verification**:
- Run test → FAILS (function doesn't exist)
- After fix → PASSES
- All tasks in "Building" column show consistent 12-dot progress bars

**Acceptance Criteria**:
- [ ] `derivePipelineDisplayState()` is tested for all task states
- [ ] All tasks show exactly 12 dots (never 6) when showing progress
- [ ] Gate-paused tasks show yellow dots + "Awaiting approval" (never "Starting...")
- [ ] Tasks without pipeline data show appropriate status text with spinner
- [ ] No more "Starting..." shown indefinitely for tasks that have been building for minutes

---

### Step 3: Fix TaskList inline status to show sub-status consistently

**Root Cause**: In `TaskList.tsx` line 270, `MiniPipelineProgress` is only rendered when `isActive` (column is `building` or `retrying`). But gate-waiting tasks also need to show pipeline progress (they're paused mid-pipeline). Also, the meta row (line 239) shows `gateLabel` from `statusLabel[task.column]`, but for gate-waiting tasks this shows generic "Gate" when it should show "Risk Gated" or "Hard Stop" with the specific stage name.

**Files to Touch**:
- `src/ui/cody/components/TaskList.tsx` (MODIFIED - lines 176-177, 239-270, 434-442)
- `src/ui/cody/pipeline-utils.ts` (MODIFIED - add `getTaskSubStatusText()`)

**Current behavior**:
- `isActive` only checks `building` or `retrying` — gate-waiting tasks don't show pipeline progress
- Gate label shows "Risk Gated" but not which stage it's paused at
- The meta row description varies wildly: some tasks show "Starting", some show "Committing 7/12", some show nothing

**New behavior**:
1. Add `getTaskSubStatusText(task: CodyTask): string` to `pipeline-utils.ts` that returns a consistent one-line sub-status: e.g., "Building · 7/12", "Awaiting approval at Architect", "Starting pipeline...", "Verifying · 10/12"
2. Show `MiniPipelineProgress` for gate-waiting tasks too (they have pipeline data)
3. Replace the ad-hoc inline status elements with the consistent `getTaskSubStatusText()` output
4. Show pipeline progress bar for gate-waiting tasks (paused state with yellow current dot)

**Reproduction Test**:
- Test location: `tests/unit/ui/cody/task-substatus.test.ts`
- Test: `getTaskSubStatusText(gateWaitingTask)` returns `"Awaiting approval at Architecting"`
- Test: `getTaskSubStatusText(buildingTaskAtStage)` returns `"Building · 6/12"`
- Test: `getTaskSubStatusText(buildingTaskNoData)` returns `"Starting pipeline..."`
- Why it fails now: Function doesn't exist

**Fix**:
1. Add `getTaskSubStatusText()` to `pipeline-utils.ts`
2. In `TaskList.tsx`, change `isActive` to include `gate-waiting`: `const isActive = task.column === 'building' || task.column === 'retrying' || task.column === 'gate-waiting'`
3. Show consistent sub-status text in the meta row
4. Show pipeline progress bar row for gate-waiting tasks

**Verification**:
- Run test → FAILS (function doesn't exist)
- After fix → PASSES
- Gate-waiting tasks show pipeline progress with yellow pause indicator
- All building tasks show consistent format

**Acceptance Criteria**:
- [ ] `getTaskSubStatusText()` tested for all column/pipeline combinations
- [ ] Gate-waiting tasks show pipeline progress bar (not just a static badge)
- [ ] All tasks in the same state show the same visual pattern
- [ ] Sub-status text follows consistent format: "{Stage Label} · {N}/{Total}" or "Awaiting approval at {Stage}"

---

### Step 4: Fix CodyStatusBanner to use pipeline-derived stage

**Root Cause**: In `CodyStatusBanner.tsx` lines 33-61, `deriveCodyState()` infers the current stage by scanning `pipeline.stages` to find the "highest touched" stage. This can produce wrong results when stages complete out of order or when the stage data is stale. The `pipeline.currentStage` field should be the primary source.

**Files to Touch**:
- `src/ui/cody/components/CodyStatusBanner.tsx` (MODIFIED - lines 33-61, 128-210)

**Current behavior**: The banner manually scans `pipeline.stages` entries to find the highest non-pending stage. This can show "Verifying" when the task is actually at "Building" if `verify` has stale data from a previous run.

**New behavior**:
1. Use `pipeline.currentStage` as the primary source (it's already available)
2. Only fall back to scanning stages if `currentStage` is null
3. When showing the stage progress bar (lines 173-199), use `calculatePipelineProgress()` from `pipeline-utils.ts` instead of re-deriving `currentStageIdx` locally
4. Show the stage label consistently using `stageLabels` map

**Reproduction Test**:
- Test location: `tests/unit/ui/cody/status-banner.test.ts`
- Test: `deriveCodyState([taskWithPipeline({ currentStage: 'build', stages: { verify: { state: 'completed' } } })])` should return `{ status: 'working', stage: 'build' }` — NOT 'verify'
- Why it fails now: Returns 'verify' because the scan finds it as the highest touched stage

**Fix**:
1. In `deriveCodyState`, change stage derivation to: `let stage = pipeline?.currentStage ?? null` (already there), then only scan stages as fallback if `stage` is null AND `pipeline?.stages` exists
2. Replace inline stage index calculation in the banner template with `calculatePipelineProgress()`

**Verification**:
- Run test → FAILS (returns wrong stage)
- After fix → PASSES (returns correct currentStage)
- Banner shows correct stage even when pipeline has stale data from previous runs

**Acceptance Criteria**:
- [ ] Banner stage always matches `pipeline.currentStage` when available
- [ ] Fallback scanning only used when `currentStage` is null
- [ ] Stage progress bar uses shared `calculatePipelineProgress()` utility
- [ ] No duplicate stage derivation logic

---

### Step 5: Integration test — full task list rendering with mixed states

**Files to Touch**:
- `tests/unit/ui/cody/task-list-status-consistency.test.ts` (NEW)

**Behavior**: End-to-end rendering test that creates a mix of tasks in all possible states and verifies the visual output is consistent:

1. Create mock tasks:
   - Task A: `column: 'building'`, pipeline running at stage 'build' (step 6/12)
   - Task B: `column: 'gate-waiting'`, pipeline paused at stage 'architect', gateType 'risk-gated'
   - Task C: `column: 'building'`, no pipeline data, workflow status 'in_progress'
   - Task D: `column: 'building'`, pipeline running, no currentStage (just started)
   - Task E: `column: 'review'`, pipeline completed, has PR

2. Render `<TaskList tasks={[A,B,C,D,E]} />` with React Testing Library

3. Assert:
   - Task A shows "Building" status, 12 progress dots, blue current dot at position 6
   - Task B shows "Risk Gated" status, NOT "Building"; shows "Awaiting approval" text; shows 12 progress dots with yellow pause dot
   - Task C shows "Building" status with spinner and "Starting pipeline..." text (no dots since no pipeline data)
   - Task D shows "Building" status with shimmer bar and "Starting..." text
   - Task E shows "In Review" status, no pipeline progress bar, PR badge visible
   - All tasks with progress dots show exactly 12 dots (not 6, not random)

**Tests**:
1. Full rendering test as described above
2. Snapshot test for visual regression

**Acceptance Criteria**:
- [ ] All 5 task states render correctly in the same list
- [ ] Dot count is always 12 when dots are shown
- [ ] Gate-waiting tasks show gate state, not building state
- [ ] No "Starting" shown for tasks that have been running with pipeline data
- [ ] TypeScript compiles with no errors

---

## Implementation Order

| Step | Description | Effort | Dependencies |
|------|-------------|--------|-------------|
| 1 | Fix column derivation (pipeline-first) | 20 min | None |
| 2 | Normalize MiniPipelineProgress rendering | 30 min | None (parallel with 1) |
| 3 | Fix TaskList inline status | 20 min | Steps 1, 2 |
| 4 | Fix CodyStatusBanner stage derivation | 15 min | Step 2 |
| 5 | Integration test for full consistency | 20 min | Steps 1-4 |

**Total estimated effort**: ~2 hours

## Files Summary

| File | Action | Steps |
|------|--------|-------|
| `src/app/api/cody/tasks/route.ts` | MODIFIED | 1 |
| `src/ui/cody/pipeline-utils.ts` | MODIFIED | 2, 3 |
| `src/ui/cody/components/MiniPipelineProgress.tsx` | MODIFIED | 2 |
| `src/ui/cody/components/TaskList.tsx` | MODIFIED | 3 |
| `src/ui/cody/components/CodyStatusBanner.tsx` | MODIFIED | 4 |
| `tests/unit/ui/cody/derive-column.test.ts` | NEW | 1 |
| `tests/unit/ui/cody/pipeline-display-state.test.ts` | NEW | 2 |
| `tests/unit/ui/cody/task-substatus.test.ts` | NEW | 3 |
| `tests/unit/ui/cody/status-banner.test.ts` | NEW | 4 |
| `tests/unit/ui/cody/task-list-status-consistency.test.ts` | NEW | 5 |
