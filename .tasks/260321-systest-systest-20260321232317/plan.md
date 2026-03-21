# Pipeline Health Monitoring Utility - Plan

## Rerun Context

This is a re-run. Previous attempt had no issues flagged in `rerun-feedback.md` ("Rerun requested via /cody rerun"). No structural changes needed; proceeding with same approach.

---

## Research Findings

### File Paths Verified
- `src/infra/utils/pipeline-health.ts` — ✅ will create (new file)
- `tests/unit/infra/utils/pipeline-health.test.ts` — ✅ will create (new file)

### Patterns Observed
- Zod schemas live in `src/infra/utils/validation/common-schemas.ts` and are imported from `zod`
- Utility functions use JSDoc comments for documentation (e.g., `src/infra/utils/deepMerge.ts`, `src/infra/utils/formatDateTime.ts`)
- Tests use `vitest` with `describe`/`it`/`expect` pattern
- Test files at `tests/unit/infra/utils/*.test.ts` follow same naming convention
- Stage registry at `scripts/cody/stages/registry.ts` has `getStageTimeout(stage: StageName): number` already — we will NOT reuse it (it's internal to cody scripts), but we will mirror its behavior for the public utility
- `STAGE_NAMES` constant lists all valid stages: taskify, gap, clarify, architect, plan-gap, test, build, commit, review, fix, verify, docs, pr

### Integration Points
- No Payload collection or endpoint registration required (pure utility module)
- Not part of `payload.config.ts`

### Reuse Inventory
- `zod` — already used throughout codebase for validation
- `src/infra/utils/validation/common-schemas.ts` pattern for Zod schema definitions
- `StageName` type from `scripts/cody/stages/registry.ts` — NOT imported (different domain), defined locally
- No other utilities reused — fresh implementation per spec

---

## Implementation Plan

### Step 1: Create `src/infra/utils/pipeline-health.ts`

**Files to Touch**: `src/infra/utils/pipeline-health.ts` (NEW)

**Behavior**: Create the utility module with:
1. Zod schemas for stage name validation (`stageNameSchema`, `failedStageSchema`)
2. TypeScript interfaces: `HealthStatus`, `Report`, `RetryStrategy`
3. `getStageTimeout(stage: string): number` helper — returns timeout in ms for each stage; throws Zod validation error for unknown stages
4. `PipelineHealthReport` class with:
   - `checkStageHealth(stage: string): HealthStatus` — validates stage with Zod, returns HealthStatus with 'pass'/'fail'/'warn' status, message, and current timestamp
   - `generateReport(): Report` — returns full Report with all stageStatuses and overallHealth derived from individual statuses
   - `getRetryRecommendation(failedStage: string): RetryStrategy` — validates failedStage with Zod, returns shouldRetry/maxRetries/backoffMultiplier based on stage type

**JSDoc** on all exported members.

**Test Gate**:
- `tests/unit/infra/utils/pipeline-health.test.ts` — tests `getStageTimeout` with valid and invalid stage names, tests `PipelineHealthReport.checkStageHealth` validation, tests `generateReport` returns all stages, tests `getRetryRecommendation` validation and values

**Verification**:
- `pnpm -s tsc --noEmit` passes
- `pnpm test:int -- tests/unit/infra/utils/pipeline-health.test.ts` passes

---

## Reuse Inventory

- `zod` — imported from 'zod' (standard dependency already in project)
- No other utilities reused — fresh implementation per spec requirements

## Acceptance Criteria

- [ ] `src/infra/utils/pipeline-health.ts` exists with all interfaces, class, and helper function
- [ ] All exported members have JSDoc comments
- [ ] `checkStageHealth(stage)` validates stage parameter with Zod
- [ ] `getRetryRecommendation(failedStage)` validates failedStage parameter with Zod
- [ ] `getStageTimeout` returns correct ms values for all 13 stages (taskify, gap, clarify, architect, plan-gap, test, build, commit, review, fix, verify, docs, pr)
- [ ] `generateReport()` returns Report with overallHealth derived from stageStatuses
- [ ] `tests/unit/infra/utils/pipeline-health.test.ts` covers all public methods and Zod validation errors
- [ ] `pnpm -s tsc --noEmit` passes
- [ ] `pnpm test:int -- tests/unit/infra/utils/pipeline-health.test.ts` passes
