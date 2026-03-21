# Build Summary

## Changes
- Created `src/infra/utils/pipeline-health.ts` with:
  - `PipelineHealthReport` class with `checkStageHealth()`, `generateReport()`, and `getRetryRecommendation()` methods
  - `HealthStatus`, `Report`, `RetryStrategy` TypeScript interfaces
  - `getStageTimeout()` helper function returning default timeouts per stage
  - Zod input validation schemas (`stageNameSchema`, `healthStatusSchema`)
  - Full JSDoc comments on all exported members
- Created `tests/unit/infra/utils/pipeline-health.test.ts` with 27 tests covering:
  - `PipelineHealthReport` instantiation
  - `checkStageHealth()` with valid/invalid inputs
  - `generateReport()` overall health calculation
  - `getRetryRecommendation()` for all known stages and unknown stages
  - `getStageTimeout()` for all configured stages
  - Zod schema validation

## Files
- `src/infra/utils/pipeline-health.ts` (NEW)
- `tests/unit/infra/utils/pipeline-health.test.ts` (NEW)

## Verification
- ✅ TypeScript type check: `pnpm -s tsc --noEmit` passed
- ✅ Unit tests: `pnpm vitest run --config ./vitest.config.unit.mts tests/unit/infra/utils/pipeline-health.test.ts` — 27 tests passed
