# Plan Gap Analysis: 260314-auto-352

## Summary

- Gaps Found: 3
- Plan Revised: Yes

## Gaps Identified

### Gap 1: checkout-task-branch.ts sequencing explanation incomplete

**Severity:** Medium
**Issue:** The plan's Step 5 correctly removes `process.exit(1)` from `checkout-task-branch.ts` but didn't explain the full sequencing: after the local `mergeDefaultBranch()` aborts the merge and returns false, the code falls through to `process.exit(0)` at L292, leaving a clean working tree. The pipeline's `entry.ts` must then RE-attempt the merge with `{ leaveConflicts: true }` for merge/fix modes. The plan's note mentioned "we keep that abort behavior" but didn't explain that the re-merge happens in entry.ts. Without this clarity, the build agent might not understand why the approach works.
**Fix Applied:** Updated Step 5 to add a detailed sequencing note explaining: (1) local mergeDefaultBranch aborts → clean working tree, (2) process.exit(0) reached (not exit(1)), (3) entry.ts re-attempts with leaveConflicts for merge/fix modes, (4) other modes hit the same conflict at ensureFeatureBranch (existing behavior).

### Gap 2: `stageLabels` missing `'test'` stage — plan should match existing pattern

**Severity:** Low
**Issue:** The plan adds `'resolve-conflicts'` to `stageLabels` in `pipeline-utils.ts` but doesn't note that `test` stage is also absent from `stageLabels`. This is not a bug (the `test` stage is handled by `stageLabels[stage] || stage` fallback in `pipeline-utils.ts`), but confirms the pattern is correct — `stageLabels` is a `Record<string, string>` not `Record<AllStage, string>`, so missing keys are fine. No plan change needed, but noted for completeness.
**Fix Applied:** None needed — the plan is correct. This is informational.

### Gap 3: `constants.ts` `IMPL_STAGES` is `as const` — adding `'resolve-conflicts'` changes derived types

**Severity:** Low
**Issue:** The plan says to add `'resolve-conflicts'` to the start of `IMPL_STAGES` in `src/ui/cody/constants.ts`. Since `IMPL_STAGES` is declared `as const`, this changes the `ImplStage` and `AllStage` types. While this is backward-compatible (adding a new union member doesn't break existing code that handles specific members), the build agent should be aware this is intentional — the new stage will appear in the dashboard pipeline progress indicators. No plan change needed, confirmed correct.
**Fix Applied:** None needed — the plan is correct. Types widen safely.

## Changes Made to Plan

- **Step 5 (checkout-task-branch.ts)**: Expanded the note to explain the full sequencing: local `mergeDefaultBranch()` aborts and cleans working tree → `process.exit(0)` continues CI → entry.ts re-attempts merge with `{ leaveConflicts: true }` in merge/fix modes → other modes behave as before (conflict at ensureFeatureBranch).

## Feasibility Verification

### File Path Verification
All file paths referenced in the plan were verified against the codebase:
- ✅ `scripts/cody/git-utils.ts` L174: `mergeDefaultBranch()` exists, returns `void`, signature matches plan
- ✅ `scripts/cody/checkout-task-branch.ts` L92-101: local `mergeDefaultBranch()` exists, returns boolean, aborts on conflict
- ✅ `scripts/cody/checkout-task-branch.ts` L287-289: `process.exit(1)` exists in correct context
- ✅ `scripts/cody/entry.ts` L319: mode switch exists with expected cases
- ✅ `scripts/cody/entry.ts` L750-755: buggy try/catch merge block exists in `runFixMode()`
- ✅ `scripts/cody/entry.ts` L787-788: `ctx.taskDir = originalTaskDir` assignment exists
- ✅ `scripts/cody/cody-utils.ts` L22: `CodyInput.mode` union type exists
- ✅ `scripts/cody/parse-inputs.ts` L33: `VALID_MODES` array exists
- ✅ `scripts/cody/pipeline/definitions.ts` L44-82: all pipeline order arrays verified
- ✅ `scripts/cody/pipeline/definitions.ts` L91: `createStageDefinitions()` function exists
- ✅ `scripts/cody/pipeline/definitions.ts` L436: `buildPipeline()` accepts mode `'impl'` — plan's merge case is correct
- ✅ `scripts/cody/engine/pipeline-resolver.ts` L18-45: `resolvePipelineForMode()` switch exists
- ✅ `scripts/cody/engine/pipeline-resolver.ts` L66: `createRebuildCallback` mode type exists
- ✅ `scripts/cody/stage-prompts.ts` L29-44: `ALL_STAGES` is `as const` array, type `Stage` derived from it
- ✅ `scripts/cody/stage-prompts.ts` L69-116: `STAGE_CONTEXT_FILES` is `Record<Stage, string[]>` — adding to ALL_STAGES REQUIRES adding here
- ✅ `scripts/cody/stage-prompts.ts` L131-201: `stageInstructions` is `Record<Stage, (taskId: string) => string>` — adding to ALL_STAGES REQUIRES adding here
- ✅ `scripts/cody/agent-runner.ts` L65-80: `STAGE_TIMEOUTS` is `Record<string, number>` — new entry is optional but recommended
- ✅ `src/ui/cody/constants.ts` L11-20: `IMPL_STAGES` is `as const` array
- ✅ `src/ui/cody/pipeline-utils.ts` L14-27: `stageLabels` is `Record<string, string>`
- ✅ `src/ui/cody/pipeline-utils.ts` L32-44: `stageMaxDurations` is `Record<string, number>`
- ✅ `src/ui/cody/types.ts` L267-279: `GitHubAction` type union exists
- ✅ `src/ui/cody/api.ts` L206-213: `approvePR` method exists at expected location
- ✅ `src/ui/cody/hooks/index.ts` L344-348: `approvePR` mutation exists at expected location
- ✅ `src/ui/cody/hooks/index.ts` L362-374: `isPending` OR chain exists
- ✅ `src/ui/cody/hooks/index.ts` L390-410: `pendingAction` ternary chain exists
- ✅ `src/app/api/cody/tasks/[taskId]/actions/route.ts` L30-49: `actionSchema` z.enum exists
- ✅ `.github/workflows/cody.yml` L14: mode description exists

### Import Verification
- ✅ `entry.ts` L30: already imports `mergeDefaultBranch` from `'./git-utils'`
- ✅ `entry.ts` L21: already imports `ensureTaskDir`, `getTaskDir` from `'./cody-utils'`
- ✅ `entry.ts` L35: already imports `resolvePipelineForMode`, `createRebuildCallback` from `'./engine/pipeline-resolver'`
- ✅ `entry.ts` L34: already imports `runPipeline` from `'./engine/state-machine'`
- ✅ `pipeline-resolver.ts` L12: imports `FIX_FULL_ORDER` from `'../pipeline/definitions'` — plan needs to add `MERGE_ORDER` to this import
- ✅ `definitions.ts` L17: imports `STAGE_TIMEOUTS`, `DEFAULT_TIMEOUT` from `'../agent-runner'`
- ✅ `route.ts` L14: imports `triggerWorkflow` from `'@/ui/cody/github-client'`
- ✅ `route.ts` L26: imports `clearCache` from same module
- 🆕 `entry.ts`: needs new import `writeConflictMarker` from `'./conflict-utils'`
- 🆕 `definitions.ts`: needs new import `hasConflictMarker`, `hasActiveMergeConflicts`, `removeConflictMarker` from `'../conflict-utils'`
- 🆕 `pipeline-resolver.ts`: needs `MERGE_ORDER` added to existing import from `'../pipeline/definitions'`

### Step Ordering Verification
- Step 1 creates `conflict-utils.ts` (new) — no dependencies
- Step 2 creates agent file — no code dependencies
- Step 3 imports from `conflict-utils.ts` (Step 1) — correct order ✅
- Step 4 imports from `conflict-utils.ts` (Step 1) and `MERGE_ORDER` (Step 3) — correct order ✅
- Step 5 uses `writeConflictMarker` from `conflict-utils.ts` (Step 1) — correct order ✅
- Steps 6-8 are dashboard, independent of Steps 1-5 — correct ✅
- Step 9 is config/docs — no dependencies ✅

### Reuse Verification
- ✅ Plan reuses existing `triggerWorkflow()` from `github-client.ts` — no new workflow trigger code
- ✅ Plan reuses existing `handleSuccess()`/`handleError()` patterns in hooks
- ✅ Plan reuses existing `withActor()` helper in route.ts
- ✅ Plan reuses existing `usePRCIStatus` hook for `hasConflicts` detection
- ✅ Plan does NOT duplicate access control — uses existing `requireCodyAuth` from route.ts
- ✅ Plan does NOT create new logger — uses existing `logger` from `./logger`
- ✅ Plan does NOT create new validation schemas — uses Zod extension of existing `actionSchema`

### Test Command Verification
- Test runner: vitest (confirmed via project patterns) ✅
- Package manager: pnpm (confirmed via project patterns) ✅
- Type check command: `pnpm -s tsc --noEmit` ✅
