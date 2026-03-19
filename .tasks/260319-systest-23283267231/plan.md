# Plan: Pipeline Health Monitoring Utility

## Rerun Context

This is a fresh start - no previous plan.md, build.md, or review.md exists. The task was re-queued with no specific feedback provided.

## Research Findings

### File Paths Verified
- ✅ `src/infra/utils/` - directory exists, contains utility modules
- ✅ `tests/unit/infra/utils/` - test directory exists
- ✅ `scripts/cody/stages/registry.ts` - existing stage timeout definitions (will reference for timeout values)

### Patterns Observed
- **Validation**: Zod schemas in `src/infra/utils/validation/common-schemas.ts` - use `z.string()`, `z.object()` patterns
- **Logger**: `src/infra/utils/logger/logger.ts` - exports singleton `logger` with Pino
- **Tests**: `tests/unit/infra/utils/speechHelpers.test.ts` - vitest with `describe`/`it`/`expect`
- **Stage timeouts**: Already defined in registry.ts as `STAGE_REGISTRY` with timeout in ms

### Integration Points
- New file: `src/infra/utils/pipeline-health.ts` (NEW)
- New test file: `tests/unit/infra/utils/pipeline-health.test.ts` (NEW)
- No collections or endpoints to register

## Reuse Inventory

- **Zod** (`zod` package) - for input validation schemas
- **Vitest** (`vitest`) - for testing framework
- **Existing stage registry** (`scripts/cody/stages/registry.ts`) - reference for stage names and timeouts

## Step 1: Create Pipeline Health Utility Module

**Files to Touch**:
- `src/infra/utils/pipeline-health.ts` (NEW)

**Implementation**:
1. Define TypeScript interfaces:
   - `HealthStatus` with fields: `stage`, `status` (healthy|warning|failed), `message`, `timestamp`
   - `Report` with fields: `stages` (array of HealthStatus), `generatedAt`, `overallHealth`
   - `RetryStrategy` with fields: `strategy` (immediate|exponential|manual), `maxRetries`, `delayMs`, `reason`

2. Create Zod validation schemas for all public method parameters:
   - `stageSchema` - validated stage name string
   - `retrySchema` - validated failedStage parameter

3. Implement `getStageTimeout(stage: string): number` helper:
   - Use predefined timeout values from registry (10m-45m based on stage)
   - Return default 15m for unknown stages

4. Implement `PipelineHealthReport` class:
   - `checkStageHealth(stage: string): HealthStatus` - validate input, return health status
   - `generateReport(): Report` - iterate all stages, generate full report
   - `getRetryRecommendation(failedStage: string): RetryStrategy` - return retry strategy based on stage

5. Add JSDoc comments on all exported members

**Test Before/After**:
- ❌ Before: Test file cannot import from non-existent module
- ✅ After: Module exports correctly with all interfaces and class

---

## Step 2: Create Integration Test

**Files to Touch**:
- `tests/unit/infra/utils/pipeline-health.test.ts` (NEW)

**Implementation**:
1. Import `PipelineHealthReport`, interfaces, and `getStageTimeout` from utility module
2. Write tests covering:
   - `getStageTimeout` returns correct timeouts for known stages
   - `checkStageHealth` returns valid HealthStatus for valid stage name
   - `checkStageHealth` throws validation error for invalid stage name
   - `generateReport` returns valid Report with all stages
   - `getRetryRecommendation` returns valid RetryStrategy for each stage
   - Zod validation rejects invalid inputs

**Test Before/After**:
- ❌ Before: Test file does not exist
- ✅ After: All tests pass

---

## Step 3: TypeScript Compilation Check

**Files to Touch**:
- None (verification only)

**Implementation**:
Run `pnpm tsc --noEmit` to verify no TypeScript errors.

**Test Before/After**:
- ❌ Before: Module may have type errors
- ✅ After: No type errors

---

## Acceptance Criteria Checklist

- [ ] PipelineHealthReport class is exported from the module
- [ ] HealthStatus, Report, and RetryStrategy interfaces are defined
- [ ] getStageTimeout helper returns appropriate timeouts per stage
- [ ] All exported members have JSDoc comments
- [ ] Zod schemas validate all public method parameters
- [ ] Integration tests cover all public methods
- [ ] Module compiles without TypeScript errors

## Notes

- **System Test**: This is a system test - the PR should NOT be merged
- **Complexity**: Medium - straightforward utility module with validation
- **Dependencies**: zod (already in package.json), vitest (already in package.json)
