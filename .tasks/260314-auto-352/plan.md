# Smart Resolve Conflicts - Implementation Plan

## Step 1: Conflict Detection Utilities + Modify mergeDefaultBranch

### Files to Touch:
- `scripts/cody/conflict-utils.ts` (NEW)
- `scripts/cody/git-utils.ts` (MODIFIED — L174-196)

### Implementation:
1. Create `scripts/cody/conflict-utils.ts` with:
   - `getConflictedFiles(cwd: string): string[]`
   - `writeConflictMarker(taskDir: string, cwd: string): string`
   - `hasConflictMarker(taskDir: string): boolean`
   - `removeConflictMarker(taskDir: string): void`

2. Modify `mergeDefaultBranch()` in `git-utils.ts`:
   - Add optional `options?: { leaveConflicts?: boolean }` parameter
   - Return type changes from `void` to `boolean`
   - When `leaveConflicts: true` and conflict occurs: return `false` without aborting

---

## Step 2: Create merge-resolve agent

### Files to Touch:
- `.opencode/agents/merge-resolve.md` (NEW)

### Implementation:
Create agent file with:
- YAML header: `tools: bash, read, write, edit`
- Instructions to read `merge-conflicts.md`, resolve each file, run `git merge --continue`, verify with `tsc --noEmit`

---

## Step 3: Add resolve-conflicts Stage + MERGE_ORDER Pipeline

### Files to Touch:
- `scripts/cody/pipeline/definitions.ts` (MODIFIED)
- `scripts/cody/stage-prompts.ts` (MODIFIED)

### Implementation:
1. Add `MERGE_ORDER` = `['resolve-conflicts', 'commit', 'verify', 'pr']`
2. Add `resolve-conflicts` stage definition with `type: 'agent'`, `agentName: 'merge-resolve'`
3. Prepend `'resolve-conflicts'` to `FIX_FULL_ORDER`, `IMPL_ORDER_STANDARD`, `IMPL_ORDER_LIGHTWEIGHT`
4. Add to `ALL_STAGES`, `STAGE_CONTEXT_FILES`, `stageInstructions`

---

## Step 4: Add Merge Mode to Entry Point + Fix Fix-mode Bug

### Files to Touch:
- `scripts/cody/entry.ts` (MODIFIED)
- `scripts/cody/cody-utils.ts` (MODIFIED)
- `scripts/cody/parse-inputs.ts` (MODIFIED)
- `scripts/cody/engine/pipeline-resolver.ts` (MODIFIED)
- `scripts/cody/checkout-task-branch.ts` (MODIFIED)

### Implementation:
1. Add `'merge'` to `CodyInput.mode` union
2. Add `'merge'` to `VALID_MODES`
3. Add `case 'merge':` to `resolvePipelineForMode()` using `MERGE_ORDER`
4. Add `runMergeMode()` function
5. Fix `runFixMode()` to use `leaveConflicts: true`
6. Update `checkout-task-branch.ts` to not `process.exit(1)` on conflict

---

## Step 5: Dashboard API — smart-resolve Action

### Files to Touch:
- `src/app/api/cody/tasks/[taskId]/actions/route.ts` (MODIFIED)

### Implementation:
1. Add `'smart-resolve'` to `actionSchema` z.enum
2. Add `case 'smart-resolve':` to switch

---

## Step 6: Dashboard UI — API Client + Hooks + Types

### Files to Touch:
- `src/ui/cody/types.ts` (MODIFIED)
- `src/ui/cody/api.ts` (MODIFIED)
- `src/ui/cody/hooks/index.ts` (MODIFIED)

### Implementation:
1. Add `| 'smart-resolve'` to `GitHubAction` type
2. Add `smartResolve()` method to `tasksApi`
3. Add `smartResolve` mutation to `useTaskActions()`

---

## Step 7: Dashboard UI — Smart Resolve Button

### Files to Touch:
- `src/ui/cody/components/TaskDetail.tsx` (MODIFIED)
- `src/ui/cody/components/tooltip-content.tsx` (MODIFIED)
- `src/ui/cody/components/MergeButton.tsx` (MODIFIED)

### Implementation:
1. Add Smart Resolve button in TaskDetail header actions
2. Update MergeTooltipContent text
3. Add resolve action to MergeButton when conflicts exist

---

## Step 8: Workflow + Constants Updates

### Files to Touch:
- `.github/workflows/cody.yml` (MODIFIED)
- `src/ui/cody/constants.ts` (MODIFIED)
- `src/ui/cody/pipeline-utils.ts` (MODIFIED)

### Implementation:
1. Update mode description in workflow YAML
2. Add `resolve-conflicts` to stage display names
3. Add stage to progress calculation

---

## Summary

| Step | Description | Files | Est. Time |
|------|-------------|-------|-----------|
| 1 | Conflict utils + modify mergeDefaultBranch | 2 | 20 min |
| 2 | Create merge-resolve agent | 1 | 15 min |
| 3 | Add resolve-conflicts stage + MERGE_ORDER | 2 | 20 min |
| 4 | Entry point merge mode + fix fix-mode bug | 4 | 25 min |
| 5 | Dashboard API — smart-resolve action | 1 | 10 min |
| 6 | Dashboard UI — api/hooks/types | 3 | 15 min |
| 7 | Dashboard UI — Smart Resolve button | 3 | 25 min |
| 8 | Workflow + constants updates | 3 | 10 min |
| **Total** | | **19 files** | **~140 min** |
