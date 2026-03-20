# Plan: Pipeline Health Monitoring Utility

## Rerun Context

- **Rerun requested**: Previous implementation had issues, rerun feedback only says "Rerun requested via /cody rerun" with no specific issues listed
- **Approach**: Revise the implementation from scratch with correct patterns

## Research Findings

### File Paths Verified
- ✅ `src/infra/utils/` — exists, similar utilities present (deepMerge.ts, speechHelpers.ts)
- ✅ `tests/unit/infra/utils/` — exists, test patterns confirmed in speechHelpers.test.ts
- ✅ Stage registry at `scripts/cody/stages/registry.ts` — provides stage names and timeout values
- ✅ Zod validation patterns from `src/infra/utils/validation/common-schemas.ts`

### Patterns Observed
- Utilities use JSDoc comments on all exported members
- Zod schemas for input validation (from common-schemas.ts)
- Test files use vitest with `describe`/`it`/`expect`
- Stage timeouts stored in registry as milliseconds using `ms()` function

### Integration Points
- None required — this is a standalone utility module
- Will import Zod from existing dependency

## Reuse Inventory

| What | Where | Why |
|------|-------|-----|
| Zod validation | `zod` package | Required by spec |
| `ms()` function | `ms` package | Used in registry.ts for timeout conversion |
| Vitest testing | `vitest` package | Standard test framework in project |

## Implementation Plan

### Step 1: Create `src/infra/utils/pipeline-health.ts`

**Files to Create**:
- `src/infra/utils/pipeline-health.ts` (NEW)

**Implementation**:
1. Define TypeScript interfaces:
   - `HealthStatus`: `{ status: 'healthy' | 'warning' | 'critical', message: string, stage: string, timestamp: Date }`
   - `Report`: `{ stages: HealthStatus[], generatedAt: Date, overallStatus: 'healthy' | 'degraded' | 'critical' }`
   - `RetryStrategy`: `{ shouldRetry: boolean, maxRetries: number, backoffMultiplier: number, retryDelayMs: number }`

2. Export `StageName` type based on valid pipeline stages

3. Define Zod schemas for input validation:
   - `stageNameSchema`: validates stage name is a valid string
   - `healthStatusSchema`: schema for HealthStatus objects

4. Create `getStageTimeout(stage: string): number` function:
   - Returns default timeout values per stage (in milliseconds)
   - Uses default timeout of 30 minutes for unknown stages
   - Validates input with Zod

5. Create `PipelineHealthReport` class with:
   - `checkStageHealth(stage: string): HealthStatus` — checks health of a single stage
   - `generateReport(): Report` — generates full health report for all stages
   - `getRetryRecommendation(failedStage: string): RetryStrategy` — returns retry advice

6. Add JSDoc comments on all exported members

**Test Gate**:
- Test location: `tests/unit/infra/utils/pipeline-health.test.ts`
- Tests `getStageTimeout` with valid stage names
- Tests that invalid stage names are rejected by Zod validation

### Step 2: Create `tests/unit/infra/utils/pipeline-health.test.ts`

**Files to Create**:
- `tests/unit/infra/utils/pipeline-health.test.ts` (NEW)

**Tests to Write**:
1. `getStageTimeout`:
   - Returns correct timeout for known stages
   - Returns default timeout for unknown stages
   - Throws on invalid input (Zod validation)

2. `PipelineHealthReport.checkStageHealth`:
   - Returns healthy status for valid stages
   - Validates input with Zod

3. `PipelineHealthReport.generateReport`:
   - Returns report with all stages
   - Report contains overallStatus

4. `PipelineHealthReport.getRetryRecommendation`:
   - Returns retry strategy for failed stage
   - Returns no-retry strategy for unknown stages
   - Validates input with Zod

**Test Gate**:
- All tests must pass
- Run with: `pnpm test:unit -- src/infra/utils/pipeline-health.test.ts`

## Acceptance Criteria

1. ✅ `src/infra/utils/pipeline-health.ts` exports:
   - `PipelineHealthReport` class
   - `HealthStatus`, `Report`, `RetryStrategy` interfaces
   - `getStageTimeout(stage: string): number`
   - All members have JSDoc comments

2. ✅ Zod validation on all public method parameters

3. ✅ `tests/unit/infra/utils/pipeline-health.test.ts` covers all public methods

4. ✅ All tests pass
