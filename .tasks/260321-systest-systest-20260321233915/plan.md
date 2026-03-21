# Plan: Pipeline Health Monitoring Utility

## Rerun Context
- Rerun requested via `/cody rerun` — previous implementation had issues

## Research Findings

### File Paths Verified
- ✅ `src/infra/utils/` — exists, parent directory for new utility
- ✅ `tests/unit/infra/utils/` — exists, test directory structure
- ✅ `src/infra/utils/validation/common-schemas.ts` — Zod validation patterns
- ✅ `src/infra/utils/validation/validate.ts` — validate/safeValidate helpers
- ✅ `scripts/cody/stages/registry.ts` — reference for stage timeouts (will NOT import from here)

### Patterns Observed
- Utilities in `src/infra/utils/` use JSDoc with `@fileType`, `@domain`, `@ai-summary` headers
- Zod schemas defined at module level, used with `validate()` or `safeValidate()` helpers
- Tests in `tests/unit/infra/` follow same directory structure as source
- Test files use `describe`/`it`/`expect` from vitest

### Integration Points
- None — this is a standalone utility module
- Does not need to register in payload.config.ts or any collection

## Reuse Inventory
- `z` from 'zod' — Zod validation
- `validate`/`safeValidate` from `@/infra/utils/validation/validate` — schema validation helpers
- `formatZodErrors` from `@/infra/utils/validation/validate` — error formatting
- Existing utility patterns from `src/infra/utils/`

## Steps

### Step 1: Create Pipeline Health Utility

**Files to Touch:**
- `src/infra/utils/pipeline-health.ts` (NEW)

**Implementation:**
1. Define Zod schemas for input validation:
   - `stageNameSchema` — validates stage name is non-empty string
   - `checkStageHealthSchema` — validates `checkStageHealth` input
   - `getRetryRecommendationSchema` — validates `getRetryRecommendation` input

2. Define TypeScript interfaces:
   - `HealthStatus` — `{ stage: string, isHealthy: boolean, message?: string, timestamp: string }`
   - `Report` — `{ generatedAt: string, stages: HealthStatus[], overallHealthy: boolean, summary: string }`
   - `RetryStrategy` — `{ stage: string, recommendedRetries: number, backoffMultiplier: number, shouldRetry: boolean, reason?: string }`

3. Implement `getStageTimeout(stage: string): number`:
   - Returns default timeout in ms per stage name
   - Stages: taskify (10m), gap (15m), clarify (10m), architect (30m), plan-gap (15m), test (20m), build (45m), commit (5m), review (15m), fix (45m), verify (10m), docs (10m), pr (5m)
   - Invalid stage names throw Zod validation error

4. Implement `PipelineHealthReport` class:
   - `checkStageHealth(stage: string): HealthStatus` — validates stage name, returns health status with timestamp
   - `generateReport(): Report` — generates comprehensive report for all stages
   - `getRetryRecommendation(failedStage: string): RetryStrategy` — provides retry strategy based on stage type

5. Add JSDoc comments on all exported members

**Tests that FAIL before, PASS after:**
```typescript
// Test location: tests/unit/infra/utils/pipeline-health.test.ts
// Tests checkStageHealth with valid stage
// Tests checkStageHealth with invalid stage (should throw)
// Tests generateReport returns all stages
// Tests getRetryRecommendation for different stage types
```

---

### Step 2: Create Integration Tests

**Files to Touch:**
- `tests/unit/infra/utils/pipeline-health.test.ts` (NEW)

**Implementation:**
Write integration tests covering:
1. `checkStageHealth` — valid stage returns healthy status, invalid stage throws
2. `generateReport` — returns all stages with overall health
3. `getRetryRecommendation` — returns appropriate retry strategy per stage type
4. `getStageTimeout` — returns correct timeout for valid stages, throws for invalid

**Tests that FAIL before, PASS after:**
- All tests should fail before implementation (file doesn't exist)
- All tests should pass after implementation

---

## Acceptance Criteria

1. ✅ `PipelineHealthReport` class exported with all three methods
2. ✅ All TypeScript interfaces defined and exported
3. ✅ `getStageTimeout` helper function exported
4. ✅ Zod validation used for all public method parameters
5. ✅ JSDoc comments on all exported members
6. ✅ Integration tests cover all public methods
7. ✅ `pnpm tsc --noEmit` passes with no errors
