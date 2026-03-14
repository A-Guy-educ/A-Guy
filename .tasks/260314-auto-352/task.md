# Task

## Issue Title

Smart Resolve Conflicts
# Plan: Smart Resolve Conflicts

## Research Findings

### File paths verified
- ✅ `scripts/cody/git-utils.ts` — `mergeDefaultBranch()` at L174-196, `ensureFeatureBranch()` at L207-381
- ✅ `scripts/cody/checkout-task-branch.ts` — `mergeDefaultBranch()` at L92-101, `process.exit(1)` at L289
- ✅ `scripts/cody/entry.ts` — `runFixMode()` at L743-755 (swallows merge error), mode switch, `CodyInput`
- ✅ `scripts/cody/parse-inputs.ts` — `VALID_MODES` at L33, command parsing at L184-253
- ✅ `scripts/cody/pipeline/definitions.ts` — stage definitions, pipeline orders at L42-82
- ✅ `scripts/cody/engine/pipeline-resolver.ts` — `resolvePipelineForMode()` at L18-45
- ✅ `scripts/cody/engine/types.ts` — `PipelineStep`, `StageDefinition`, `PipelineContext`
- ✅ `scripts/cody/cody-utils.ts` — `CodyInput` interface at L21-55
- ✅ `scripts/cody/stage-prompts.ts` — `ALL_STAGES` at L29-44, `STAGE_CONTEXT_FILES` at L69-116, `stageInstructions` at L131+
- ✅ `src/app/api/cody/tasks/[taskId]/actions/route.ts` — action enum at L31-49, switch at L82-340
- ✅ `src/ui/cody/api.ts` — `tasksApi` at L85+
- ✅ `src/ui/cody/hooks/index.ts` — `useTaskActions()` at L269-412
- ✅ `src/ui/cody/types.ts` — `GitHubAction` at L267-279
- ✅ `src/ui/cody/components/TaskDetail.tsx` — `getPrimaryAction()`, header actions
- ✅ `src/ui/cody/components/MergeButton.tsx` — `hasConflicts` handling
- ✅ `src/ui/cody/components/tooltip-content.tsx` — `MergeTooltipContent` at L201+
- ✅ `src/ui/cody/github-client.ts` — `triggerWorkflow()` at L1166-1186
- ✅ `.github/workflows/cody.yml` — workflow inputs, checkout step at L336-343
- ✅ `.opencode/agents/build.md` — build agent (NO git permissions at L375-382)
- 🆕 `.opencode/agents/merge-resolve.md` — new merge-resolver agent
- 🆕 `scripts/cody/conflict-utils.ts` — new conflict detection utilities

### Patterns observed
- Pipeline stages follow `StageDefinition` interface with `type`, `timeout`, `maxRetries`, `shouldSkip`, `preExecute`, `postActions`
- Agent stages use `.opencode/agents/<name>.md` for behavioral instructions
- Dashboard actions: API route → `triggerWorkflow()` / `postComment()` → GitHub Actions → `entry.ts`
- Stage context files defined in `STAGE_CONTEXT_FILES` map in `stage-prompts.ts`
- All dashboard actions go through the central `/api/cody/tasks/[taskId]/actions` endpoint

### Integration points
- New stage must be registered in `definitions.ts` stage map + pipeline orders
- New agent file in `.opencode/agents/`
- New stage name in `ALL_STAGES` array in `stage-prompts.ts`
- New mode in `VALID_MODES` in `parse-inputs.ts` + `CodyInput.mode` union in `cody-utils.ts`
- New mode handler in `resolvePipelineForMode()` in `pipeline-resolver.ts`
- New mode entry in `entry.ts` main switch
- New action in `actionSchema` in `route.ts`

## Reuse Inventory

### Existing utilities to reuse
- `triggerWorkflow()` from `src/ui/cody/github-client.ts` — already supports arbitrary modes
- `mergeDefaultBranch()` from `scripts/cody/git-utils.ts` — will be modified, not replaced
- `ensureFeatureBranch()` from `scripts/cody/git-utils.ts` — calls mergeDefaultBranch, benefits automatically
- `usePRCIStatus` hook from `src/ui/cody/hooks/usePRCIStatus.ts` — already provides `hasConflicts`
- `MergeButton` from `src/ui/cody/components/MergeButton.tsx` — conflict-aware, will add resolve action
- `stageOutputFile()` from `scripts/cody/pipeline-utils.ts` — generates output file paths

### New code justified
- `merge-resolve.md` agent — build agent explicitly forbids git commands; need separate agent with git permissions
- `conflict-utils.ts` — encapsulates conflict detection/marker logic, reused by checkout-task-branch.ts, git-utils.ts, and entry.ts
- `MERGE_ORDER` pipeline order — unique stage sequence for merge mode

---

## Pipeline Flows

### Current (broken)
```
FULL:    taskify → gap → clarify → architect → plan-gap → [test, build] → commit → review → fix → commit → verify → pr
RERUN:   (from build) build → commit → review → fix → commit → verify → pr
FIX:     taskify → architect → plan-gap → [test, build] → commit → review → fix → commit → verify → pr
         ⚠️ BUG: mergeDefaultBranch() silently fails → runs on stale code
```

### Proposed (fixed)
```
FULL:    taskify → gap → clarify → architect → plan-gap → [test, build] → commit → review → fix → commit → verify → pr
         (resolve-conflicts prepended to impl stages, auto-skips if no conflicts)

RERUN:   resolve-conflicts → build → commit → review → fix → commit → verify → pr
         └── auto-skips if no conflicts detected

FIX:     resolve-conflicts → taskify → architect → plan-gap → [test, build] → commit → review → fix → commit → verify → pr
         └── auto-skips if no conflicts detected (fix mode no longer swallows merge errors!)

MERGE:   resolve-conflicts → commit → verify → pr
(new)    └── dedicated mode for "just resolve conflicts and verify"
```

---

## Step 1: Conflict detection utilities + modify mergeDefaultBranch

**Files to Touch**:
- `scripts/cody/conflict-utils.ts` (NEW) — conflict detection + marker file utilities
- `scripts/cody/git-utils.ts` (MODIFIED — L174-196) — change `mergeDefaultBranch()` signature

**Behavior**:

1. Create `scripts/cody/conflict-utils.ts` with:
   - `getConflictedFiles(cwd: string): string[]` — runs `git diff --name-only --diff-filter=U` to list files with merge conflicts
   - `writeConflictMarker(taskDir: string, cwd: string): string` — creates `.tasks/<id>/merge-conflicts.md` with conflict metadata (list of files, branches, timestamp). Returns the marker file path.
   - `hasConflictMarker(taskDir: string): boolean` — checks if `merge-conflicts.md` exists
   - `removeConflictMarker(taskDir: string): void` — deletes the marker after resolution

2. Modify `mergeDefaultBranch()` in `git-utils.ts`:
   - Add optional `options?: { leaveConflicts?: boolean }` parameter
   - When `leaveConflicts: true` and conflict occurs: do NOT abort the merge, do NOT throw. Return `false`.
   - When `leaveConflicts: false` (default) or not set: keep existing behavior (abort + throw).
   - Return type changes from `void` to `boolean` (true = clean merge, false = conflicts left in place).

**Tests** (FAIL before, PASS after):
- `tests/unit/scripts/cody/conflict-utils.test.ts`:
  - `getConflictedFiles()` returns list of conflicted files from git output
  - `writeConflictMarker()` creates marker file with correct content
  - `hasConflictMarker()` returns true when marker exists, false otherwise
  - `removeConflictMarker()` deletes the marker file

**Acceptance Criteria**:
- [ ] `mergeDefaultBranch(cwd)` (no options) still throws on conflict (backward compatible)
- [ ] `mergeDefaultBranch(cwd, { leaveConflicts: true })` returns `false` on conflict without aborting
- [ ] `mergeDefaultBranch(cwd)` returns `true` on clean merge
- [ ] `writeConflictMarker()` creates a valid markdown file listing all conflicted files

---

## Step 2: Create merge-resolve agent

**Files to Touch**:
- `.opencode/agents/merge-resolve.md` (NEW) — AI agent for conflict resolution

**Behavior**:

Create `.opencode/agents/merge-resolve.md` with:
- YAML header: `tools: bash, read, write, edit` (same as build, but with git permissions)
- **Core instructions**:
  1. Read `merge-conflicts.md` from the task directory for list of conflicted files
  2. For each conflicted file:
     - Read the file to see `<<<<<<<`, `=======`, `>>>>>>>` conflict markers
     - Understand the intent of BOTH sides (feature branch changes vs dev changes)
     - Resolve intelligently: preserve both sides' intent, combine when possible
     - Use `Edit` tool to write the resolved content (remove all conflict markers)
  3. After resolving all files: run `git add <resolved-files>` for each
  4. Run `git merge --continue` (or `git commit --no-edit` if merge state requires it) to complete the merge
  5. Run `pnpm -s tsc --noEmit` to verify the resolution compiles
  6. If tsc fails: fix type errors caused by the merge resolution
  7. Delete the `merge-conflicts.md` marker file
  8. Write `merge-resolve.md` output summarizing what was resolved

- **Key rules**:
  - This agent IS allowed to run git commands (unlike build agent)
  - Must preserve ALL functional changes from both sides
  - When in doubt, keep both sides and adapt imports/types
  - Never delete functional code from either side
  - Always verify with `tsc --noEmit` after resolution

**Tests** (FAIL before, PASS after):
- `tests/unit/scripts/cody/agents/merge-resolve-agent.test.ts`:
  - Agent file exists at `.opencode/agents/merge-resolve.md`
  - Agent file contains required tool declarations (bash, read, write, edit)
  - Agent file contains git merge instructions
  - Agent file references `merge-conflicts.md` as input

**Acceptance Criteria**:
- [ ] Agent file exists with correct YAML header
- [ ] Agent has explicit git permissions (git add, git merge --continue)
- [ ] Agent reads merge-conflicts.md for conflict file list
- [ ] Agent runs tsc --noEmit after resolution
- [ ] Agent writes merge-resolve.md as output summary

---

## Step 3: Add resolve-conflicts stage + MERGE_ORDER pipeline

**Files to Touch**:
- `scripts/cody/pipeline/definitions.ts` (MODIFIED — add stage + pipeline order)
- `scripts/cody/stage-prompts.ts` (MODIFIED — add to ALL_STAGES, STAGE_CONTEXT_FILES, stageInstructions)

**Behavior**:

1. In `definitions.ts`:
   - Add `MERGE_ORDER` pipeline order: `['resolve-conflicts', 'commit', 'verify', 'pr']`
   - Add `resolve-conflicts` stage definition to `createStageDefinitions()`:
     ```
     type: 'agent'
     agentName: 'merge-resolve'
     timeout: STAGE_TIMEOUTS.build (reuse build timeout — 45min)
     maxRetries: 1
     shouldSkip: check if merge-conflicts.md exists in taskDir — skip if not
     postActions: [{ type: 'commit-task-files', stagingStrategy: 'tracked+task', push: true, ensureBranch: false }]
     ```
   - Prepend `'resolve-conflicts'` to `FIX_FULL_ORDER` (becomes first stage)
   - Prepend `'resolve-conflicts'` to `IMPL_ORDER_STANDARD` and `IMPL_ORDER_LIGHTWEIGHT`

2. In `stage-prompts.ts`:
   - Add `'resolve-conflicts'` to `ALL_STAGES` array
   - Add `STAGE_CONTEXT_FILES['resolve-conflicts']` = `['merge-conflicts.md']`
   - Add `stageInstructions['resolve-conflicts']` with instruction to resolve merge conflicts

**Tests** (FAIL before, PASS after):
- `tests/unit/scripts/cody/pipeline/definitions.test.ts`:
  - `MERGE_ORDER` contains exactly `['resolve-conflicts', 'commit', 'verify', 'pr']`
  - `createStageDefinitions()` returns a stage named `'resolve-conflicts'` with `type: 'agent'`
  - `resolve-conflicts` stage has `agentName: 'merge-resolve'`
  - `FIX_FULL_ORDER` starts with `'resolve-conflicts'`
  - `IMPL_ORDER_STANDARD` starts with `'resolve-conflicts'`
  - `resolve-conflicts` stage's `shouldSkip` returns `{ shouldSkip: true }` when no marker file exists

**Acceptance Criteria**:
- [ ] `resolve-conflicts` stage is defined with `type: 'agent'`, `agentName: 'merge-resolve'`
- [ ] Stage auto-skips when `merge-conflicts.md` doesn't exist
- [ ] `MERGE_ORDER` has the correct 4-stage sequence
- [ ] `FIX_FULL_ORDER` starts with `resolve-conflicts`
- [ ] `IMPL_ORDER_STANDARD` and `IMPL_ORDER_LIGHTWEIGHT` start with `resolve-conflicts`
- [ ] `ALL_STAGES` includes `'resolve-conflicts'`
- [ ] `STAGE_CONTEXT_FILES` maps `resolve-conflicts` to `['merge-conflicts.md']`

---

## Step 4: Add merge mode to entry point + fix fix-mode merge bug

**Files to Touch**:
- `scripts/cody/entry.ts` (MODIFIED — add `runMergeMode()`, fix `runFixMode()`)
- `scripts/cody/cody-utils.ts` (MODIFIED — L22, add `'merge'` to mode union)
- `scripts/cody/parse-inputs.ts` (MODIFIED — L33, add `'merge'` to VALID_MODES)
- `scripts/cody/engine/pipeline-resolver.ts` (MODIFIED — L18-45, add merge case)

**Behavior**:

1. In `cody-utils.ts` L22:
   - Add `'merge'` to `CodyInput.mode` union type

2. In `parse-inputs.ts` L33:
   - Add `'merge'` to `VALID_MODES` array
   - `@cody merge` is now recognized as mode `'merge'`

3. In `pipeline-resolver.ts`:
   - Add `case 'merge':` to `resolvePipelineForMode()`:
     - Uses `MERGE_ORDER` pipeline order
     - Gets stages from `buildPipeline('impl', ...)` (reuses existing stage definitions)

4. In `entry.ts`:
   - Add `runMergeMode()` function:
     1. Log "Running Cody MERGE pipeline (resolve conflicts and verify)..."
     2. Ensure task directory exists
     3. Attempt `mergeDefaultBranch(cwd, { leaveConflicts: true })`
     4. If returns `false` (conflicts): call `writeConflictMarker(taskDir, cwd)`
     5. If returns `true` (no conflicts): log "No conflicts detected", skip resolve-conflicts stage (marker won't exist so it auto-skips)
     6. Resolve pipeline for mode `'merge'`
     7. Run pipeline
   - **FIX** `runFixMode()` (L743-755):
     - Replace the broken try/catch that swallows errors:
       ```typescript
       // OLD (BUG):
       try { mergeDefaultBranch(process.cwd()) }
       catch { logger.error('continuing anyway') }  // merge was ABORTED!
       
       // NEW (FIXED):
       const merged = mergeDefaultBranch(process.cwd(), { leaveConflicts: true })
       if (!merged) {
         writeConflictMarker(ctx.taskDir, process.cwd())
         logger.info('Merge conflicts detected — resolve-conflicts stage will handle them')
       }
       ```
     - Since `FIX_FULL_ORDER` now starts with `resolve-conflicts`, the stage will automatically pick up the marker and resolve conflicts before proceeding.
   - Add `'merge'` case to the mode switch in the main entry function

5. In `checkout-task-branch.ts` (L287-289):
   - Replace `process.exit(1)` on merge conflict:
     ```typescript
     // OLD:
     if (!mergeDefaultBranch(defaultBranch)) {
       logger.info('=== Aborting merge ===')
       process.exit(1)  // kills CI!
     }
     
     // NEW:
     if (!mergeDefaultBranch(defaultBranch)) {
       logger.info('=== Merge conflicts detected — will be resolved by pipeline ===')
       // Write marker file if task directory exists
       // Don't exit — let the pipeline handle it
     }
     ```
   - Note: `checkout-task-branch.ts` has its own local `mergeDefaultBranch()` (L92-101) that already returns `boolean` and uses `git merge --abort` on failure. We need to modify it to NOT abort when we want to leave conflicts, or add a flag similar to the main one.

**Tests** (FAIL before, PASS after):
- `tests/unit/scripts/cody/parse-inputs.test.ts`:
  - `'merge'` is in `VALID_MODES`
  - `extractCommandAfterCody('@cody merge')` results in mode `'merge'`
- `tests/unit/scripts/cody/entry.test.ts`:
  - `runMergeMode()` calls `mergeDefaultBranch` with `{ leaveConflicts: true }`
  - `runMergeMode()` writes conflict marker when merge returns false
  - `runFixMode()` no longer swallows merge errors silently

**Acceptance Criteria**:
- [ ] `@cody merge` is parsed as mode `'merge'`
- [ ] `runMergeMode()` resolves pipeline with `MERGE_ORDER`
- [ ] `runMergeMode()` writes conflict marker when conflicts detected
- [ ] `runFixMode()` uses `leaveConflicts: true` instead of try/catch
- [ ] `runFixMode()` writes conflict marker when conflicts detected
- [ ] `checkout-task-branch.ts` doesn't `process.exit(1)` on merge conflict
- [ ] `resolvePipelineForMode('merge', ...)` returns pipeline with `MERGE_ORDER`

---

## Step 5: Dashboard API — add smart-resolve action

**Files to Touch**:
- `src/app/api/cody/tasks/[taskId]/actions/route.ts` (MODIFIED — L31-49, add action case)
- `src/ui/cody/github-client.ts` (VERIFIED — `triggerWorkflow()` already supports arbitrary modes, no change needed)

**Behavior**:

1. In `actionSchema` (L31):
   - Add `'smart-resolve'` to the `z.enum` array

2. Add `case 'smart-resolve':` to the switch (after L296):
   ```typescript
   case 'smart-resolve': {
     await triggerWorkflow({
       taskId,
       mode: 'merge',
     })
     await postComment(
       issueNumber,
       withActor('🔀 Smart resolve triggered — resolving merge conflicts', actor),
     )
     clearCache()
     return NextResponse.json({ success: true, message: 'Conflict resolution triggered' })
   }
   ```

**Tests** (FAIL before, PASS after):
- `tests/unit/api/cody/actions.test.ts`:
  - POST with `{ action: 'smart-resolve' }` triggers workflow with `mode: 'merge'`
  - POST with `{ action: 'smart-resolve' }` posts a comment on the issue
  - POST with `{ action: 'smart-resolve' }` returns `{ success: true }`

**Acceptance Criteria**:
- [ ] `actionSchema` accepts `'smart-resolve'` as a valid action
- [ ] Action triggers `triggerWorkflow({ taskId, mode: 'merge' })`
- [ ] Action posts a comment on the issue for audit trail
- [ ] Action returns success response

---

## Step 6: Dashboard UI — api client + hooks + types

**Files to Touch**:
- `src/ui/cody/types.ts` (MODIFIED — L267, add to GitHubAction union)
- `src/ui/cody/api.ts` (MODIFIED — add `smartResolve()` method to `tasksApi`)
- `src/ui/cody/hooks/index.ts` (MODIFIED — add `smartResolve` mutation to `useTaskActions()`)

**Behavior**:

1. In `types.ts` L267:
   - Add `| 'smart-resolve'` to `GitHubAction` type

2. In `api.ts`, add to `tasksApi` object (after `approvePR`):
   ```typescript
   smartResolve: async (issueNumber: number, actorLogin?: string): Promise<ActionResponse> => {
     const res = await fetch(`${API_BASE}/tasks/issue-${issueNumber}/actions`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ action: 'smart-resolve', ...(actorLogin && { actorLogin }) }),
     })
     return handleResponse(res)
   },
   ```

3. In `hooks/index.ts`, inside `useTaskActions()`:
   - Add `smartResolve` mutation:
     ```typescript
     const smartResolve = useMutation({
       mutationFn: () => codyApi.tasks.smartResolve(issueNumber, actorLogin),
       onSuccess: handleSuccess('Conflict resolution started'),
       onError: handleError('resolve conflicts'),
     })
     ```
   - Add `smartResolve.isPending` to the `isPending` check
   - Add `smartResolve: smartResolve.mutate` to the return object
   - Add `'smart-resolve'` to `pendingAction` ternary chain

**Tests** (FAIL before, PASS after):
- `tests/unit/ui/cody/api.test.ts`:
  - `tasksApi.smartResolve(123)` calls correct endpoint with `action: 'smart-resolve'`
- `tests/unit/ui/cody/hooks.test.ts`:
  - `useTaskActions()` returns `smartResolve` function
  - `smartResolve` mutation calls `tasksApi.smartResolve()`

**Acceptance Criteria**:
- [ ] `GitHubAction` type includes `'smart-resolve'`
- [ ] `tasksApi.smartResolve()` sends correct POST request
- [ ] `useTaskActions()` exposes `smartResolve` mutation with toast notifications
- [ ] `isPending` includes `smartResolve.isPending`

---

## Step 7: Dashboard UI — Smart Resolve button in TaskDetail + tooltips

**Files to Touch**:
- `src/ui/cody/components/TaskDetail.tsx` (MODIFIED — `getPrimaryAction()` + header actions area)
- `src/ui/cody/components/tooltip-content.tsx` (MODIFIED — L201-210, update conflict tooltip)
- `src/ui/cody/components/MergeButton.tsx` (MODIFIED — add resolve action to conflict state)

**Behavior**:

1. In `TaskDetail.tsx`:
   - Modify `getPrimaryAction()` (L221-272):
     - Before the `return null` at the end, add a check for conflicts:
       ```typescript
       // After all existing checks, before return null:
       // Show "Smart Resolve" when task has conflicts
       // (hasConflicts is available from usePRCIStatus or passed as prop)
       ```
   - In the desktop header actions area (L1117-1188):
     - Add a "Smart Resolve" button that appears when:
       - Task has an associated PR (`task.associatedPR`)
       - PR has conflicts (`hasConflicts` from `usePRCIStatus`)
       - Task column is `'done'` or `'review'`
     - Button: amber/yellow variant, `GitMerge` icon (from lucide-react), label "Smart Resolve"
     - onClick: calls `taskActions.smartResolve()`
   - In the mobile bottom toolbar (L1463-1584):
     - Same button logic for mobile layout

2. In `tooltip-content.tsx` (L201-210):
   - Update `MergeTooltipContent` when `hasConflicts`:
     - Change text from "Update the branch or resolve conflicts on GitHub."
     - To: "Click **Smart Resolve** to automatically resolve conflicts, or resolve manually on GitHub."

3. In `MergeButton.tsx`:
   - When `hasConflicts` is true, instead of just showing a disabled state with AlertTriangle:
     - Show a small "Resolve" text link/button next to the merge button that calls `onSmartResolve?.()`
     - Add `onSmartResolve?: () => void` prop

**Tests** (FAIL before, PASS after):
- `tests/unit/ui/cody/components/TaskDetail.test.tsx`:
  - "Smart Resolve" button renders when task has conflicts and is in `done` column
  - "Smart Resolve" button does NOT render when no conflicts
  - Clicking "Smart Resolve" calls `taskActions.smartResolve()`

**Acceptance Criteria**:
- [ ] "Smart Resolve" button appears in TaskDetail header when PR has conflicts
- [ ] Button appears for both `done` and `review` column tasks
- [ ] Button does not appear when there are no conflicts
- [ ] Button triggers `smartResolve` mutation on click
- [ ] Mobile toolbar also shows the button
- [ ] Conflict tooltip text updated to mention Smart Resolve
- [ ] MergeButton shows resolve option when conflicts detected

---

## Step 8: Workflow + constants updates

**Files to Touch**:
- `.github/workflows/cody.yml` (MODIFIED — L14, update mode description)
- `src/ui/cody/constants.ts` (MODIFIED — if stage display names need updating for `resolve-conflicts`)
- `src/ui/cody/pipeline-utils.ts` (MODIFIED — if stage label mapping needs updating)

**Behavior**:

1. In `.github/workflows/cody.yml` L14:
   - Update mode description: `'Pipeline mode: spec, impl, rerun, fix, full, merge, status'`

2. In `constants.ts`:
   - Add `resolve-conflicts` to any stage display name maps (check `STAGE_LABELS` or similar)
   - Display label: "Resolving Conflicts" with a `GitMerge` or similar icon

3. In `pipeline-utils.ts`:
   - Add `resolve-conflicts` to any stage progress/label calculation functions
   - Ensure `MiniPipelineProgress` and `PipelineStatus` can render this stage

**Tests** (FAIL before, PASS after):
- `tests/unit/ui/cody/pipeline-utils.test.ts`:
  - Stage label for `resolve-conflicts` returns "Resolving Conflicts" (or similar)
  - Pipeline progress calculation includes `resolve-conflicts` stage

**Acceptance Criteria**:
- [ ] Workflow YAML documents `merge` as a valid mode
- [ ] Dashboard shows "Resolving Conflicts" label for `resolve-conflicts` stage
- [ ] Pipeline progress bar renders correctly with `resolve-conflicts` stage
- [ ] Mini pipeline progress dots include the new stage

---

## Summary

| Step | Description | Files | Est. Time |
|------|-------------|-------|-----------|
| 1 | Conflict utils + modify mergeDefaultBranch | 2 files (1 new, 1 modified) | 20 min |
| 2 | Create merge-resolve agent | 1 file (new) | 15 min |
| 3 | Add resolve-conflicts stage + MERGE_ORDER | 2 files (modified) | 20 min |
| 4 | Entry point merge mode + fix fix-mode bug | 4 files (modified) | 25 min |
| 5 | Dashboard API — smart-resolve action | 1 file (modified) | 10 min |
| 6 | Dashboard UI — api/hooks/types | 3 files (modified) | 15 min |
| 7 | Dashboard UI — Smart Resolve button | 3 files (modified) | 25 min |
| 8 | Workflow + constants updates | 3 files (modified) | 10 min |
| **Total** | | **19 files** | **~140 min** |

### Key Design Decisions
1. **`resolve-conflicts` auto-skips** when no `merge-conflicts.md` marker exists — zero overhead for non-conflict runs
2. **Prepended to ALL impl pipelines** (full, rerun, fix) — any mode that runs build will first check for conflicts
3. **`fix` mode bug is fixed** — no longer silently swallows merge failures
4. **`checkout-task-branch.ts` no longer kills CI** on conflict — lets the pipeline handle it
5. **Dedicated agent** (`merge-resolve`) with git permissions — clean separation from build agent
6. **Dashboard button** only shows when GitHub reports `hasConflicts` on the PR



Context:
# Codebase Context: 260314-smart-resolve-conflicts

## Files to Modify

### Pipeline Infrastructure
- `scripts/cody/git-utils.ts` (L174-196) — modify `mergeDefaultBranch()` to support `leaveConflicts` option
- `scripts/cody/conflict-utils.ts` (NEW) — conflict detection, marker file read/write
- `scripts/cody/checkout-task-branch.ts` (L87-101, L287-289) — stop `process.exit(1)` on conflict
- `scripts/cody/pipeline/definitions.ts` (L42-82, L225+) — add `resolve-conflicts` stage + `MERGE_ORDER` + prepend to existing orders
- `scripts/cody/stage-prompts.ts` (L29-44, L69-116, L131+) — add stage to ALL_STAGES, context files, instructions
- `scripts/cody/engine/pipeline-resolver.ts` (L18-45) — add `merge` case to `resolvePipelineForMode()`
- `scripts/cody/entry.ts` (L743-755) — fix `runFixMode()` merge bug + add `runMergeMode()`
- `scripts/cody/cody-utils.ts` (L22) — add `'merge'` to `CodyInput.mode` union
- `scripts/cody/parse-inputs.ts` (L33) — add `'merge'` to `VALID_MODES`

### Agent
- `.opencode/agents/merge-resolve.md` (NEW) — merge resolution agent with git permissions

### Dashboard API
- `src/app/api/cody/tasks/[taskId]/actions/route.ts` (L31-49, after L296) — add `'smart-resolve'` action

### Dashboard UI
- `src/ui/cody/types.ts` (L267-279) — add `'smart-resolve'` to `GitHubAction`
- `src/ui/cody/api.ts` (after L213) — add `smartResolve()` to `tasksApi`
- `src/ui/cody/hooks/index.ts` (L269-412) — add `smartResolve` mutation to `useTaskActions()`
- `src/ui/cody/components/TaskDetail.tsx` (L221-272, L1117-1188) — Smart Resolve button
- `src/ui/cody/components/tooltip-content.tsx` (L201-210) — update conflict tooltip
- `src/ui/cody/components/MergeButton.tsx` (L39-140) — add resolve action to conflict state

### Workflow
- `.github/workflows/cody.yml` (L14) — update mode description

### Display
- `src/ui/cody/constants.ts` — add `resolve-conflicts` stage label
- `src/ui/cody/pipeline-utils.ts` — add stage to progress calculation

## Files to Read (reference patterns)
- `.opencode/agents/build.md` — agent instruction format pattern (YAML header, tool declarations, rules)
- `.opencode/agents/fix.md` — agent that uses `agentName` override pattern
- `scripts/cody/pipeline/definitions.ts` — stage definition pattern (type, timeout, shouldSkip, postActions)
- `scripts/cody/engine/types.ts` — `StageDefinition`, `PipelineStep`, `PipelineContext` types
- `src/ui/cody/api.ts` (L125-213) — API method pattern (fetch, handleResponse)
- `src/ui/cody/hooks/index.ts` (L290-348) — mutation pattern (mutationFn, onSuccess, onError)
- `src/ui/cody/components/MergeButton.tsx` — conflict-aware UI pattern
- `src/ui/cody/hooks/usePRCIStatus.ts` — how `hasConflicts` is detected

## Key Signatures
- `mergeDefaultBranch(cwd: string): void` from `scripts/cody/git-utils.ts` — will change to `(cwd: string, options?: { leaveConflicts?: boolean }): boolean`
- `ensureFeatureBranch(taskId: string, taskType: string, projectDir?: string, taskDir?: string): void` from `scripts/cody/git-utils.ts` — calls mergeDefaultBranch internally
- `triggerWorkflow(options: { taskId, mode?, fromStage?, feedback? }): Promise<void>` from `src/ui/cody/github-client.ts`
- `resolvePipelineForMode(mode, profile, clarify, ctx): PipelineDefinition` from `scripts/cody/engine/pipeline-resolver.ts`
- `buildPipeline(mode, profile, clarify, ctx): PipelineDefinition` from `scripts/cody/pipeline/definitions.ts`
- `type CodyInput = { mode: 'spec' | 'impl' | 'rerun' | 'fix' | 'full' | 'status', ... }` from `scripts/cody/cody-utils.ts`
- `VALID_MODES = ['spec', 'impl', 'rerun', 'fix', 'full', 'status']` from `scripts/cody/parse-inputs.ts`
- `type GitHubAction = 'approve' | 'reject' | ... | 'approve-pr'` from `src/ui/cody/types.ts`
- `useTaskActions({ issueNumber, actorLogin, onSuccess, onError })` from `src/ui/cody/hooks/index.ts`
- `ALL_STAGES` array from `scripts/cody/stage-prompts.ts`
- `STAGE_CONTEXT_FILES` record from `scripts/cody/stage-prompts.ts`
- `stageInstructions` record from `scripts/cody/stage-prompts.ts`

## Reuse Inventory
- `triggerWorkflow()` from `src/ui/cody/github-client.ts` — used by `smart-resolve` action to trigger merge mode
- `mergeDefaultBranch()` from `scripts/cody/git-utils.ts` — extended with `leaveConflicts` option
- `usePRCIStatus` hook from `src/ui/cody/hooks/usePRCIStatus.ts` — provides `hasConflicts` boolean for UI
- `buildPipeline()` from `scripts/cody/pipeline/definitions.ts` — creates stage map, reused for merge mode
- `handleSuccess()` / `handleError()` from `useTaskActions` — toast pattern for new mutation
- `postComment()` from `src/ui/cody/github-client.ts` — post audit comment for smart-resolve action
- `clearCache()` from `src/ui/cody/github-client.ts` — invalidate server cache after action
- `STAGE_TIMEOUTS.build` from `scripts/cody/agent-runner.ts` — reuse build timeout for resolve-conflicts stage
- `writeConflictMarker()` from new `scripts/cody/conflict-utils.ts` — used by entry.ts, checkout-task-branch.ts, git-utils.ts

## Integration Points
- New `'merge'` mode must be added to: `CodyInput.mode`, `VALID_MODES`, `resolvePipelineForMode()`, `entry.ts` switch
- New `'resolve-conflicts'` stage must be in: `definitions.ts` stage map, `ALL_STAGES`, `STAGE_CONTEXT_FILES`, `stageInstructions`
- New `'smart-resolve'` action must be in: `actionSchema` z.enum, switch cases, `tasksApi`, `useTaskActions`
- `merge-resolve.md` agent auto-discovered by OpenCode from `.opencode/agents/` directory
- `MERGE_ORDER` pipeline order used only by `merge` mode in `pipeline-resolver.ts`
- `resolve-conflicts` prepended to `FIX_FULL_ORDER` and `IMPL_ORDER_STANDARD`/`IMPL_ORDER_LIGHTWEIGHT`
- Dashboard reads `hasConflicts` from `usePRCIStatus` which calls `/api/cody/prs/status` which reads GitHub `mergeable_state`

## Imports Verified
- `@/ui/cody/github-client` → exports `triggerWorkflow`, `postComment`, `clearCache` ✅
- `@/ui/cody/auth` → exports `requireCodyAuth` ✅
- `@/ui/cody/hooks/usePRCIStatus` → exports `usePRCIStatus` hook with `hasConflicts` ✅
- `scripts/cody/git-utils` → exports `mergeDefaultBranch`, `ensureFeatureBranch` ✅
- `scripts/cody/pipeline/definitions` → exports `buildPipeline`, `FIX_FULL_ORDER`, `IMPL_ORDER_STANDARD` ✅
- `scripts/cody/engine/pipeline-resolver` → exports `resolvePipelineForMode` ✅
- `scripts/cody/stage-prompts` → exports `ALL_STAGES`, `STAGE_CONTEXT_FILES`, `stageInstructions` ✅


---
_Created by @aguyaharonyair via Cody dashboard_
