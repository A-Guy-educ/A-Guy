# Gap Analysis: 260314-auto-352

## Summary

- Gaps Found: 5
- Spec Revised: Yes

## Gaps Found

### Gap 1: Entry.ts Mode Switch Missing Merge Case

**Severity:** Critical
**Location:** `scripts/cody/entry.ts` L319
**Issue:** The main mode switch statement at L319 doesn't include a case for the new 'merge' mode. The spec mentioned adding `runMergeMode()` but didn't explicitly call out the switch case addition.
**Fix Applied:** Added explicit step in Step 4 of spec to add `case 'merge': await runMergeMode(ctx); break;` to the switch statement.

### Gap 2: Pipeline-Resolver Mode Type Missing Merge

**Severity:** Critical
**Location:** `scripts/cody/engine/pipeline-resolver.ts` L19
**Issue:** The `resolvePipelineForMode` function signature only accepts `('spec' | 'impl' | 'full' | 'rerun' | 'fix' | 'status')` as mode types. The spec mentioned adding 'merge' to the mode but didn't explicitly note the type signature change.
**Fix Applied:** Added explicit mention in Step 4 of spec to update the mode type in `resolvePipelineForMode()`.

### Gap 3: stage-prompts.ts Missing resolve-conflicts Instructions

**Severity:** High
**Location:** `scripts/cody/stage-prompts.ts` L131+
**Issue:** The spec mentioned adding to `ALL_STAGES` and `STAGE_CONTEXT_FILES` but didn't explicitly require adding `stageInstructions['resolve-conflicts']` function. Without this, the stage won't have proper runtime instructions.
**Fix Applied:** Added explicit step in Step 3 of spec to add `stageInstructions['resolve-conflicts']` function entry.

### Gap 4: checkout-task-branch.ts Has Separate Implementation

**Severity:** Medium
**Location:** `scripts/cody/checkout-task-branch.ts` L92-101
**Issue:** The spec noted modifying this file but didn't highlight that it has its OWN local `mergeDefaultBranch()` function that already returns boolean (vs the one in git-utils.ts that returns void). The fix approach differs slightly.
**Fix Applied:** Added note in Step 6 of spec acknowledging this file has its own implementation at L92-101 that already returns boolean.

### Gap 5: TaskDetail.tsx getPrimaryAction Doesn't Check Conflicts

**Severity:** Medium
**Location:** `src/ui/cody/components/TaskDetail.tsx` L221-272
**Issue:** The spec mentions adding Smart Resolve button to TaskDetail header actions, but doesn't explicitly call out modifying `getPrimaryAction()` to show the button. The current getPrimaryAction handles gate, failed, and open states but not conflict-based actions.
**Fix Applied:** Added button location details in Step 7-9 specifying both header actions area and mobile toolbar, with conditions for showing when PR has conflicts.

## Changes Made to Spec

- **Step 1**: Added explicit function signatures for conflict-utils.ts (getConflictedFiles, writeConflictMarker, hasConflictMarker, removeConflictMarker)
- **Step 3**: Added requirement to add `stageInstructions['resolve-conflicts']` function in stage-prompts.ts
- **Step 4**: 
  - Added explicit requirement to update mode type in `resolvePipelineForMode()` function signature
  - Added explicit requirement to add merge case to entry.ts switch statement at L319
  - Added detailed runMergeMode() function steps
- **Step 6**: Added note that checkout-task-branch.ts has its own local mergeDefaultBranch() at L92-101
- **Step 7-9**: Added more specific button placement and condition details
- **Added Guardrails section**: Backward compatibility, git permissions, validation requirements
- **Added Out of Scope section**: Manual resolution, rebase workflows, multi-branch

## No Gaps Found

The initial exploration identified that several critical integration points were implicitly handled by the existing codebase patterns but needed explicit documentation in the spec. All gaps have been addressed through spec updates.
