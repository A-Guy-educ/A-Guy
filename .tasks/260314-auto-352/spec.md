# Smart Resolve Conflicts - Specification

## Overview

This feature adds intelligent merge conflict resolution to the Cody pipeline. When the pipeline encounters merge conflicts from merging the default branch into a feature branch, it will automatically detect conflicts and use a dedicated AI agent to resolve them.

## Requirements

### Step 1: Conflict Detection Utilities

- Create `scripts/cody/conflict-utils.ts` with functions for detecting and marking merge conflicts
  - `getConflictedFiles(cwd: string): string[]` - runs `git diff --name-only --diff-filter=U`
  - `writeConflictMarker(taskDir: string, cwd: string): string` - creates `.tasks/<id>/merge-conflicts.md`
  - `hasConflictMarker(taskDir: string): boolean` - checks if marker exists
  - `removeConflictMarker(taskDir: string): void` - deletes marker after resolution
- Modify `mergeDefaultBranch()` in `git-utils.ts` to support `leaveConflicts` option:
  - Add optional `options?: { leaveConflicts?: boolean }` parameter
  - Return type changes from `void` to `boolean`
  - When `leaveConflicts: true` and conflict: return `false` without aborting
  - Default behavior (no options) remains backward compatible - throws on conflict

### Step 2: Merge Resolve Agent

- Create `.opencode/agents/merge-resolve.md` AI agent with:
  - YAML header: `tools: bash, read, write, edit` (includes git unlike build agent)
  - Instructions to read merge-conflicts.md, resolve each conflicted file
  - Run `git add` + `git merge --continue` to complete merge
  - Run `pnpm -s tsc --noEmit` after resolution
  - Delete merge-conflicts.md marker
  - Write merge-resolve.md output summary

### Step 3: Pipeline Stage

- Add `resolve-conflicts` stage to `scripts/cody/pipeline/definitions.ts`:
  - `type: 'agent'`, `agentName: 'merge-resolve'`
  - `shouldSkip`: check if merge-conflicts.md exists, skip if not
  - Post-actions: commit-task-files with tracked+task strategy
- Create `MERGE_ORDER` pipeline: `['resolve-conflicts', 'commit', 'verify', 'pr']`
- Prepend `'resolve-conflicts'` to `FIX_FULL_ORDER`, `IMPL_ORDER_STANDARD`, `IMPL_ORDER_LIGHTWEIGHT`
- Add `'resolve-conflicts'` to `ALL_STAGES` array in `scripts/cody/stage-prompts.ts`
- Add `STAGE_CONTEXT_FILES['resolve-conflicts'] = ['merge-conflicts.md']` in stage-prompts.ts
- Add `stageInstructions['resolve-conflicts']` function in stage-prompts.ts

### Step 4: Entry Point Integration

- Add new `'merge'` mode:
  - Add to `VALID_MODES` in `scripts/cody/parse-inputs.ts` L33
  - Add to `CodyInput.mode` union in `scripts/cody/cody-utils.ts` L22
  - Add to mode type in `resolvePipelineForMode()` in `scripts/cody/engine/pipeline-resolver.ts` L19
  - Add merge case to switch statement in `scripts/cody/entry.ts` L319:
    ```typescript
    case 'merge':
      await runMergeMode(ctx)
      break
    ```
- Add `runMergeMode()` function in entry.ts:
  1. Log "Running Cody MERGE pipeline (resolve conflicts and verify)..."
  2. Ensure task directory exists
  3. Call `mergeDefaultBranch(cwd, { leaveConflicts: true })`
  4. If returns false: call `writeConflictMarker(taskDir, cwd)`
  5. If returns true: log "No conflicts detected"
  6. Resolve pipeline for mode 'merge'
  7. Run pipeline

### Step 5: Fix runFixMode Bug

- Fix `runFixMode()` in `scripts/cody/entry.ts` L743-755:
  - Replace try/catch that swallows merge errors:
  ```typescript
  // OLD (BUG):
  try { mergeDefaultBranch(process.cwd()) }
  catch { logger.error('continuing anyway') }
  
  // NEW:
  const merged = mergeDefaultBranch(process.cwd(), { leaveConflicts: true })
  if (!merged) {
    writeConflictMarker(ctx.taskDir, process.cwd())
    logger.info('Merge conflicts detected — resolve-conflicts stage will handle them')
  }
  ```

### Step 6: Fix checkout-task-branch.ts

- Modify `scripts/cody/checkout-task-branch.ts` L287-289:
  - Replace `process.exit(1)` on conflict:
  ```typescript
  if (!mergeDefaultBranch(defaultBranch)) {
    logger.info('=== Merge conflicts detected — will be resolved by pipeline ===')
    // Don't exit - let pipeline handle
  }
  ```
  - Note: This file has its own local `mergeDefaultBranch()` that already returns boolean (L92-101)

### Step 7-9: Dashboard Integration

- Add `'smart-resolve'` to actionSchema z.enum in `src/app/api/cody/tasks/[taskId]/actions/route.ts`
- Add case handler that calls `triggerWorkflow({ taskId, mode: 'merge' })` and posts comment
- Add `| 'smart-resolve'` to `GitHubAction` type in `src/ui/cody/types.ts`
- Add `smartResolve()` method to `tasksApi` in `src/ui/cody/api.ts`
- Add `smartResolve` mutation to `useTaskActions()` in `src/ui/cody/hooks/index.ts`
- Add Smart Resolve button to `TaskDetail.tsx`:
  - Shows when: has PR, PR has conflicts, column is 'done' or 'review'
  - Yellow variant, GitMerge icon, "Smart Resolve" label

### Step 10: Display Updates

- Update workflow YAML with new 'merge' mode
- Update tooltip-content.tsx to mention Smart Resolve
- Add resolve option to MergeButton component

## Acceptance Criteria

### Step 1
- [ ] `mergeDefaultBranch(cwd)` still throws on conflict (backward compatible)
- [ ] `mergeDefaultBranch(cwd, { leaveConflicts: true })` returns `false` on conflict without aborting
- [ ] `mergeDefaultBranch(cwd)` returns `true` on clean merge
- [ ] `writeConflictMarker()` creates valid markdown file

### Step 2
- [ ] Agent file exists with correct YAML header
- [ ] Agent has explicit git permissions
- [ ] Agent runs tsc --noEmit after resolution
- [ ] Agent writes merge-resolve.md output summary

### Step 3
- [ ] `resolve-conflicts` stage is defined with `type: 'agent'`, `agentName: 'merge-resolve'`
- [ ] Stage auto-skips when merge-conflicts.md doesn't exist
- [ ] MERGE_ORDER has correct 4-stage sequence
- [ ] FIX_FULL_ORDER starts with resolve-conflicts
- [ ] IMPL_ORDER_STANDARD and IMPL_ORDER_LIGHTWEIGHT start with resolve-conflicts
- [ ] ALL_STAGES includes 'resolve-conflicts'
- [ ] STAGE_CONTEXT_FILES maps resolve-conflicts to ['merge-conflicts.md']
- [ ] stageInstructions has resolve-conflicts entry

### Step 4
- [ ] @cody merge is parsed as mode 'merge'
- [ ] resolvePipelineForMode accepts 'merge' mode
- [ ] entry.ts switch handles 'merge' case
- [ ] runMergeMode() resolves pipeline with MERGE_ORDER
- [ ] runMergeMode() writes conflict marker when conflicts detected

### Step 5
- [ ] runFixMode() uses leaveConflicts: true instead of try/catch
- [ ] runFixMode() writes conflict marker when conflicts detected

### Step 6
- [ ] checkout-task-branch.ts doesn't process.exit(1) on merge conflict

### Step 7-9
- [ ] actionSchema accepts 'smart-resolve' as valid action
- [ ] Action triggers triggerWorkflow({ taskId, mode: 'merge' })
- [ ] Action posts comment on issue for audit trail
- [ ] GitHubAction type includes 'smart-resolve'
- [ ] tasksApi.smartResolve() sends correct POST request
- [ ] useTaskActions() exposes smartResolve mutation
- [ ] Smart Resolve button appears when PR has conflicts
- [ ] Button appears for done and review columns
- [ ] Button does not appear when no conflicts

### Step 10
- [ ] Workflow YAML documents merge as valid mode
- [ ] Conflict tooltip mentions Smart Resolve
- [ ] MergeButton shows resolve option when conflicts detected

## Guardrails

- **DO NOT** modify the existing behavior of `mergeDefaultBranch()` when called without options - must remain backward compatible
- **DO NOT** grant git write permissions to the build agent - only the merge-resolve agent should have them
- **DO NOT** skip validation (`tsc --noEmit`) after conflict resolution
- **DO NOT** delete functional code from either side of conflicts - preserve both changes
- **DO NOT** exit the process on merge conflict in checkout-task-branch.ts - let the pipeline handle it

## Out of Scope

- Manual conflict resolution workflow (user can still resolve on GitHub)
- Conflict resolution for rebase-based workflows (only merge-based)
- Multi-branch conflict resolution (only default branch merges)
- Testing the merge-resolve agent behavior end-to-end (only unit tests for utilities)
