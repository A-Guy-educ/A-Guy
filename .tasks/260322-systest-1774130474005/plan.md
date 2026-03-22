# Plan: Pipeline Health Monitoring Utility Module

## Rerun Context

This is a rerun of a previous task that was not completed. The rerun-feedback.md simply states "Rerun requested via /cody rerun" with no specific issues noted. The previous plan/build/review files were not found at the expected paths, so this plan is being created fresh based on the spec.

## Research Findings

### File Paths Verified
- `src/infra/utils/pipeline-health.ts` — 🆕 Will create (new utility module)
- `tests/unit/infra/utils/pipeline-health.test.ts` — 🆕 Will create (test file)
- `src/infra/utils/validation/common-schemas.ts` — ✅ Exists (Zod patterns reference)
- `src/infra/utils/validation/validate.ts` — ✅ Exists (validation helpers reference)

### Patterns Observed
- Utilities in `src/infra/utils/` use simple export patterns
- Zod schemas are defined inline at the top of files using `import { z } from 'zod'`
- Test files follow `*.test.ts` naming in `tests/unit/` directories
- Tests use Vitest with `describe`/`it`/`expect` imports
- Helper functions in utils don't typically have JSDoc, but public API members should

### Integration Points
- No collection registration needed (pure utility, no Payload integration)
- No route registration needed

## Reuse Inventory

- `z` from `zod` — Reuse for runtime validation schemas
- `validate`, `safeValidate`, `formatZodErrors` from `src/infra/utils/validation/validate.ts` — Can reuse for validation helpers
- Existing test patterns from `tests/unit/infra/utils/speechHelpers.test.ts` — Follow same Vitest structure

## Steps

### Step 1: Create pipeline-health.ts with interfaces, schemas, and helper function

**Files to Touch**:
- `src/infra/utils/pipeline-health.ts` (NEW)

**Behavior**:
- Define TypeScript interfaces: `HealthStatus`, `Report`, `RetryStrategy`
- Define Zod input schemas for method parameter validation
- Implement `getStageTimeout(stage: string): number` helper function
- Export all types, schemas, and the helper function

**Interfaces** (example structure):
```typescript
interface HealthStatus {
  stage: string
  isHealthy: boolean
  lastCheck: Date
  message?: string
}

interface Report {
  timestamp: Date
  stages: HealthStatus[]
  overallHealth: 'healthy' | 'degraded' | 'unhealthy'
}

interface RetryStrategy {
  stage: string
  recommendedRetries: number
  backoffMultiplier: number
  shouldRetry: boolean
}
```

**Tests that FAIL before, PASS after**:
- None yet (pure implementation step)

**Acceptance Criteria**:
- [ ] All 3 interfaces defined and exported
- [ ] Zod schemas defined for `checkStageHealth` and `getRetryRecommendation` inputs
- [ ] `getStageTimeout` returns correct timeout values per stage name
- [ ] All exported members have JSDoc comments

---

### Step 2: Implement PipelineHealthReport class with public methods

**Files to Touch**:
- `src/infra/utils/pipeline-health.ts` (MODIFIED - add class)

**Behavior**:
- Add `PipelineHealthReport` class with:
  - `checkStageHealth(stage: string): HealthStatus` — Validates input, returns health status for stage
  - `generateReport(): Report` — Generates comprehensive report across all known stages
  - `getRetryRecommendation(failedStage: string): RetryStrategy` — Returns retry advice for failed stage
- Use Zod schemas to validate all inputs
- Throw descriptive errors on validation failure

**Tests that FAIL before, PASS after**:
- None yet (class not implemented)

**Acceptance Criteria**:
- [ ] `PipelineHealthReport` class exported
- [ ] `checkStageHealth` validates stage parameter with Zod schema
- [ ] `generateReport` returns Report with all stages
- [ ] `getRetryRecommendation` validates failedStage and returns RetryStrategy
- [ ] All methods have JSDoc comments

---

### Step 3: Write integration tests for pipeline-health.ts

**Files to Touch**:
- `tests/unit/infra/utils/pipeline-health.test.ts` (NEW)

**Behavior**:
- Integration tests covering:
  - `getStageTimeout` with valid stage names
  - `getStageTimeout` with unknown stage (should return default)
  - `PipelineHealthReport.checkStageHealth` with valid stage
  - `PipelineHealthReport.checkStageHealth` with invalid stage (should throw Zod error)
  - `PipelineHealthReport.generateReport` returns overall health
  - `PipelineHealthReport.getRetryRecommendation` with valid stage
  - `PipelineHealthReport.getRetryRecommendation` with invalid stage (should throw)

**Tests that FAIL before, PASS after**:
- All tests fail before implementation (file doesn't exist)

**Acceptance Criteria**:
- [ ] Test file exists at correct path
- [ ] All public methods covered by tests
- [ ] Tests use Vitest `describe`/`it`/`expect` pattern
- [ ] Invalid inputs are tested (Zod validation errors)

---

### Step 4: Verify implementation

**Commands to Run**:
```bash
pnpm tsc --noEmit
pnpm vitest run tests/unit/infra/utils/pipeline-health.test.ts
```

**Acceptance Criteria**:
- [ ] TypeScript compiles without errors
- [ ] All tests pass
- [ ] All acceptance criteria from spec.md are met
