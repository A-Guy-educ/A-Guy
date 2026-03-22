# Build Summary

## Changes

- Created `src/infra/utils/pipeline-health.ts` with:
  - `PipelineHealthReport` class with `checkStageHealth()`, `generateReport()`, and `getRetryRecommendation()` methods
  - TypeScript interfaces: `HealthStatus`, `Report`, `RetryStrategy`
  - `getStageTimeout(stage: string): number` helper function
  - Zod schema for stage name validation (`StageNameSchema`)
  - Input validation using Payload `ValidationError` for invalid stage names
  - JSDoc comments on all exported members
- Created `tests/unit/infra/utils/pipeline-health.test.ts` with 31 tests covering:
  - `getStageTimeout()` for valid and invalid stage names
  - `PipelineHealthReport.checkStageHealth()` for all stage types
  - `PipelineHealthReport.generateReport()` with all stages
  - `PipelineHealthReport.getRetryRecommendation()` for agent, scripted, and git stages
  - Validation error handling for invalid inputs

## Files

- `src/infra/utils/pipeline-health.ts`
- `tests/unit/infra/utils/pipeline-health.test.ts`

## Verification

- All 31 unit tests pass
- TypeScript compilation succeeds without errors

## Implementation Details

- Uses `STAGE_NAMES` and `STAGE_REGISTRY` from `scripts/cody/stages/registry.ts` for stage metadata
- Stage types handled: `agent` (retriable), `scripted` and `git` (not retriable)
- Agent stages with timeout > 30m generate degradation recommendations
- All public methods validate inputs using Zod schema before processing
