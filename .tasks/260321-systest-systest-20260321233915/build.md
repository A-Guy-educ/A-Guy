# Build Summary

## Changes

- Created `src/infra/utils/pipeline-health.ts` with:
  - `PipelineHealthReport` class with `checkStageHealth()`, `generateReport()`, and `getRetryRecommendation()` methods
  - TypeScript interfaces: `HealthStatus`, `Report`, `RetryStrategy`
  - `getStageTimeout()` helper function returning default timeouts per stage
  - Zod validation schemas for all public method parameters
  - JSDoc comments on all exported members

- Created `tests/unit/infra/utils/pipeline-health.test.ts` with 17 tests covering:
  - `checkStageHealth()` for valid and invalid stage names
  - `generateReport()` for comprehensive pipeline health reporting
  - `getRetryRecommendation()` for different stage types (agent, git, scripted)
  - `getStageTimeout()` for valid and invalid stage names

## Files

- `src/infra/utils/pipeline-health.ts` (NEW)
- `tests/unit/infra/utils/pipeline-health.test.ts` (NEW)

## Verification

- ✅ All 17 unit tests passed
