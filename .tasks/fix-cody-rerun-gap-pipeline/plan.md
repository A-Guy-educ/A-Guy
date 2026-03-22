# Fix Plan: Issue #827 Pipeline Failure - "gap" Stage Not Found in Rerun

## Problem Summary

When Cody tries to rerun issue #827, it fails with:
```
❌ Cody failed: Stage "gap" not found in rerun pipeline. 
Valid stages: taskify, architect, test, build, commit, review, fix, commit, verify, pr
```

## Root Cause

1. **Profile Mismatch**: Issue #827 has `complexity:moderate` which resolves to `lightweight` profile (complexity < 35 = lightweight)
2. **Lightweight Pipeline**: The lightweight profile excludes `gap` and `plan-gap` stages:
   - `SPEC_ORDER_LIGHTWEIGHT = ['taskify', 'clarify']` (no `gap`)
   - `IMPL_ORDER_LIGHTWEIGHT = ['architect', {parallel: ['test', 'build']}, ...]` (no `plan-gap`)
3. **Failed Stage Detection**: `getLastFailedStage()` returns `'gap'` as the last failed stage from the previous run
4. **Validation Fails**: When trying to resume from `'gap'`, the pipeline validation throws because `gap` isn't in the lightweight pipeline order

## Solution Options

### Option 1: Preserve Original Profile on Rerun (Recommended)
When rerunning, always use the same profile as the original run. The profile should be stored in status.json and read during rerun initialization.

**Implementation**:
1. Store `profile` in `status.json` when the task first runs
2. In rerun mode, read the stored profile instead of re-resolving from complexity
3. This ensures consistency between original run and rerun

### Option 2: Always Include Gap Stage in Rerun
Always include `gap` in the rerun pipeline order regardless of profile, because a previous run might have used `gap`.

**Implementation**:
- Modify `buildPipeline('rerun', ...)` to always include `gap` in the pipeline order

### Option 3: Fallback for Missing Stage
If the requested `fromStage` doesn't exist in the pipeline, automatically adjust to the closest earlier stage.

**Implementation**:
- In the rerun validation, if `fromStage` is not found, find the closest available stage and use that instead

## Recommended Fix: Option 1

Option 1 is the cleanest solution because:
- It maintains consistency between runs
- It respects the original pipeline decisions
- It doesn't add complexity to the pipeline builder
- It's the most predictable behavior for users

### Implementation Steps

1. **Modify status.json schema** (if needed) to include `profile` field
2. **Update `runRerunMode` in entry.ts** to read stored profile from status.json
3. **Update `runFixMode`** similarly if it has the same issue

### Files to Modify

- `scripts/cody/entry.ts` - Read stored profile in rerun mode
- `scripts/cody/engine/status.ts` - Ensure profile is stored in status.json
- Potentially `scripts/cody/pipeline-utils.ts` - Add function to get stored profile

## Testing

- Verify that rerunning a failed task with moderate complexity uses the correct profile
- Verify that rerunning from gap stage works when original run used gap
- Verify that new lightweight tasks still skip gap when no previous state exists
