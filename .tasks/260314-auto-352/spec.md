# Smart Resolve Conflicts - Specification

## Overview

This feature adds intelligent merge conflict resolution to the Cody pipeline. When the pipeline encounters merge conflicts from merging the default branch into a feature branch, it will automatically detect conflicts and use a dedicated AI agent to resolve them.

## Requirements

### Step 1: Conflict Detection Utilities

- Create `scripts/cody/conflict-utils.ts` with functions for detecting and marking merge conflicts
- Modify `mergeDefaultBranch()` in `git-utils.ts` to support `leaveConflicts` option

### Step 2: Merge Resolve Agent

- Create `.opencode/agents/merge-resolve.md` AI agent with git permissions
- Agent reads conflicted files and resolves them intelligently

### Step 3: Pipeline Stage

- Add `resolve-conflicts` stage to pipeline definitions
- Create `MERGE_ORDER` pipeline order
- Prepend to existing implementation orders

### Step 4: Entry Point Integration

- Add new `'merge'` mode to the Cody pipeline
- Fix the bug in `runFixMode()` that silently swallows merge errors
- Update `checkout-task-branch.ts` to not exit on conflict

### Step 5-7: Dashboard Integration

- Add `'smart-resolve'` action to API route
- Add `smartResolve()` to API client
- Add Smart Resolve button to TaskDetail UI

### Step 8: Display Updates

- Update workflow YAML with new mode
- Add stage labels for pipeline UI

## Acceptance Criteria

### Step 1
- [ ] `mergeDefaultBranch(cwd)` still throws on conflict (backward compatible)
- [ ] `mergeDefaultBranch(cwd, { leaveConflicts: true })` returns `false` on conflict without aborting
- [ ] `mergeDefaultBranch(cwd)` returns `true` on clean merge
- [ ] `writeConflictMarker()` creates a valid markdown file

### Step 2
- [ ] Agent file exists with correct YAML header
- [ ] Agent has explicit git permissions
- [ ] Agent runs tsc --noEmit after resolution

### Step 3
- [ ] `resolve-conflicts` stage is defined with `type: 'agent'`
- [ ] Stage auto-skips when `merge-conflicts.md` doesn't exist
- [ ] `MERGE_ORDER` has correct sequence

### Step 4
- [ ] `@cody merge` is parsed as mode `'merge'`
- [ ] `runMergeMode()` writes conflict marker when conflicts detected
- [ ] `runFixMode()` uses `leaveConflicts: true` instead of try/catch

### Step 5-7
- [ ] Action triggers workflow with `mode: 'merge'`
- [ ] Dashboard button appears when PR has conflicts

### Step 8
- [ ] Workflow YAML documents `merge` as valid mode
- [ ] Dashboard shows "Resolving Conflicts" label
