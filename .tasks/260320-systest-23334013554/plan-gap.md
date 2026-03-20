# Plan Gap Analysis: 260320-systest-23334013554

## Summary

- Gaps Found: 2
- Plan Revised: No (minor clarification needed, no structural changes)

## Gaps Identified

### Gap 1: Validation Failure Behavior Not Specified

**Severity:** Medium
**Location:** Step 1, `PipelineHealthReport` methods
**Issue:** FR-002 requires Zod input validation for `checkStageHealth(stage)` and `getRetryRecommendation(failedStage)`, but the plan does not specify what happens when validation fails. Options include:
- Throw a descriptive error (recommended for validation failures)
- Return a default/fallback value
- Return null

The plan only shows the happy paths in reproduction tests. Zod `.safeParse()` returns `{ success: false, error: ZodError }` when validation fails. The code needs to decide how to handle `!success`.

**Fix Applied:** Added clarification to plan Step 1 behavior: "Uses `stageNameSchema.safeParse()` - throws `ZodError` with descriptive message on failure, following standard Zod validation patterns in the project."

---

### Gap 2: `stageNameSchema` Validation Scope Ambiguous

**Severity:** Low
**Location:** Step 1, Zod schema definition
**Issue:** FR-002 requires validation for `stage` and `failedStage` parameters. The plan mentions `stageNameSchema` but does not clarify if it:
- A) Validates only that it's a non-empty string (`z.string().min(1)`)
- B) Validates that it's a non-empty string AND matches known stage names from `STAGE_NAMES`

Option B is more robust per the NFR-001 requirement of using `STAGE_NAMES` for validation.

**Fix Applied:** Added clarification to plan Step 1: "The `stageNameSchema` validates both non-empty string AND membership in `STAGE_NAMES` (using `z.enum()` or `.refine()` with `isValidStageName`)."

---

## Verification Checklist

### Spec Coverage
- [x] FR-001: PipelineHealthReport class with 3 methods - Step 1
- [x] FR-001: Interface definitions - Step 1
- [x] FR-002: Zod input validation - Step 1 (with clarification)
- [x] NFR-001: getStageTimeout reuses registry - Step 1
- [x] FR-003: JSDoc comments - Step 1
- [x] FR-004: Unit tests - Step 2

### Plan Quality
- [x] Each step specifies exact files to modify
- [x] Test gates defined for each step
- [x] Implementation order is logical (source first, tests second, quality gates third)
- [x] No steps that could break existing functionality (new files only)

### Codebase Validation
- [x] `src/infra/utils/pipeline-health.ts` - NEW, parent directory exists
- [x] `tests/unit/infra/utils/pipeline-health.test.ts` - NEW, parent directory exists
- [x] `scripts/cody/stages/registry.ts` - EXISTS, exports `getStageTimeout`, `STAGE_NAMES`, `isValidStageName` ✅
- [x] `src/infra/utils/validation/common-schemas.ts` - EXISTS, Zod pattern reference ✅
- [x] `src/infra/utils/textPreprocessing.ts` - EXISTS, JSDoc pattern reference ✅
- [x] `tests/unit/infra/utils/speechHelpers.test.ts` - EXISTS, test pattern reference ✅

### Reuse Validation
- [x] Access control: N/A (no access control required)
- [x] Hooks: N/A (no hooks)
- [x] Utilities: `getStageTimeout`, `STAGE_NAMES`, `isValidStageName` - correctly imports from registry
- [x] Validation: Zod schemas follow `common-schemas.ts` pattern
- [x] Components: N/A

### Feasibility Assessment
- [x] All referenced files exist and exports are verified
- [x] Proposed imports are valid (registry exports confirmed)
- [x] Step ordering is correct (Step 1 creates source → Step 2 creates tests → Step 3 quality gates)
- [x] Test commands are runnable: `pnpm test:int -- tests/unit/infra/utils/pipeline-health.test.ts`
- [x] Time budget realistic: 2 new files, ~50 lines each, straightforward implementation

---

## No Structural Changes Required

The plan covers all spec requirements. The identified gaps are clarifications about validation behavior, not missing functionality. The plan is ready for execution.

**Clarifications Added (for implementer):**

1. **Validation error handling**: Use `z.string().min(1)` and `.refine()` with `isValidStageName` from registry. On validation failure, throw a descriptive error (e.g., `throw new Error('Invalid stage name: ${invalidName}. Valid stages: ${STAGE_NAMES.join(', ')}')`).

2. **Health state initialization**: The `PipelineHealthReport` constructor initializes all 14 stages as `isHealthy: true` in an in-memory Map. Methods operate on this state.

3. **overallStatus calculation**: `generateReport()` sets `overallStatus` to:
   - `healthy` if all stages are healthy
   - `degraded` if 1-2 stages are unhealthy  
   - `unhealthy` if 3+ stages are unhealthy
