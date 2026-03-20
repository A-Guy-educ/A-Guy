# Plan: Pipeline Health Monitoring Utility

## Rerun Context

This is a rerun after feedback. The spec was updated with:
- NFR-001: `getStageTimeout` must import and re-export from `scripts/cody/stages/registry.ts` (not hardcoded)
- Interface field definitions added for `HealthStatus`, `Report`, `RetryStrategy`
- FR-002: Zod input validation added as explicit requirement

---

## Research Findings

### File Paths Verified
- ✅ `src/infra/utils/pipeline-health.ts` - NEW file to create
- ✅ `tests/unit/infra/utils/pipeline-health.test.ts` - NEW test file to create
- ✅ `scripts/cody/stages/registry.ts` - EXISTS, exports `getStageTimeout`, `STAGE_NAMES`, `isValidStageName`
- ✅ `src/infra/utils/textPreprocessing.ts` - EXISTS, JSDoc pattern to follow
- ✅ `src/infra/utils/validation/common-schemas.ts` - EXISTS, Zod pattern to follow
- ✅ `tests/unit/infra/utils/speechHelpers.test.ts` - EXISTS, test pattern to follow

### Patterns Observed
- **JSDoc pattern**: Module-level JSDoc with `@fileType`, `@domain`, `@pattern`, `@ai-summary` tags, plus function-level JSDoc with `@param` and `@returns` (see `textPreprocessing.ts`)
- **Zod pattern**: `z.string().min(1)` for non-empty strings (see `common-schemas.ts`)
- **Test pattern**: `describe` blocks per function, `it` blocks per behavior, simple assertions (see `speechHelpers.test.ts`)

### Integration Points
- Must import `getStageTimeout`, `STAGE_NAMES`, `isValidStageName` from `scripts/cody/stages/registry`
- The 14 valid stage names: `taskify`, `gap`, `clarify`, `architect`, `plan-gap`, `test`, `build`, `commit`, `review`, `fix`, `verify`, `docs`, `pr`

### Reuse Inventory
| Existing Code | Path | Justification |
|---|---|---|
| `getStageTimeout` | `scripts/cody/stages/registry.ts:218` | Reuse instead of duplicating stage metadata |
| `STAGE_NAMES` | `scripts/cody/stages/registry.ts:21` | Use for stage name validation |
| `isValidStageName` | `scripts/cody/stages/registry.ts:239` | Use for runtime stage validation |
| Zod schemas | `src/infra/utils/validation/common-schemas.ts` | Follow same pattern for input validation |
| JSDoc style | `src/infra/utils/textPreprocessing.ts` | Follow same JSDoc structure |

---

## Step 1: Create `src/infra/utils/pipeline-health.ts`

**Files to Touch:**
- `src/infra/utils/pipeline-health.ts` (NEW)

**Behavior:**
- Export TypeScript interfaces: `HealthStatus`, `Report`, `RetryStrategy`
- Export Zod schemas: `stageNameSchema` (non-empty string, validated against known stages)
- Export `PipelineHealthReport` class with:
  - `checkStageHealth(stage: string): HealthStatus` - validates input, returns health status
  - `generateReport(): Report` - aggregates all stage statuses into a report
  - `getRetryRecommendation(failedStage: string): RetryStrategy` - provides retry guidance
- Export `getStageTimeout(stage: string): number` helper that re-exports from registry
- All exported members have JSDoc comments

**Reproduction Test:**
```typescript
// tests/unit/infra/utils/pipeline-health.test.ts
import { describe, it, expect } from 'vitest'
import { PipelineHealthReport, HealthStatus, Report, RetryStrategy, getStageTimeout } from '@/infra/utils/pipeline-health'

describe('PipelineHealthReport', () => {
  // Test checkStageHealth with valid stage
  it('checkStageHealth returns HealthStatus for valid stage', () => {
    const report = new PipelineHealthReport()
    const status = report.checkStageHealth('build')
    expect(status).toHaveProperty('stage', 'build')
    expect(status).toHaveProperty('isHealthy')
    expect(status).toHaveProperty('lastChecked')
  })

  // Test generateReport returns Report structure
  it('generateReport returns Report with correct shape', () => {
    const report = new PipelineHealthReport()
    const result = report.generateReport()
    expect(result).toHaveProperty('overallStatus')
    expect(result).toHaveProperty('stageStatuses')
    expect(result).toHaveProperty('generatedAt')
    expect(Array.isArray(result.stageStatuses)).toBe(true)
  })

  // Test getRetryRecommendation
  it('getRetryRecommendation returns RetryStrategy', () => {
    const report = new PipelineHealthReport()
    const strategy = report.getRetryRecommendation('build')
    expect(strategy).toHaveProperty('maxRetries')
    expect(strategy).toHaveProperty('backoffMultiplier')
    expect(strategy).toHaveProperty('retryDelay')
    expect(strategy).toHaveProperty('stage')
  })
})

describe('getStageTimeout', () => {
  it('returns timeout for known stage', () => {
    const timeout = getStageTimeout('build')
    expect(timeout).toBeGreaterThan(0)
  })

  it('returns fallback for unknown stage', () => {
    const timeout = getStageTimeout('unknown-stage')
    expect(timeout).toBeGreaterThan(0) // Should return build fallback
  })
})
```

**Verification:**
- Run `pnpm -s tsc --noEmit` → MUST PASS
- Run tests → MUST PASS

**Acceptance Criteria:**
- [ ] `HealthStatus` interface has: `stage`, `isHealthy`, `lastChecked`, `errorMessage?`
- [ ] `Report` interface has: `overallStatus`, `stageStatuses`, `generatedAt`
- [ ] `RetryStrategy` interface has: `maxRetries`, `backoffMultiplier`, `retryDelay`, `stage`
- [ ] `PipelineHealthReport` class has all 3 public methods
- [ ] `getStageTimeout` re-exports from registry with fallback for unknown stages
- [ ] All exports have JSDoc comments

---

## Step 2: Create `tests/unit/infra/utils/pipeline-health.test.ts`

**Files to Touch:**
- `tests/unit/infra/utils/pipeline-health.test.ts` (NEW)

**Behavior:**
- Import all exports from `@/infra/utils/pipeline-health`
- Test all public methods with valid and invalid inputs
- Follow existing test pattern from `speechHelpers.test.ts` (simple `describe`/`it` blocks, no mocks)

**Reproduction Test:**
```typescript
// This IS the test file being created
import { describe, it, expect } from 'vitest'
import {
  PipelineHealthReport,
  getStageTimeout,
  stageNameSchema,
} from '@/infra/utils/pipeline-health'

describe('PipelineHealthReport', () => {
  const report = new PipelineHealthReport()

  describe('checkStageHealth', () => {
    it('returns HealthStatus for valid stage name', () => {
      const status = report.checkStageHealth('build')
      expect(status.stage).toBe('build')
      expect(typeof status.isHealthy).toBe('boolean')
      expect(status.lastChecked).toBeInstanceOf(Date)
    })

    it('marks unknown stage as unhealthy', () => {
      const status = report.checkStageHealth('nonexistent')
      expect(status.stage).toBe('nonexistent')
      expect(status.isHealthy).toBe(false)
    })
  })

  describe('generateReport', () => {
    it('returns Report with correct structure', () => {
      const result = report.generateReport()
      expect(result.overallStatus).toMatch(/^(healthy|degraded|unhealthy)$/)
      expect(Array.isArray(result.stageStatuses)).toBe(true)
      expect(result.generatedAt).toBeInstanceOf(Date)
    })

    it('includes all known stages in stageStatuses', () => {
      const result = report.generateReport()
      expect(result.stageStatuses.length).toBeGreaterThan(0)
    })
  })

  describe('getRetryRecommendation', () => {
    it('returns RetryStrategy with required fields', () => {
      const strategy = report.getRetryRecommendation('build')
      expect(typeof strategy.maxRetries).toBe('number')
      expect(typeof strategy.backoffMultiplier).toBe('number')
      expect(typeof strategy.retryDelay).toBe('number')
      expect(strategy.stage).toBe('build')
    })

    it('provides retry strategy for unknown stage', () => {
      const strategy = report.getRetryRecommendation('unknown')
      expect(strategy.stage).toBe('unknown')
    })
  })
})

describe('getStageTimeout', () => {
  it('returns positive timeout for known stage', () => {
    expect(getStageTimeout('build')).toBeGreaterThan(0)
    expect(getStageTimeout('architect')).toBeGreaterThan(0)
  })

  it('returns fallback for unknown stage', () => {
    const buildTimeout = getStageTimeout('build')
    const unknownTimeout = getStageTimeout('not-a-stage')
    expect(unknownTimeout).toBe(buildTimeout) // Falls back to build timeout
  })
})

describe('stageNameSchema', () => {
  it('accepts valid stage name', () => {
    const result = stageNameSchema.safeParse('build')
    expect(result.success).toBe(true)
  })

  it('rejects empty string', () => {
    const result = stageNameSchema.safeParse('')
    expect(result.success).toBe(false)
  })

  it('rejects invalid stage name', () => {
    const result = stageNameSchema.safeParse('not-a-stage')
    expect(result.success).toBe(false)
  })
})
```

**Verification:**
- Run `pnpm test:int -- tests/unit/infra/utils/pipeline-health.test.ts` → MUST PASS

**Acceptance Criteria:**
- [ ] All public methods have test coverage
- [ ] Both valid and invalid inputs tested
- [ ] Tests follow project Vitest conventions
- [ ] All tests pass

---

## Step 3: Run Quality Gates

**Files to Touch:** None (read-only verification)

**Verification Commands:**
```bash
pnpm -s tsc --noEmit
pnpm lint
pnpm format
pnpm test:int -- tests/unit/infra/utils/pipeline-health.test.ts
```

**Acceptance Criteria:**
- [ ] TypeScript compilation passes with no errors
- [ ] Linting passes
- [ ] Formatting passes
- [ ] All tests pass

---

## Files to Create/Modify Summary

| File | Action | Key Changes |
|---|---|---|
| `src/infra/utils/pipeline-health.ts` | CREATE | PipelineHealthReport class, interfaces, getStageTimeout helper, Zod schemas |
| `tests/unit/infra/utils/pipeline-health.test.ts` | CREATE | All public method tests |

## Reuse Inventory

| Path | What | Why |
|---|---|---|
| `scripts/cody/stages/registry.ts:218` | `getStageTimeout` | Reuse instead of duplicating stage timeout values |
| `scripts/cody/stages/registry.ts:21` | `STAGE_NAMES` | Validate stage names against known stages |
| `scripts/cody/stages/registry.ts:239` | `isValidStageName` | Runtime type guard for stage validation |
| `src/infra/utils/validation/common-schemas.ts` | Zod patterns | Non-empty string validation pattern |
| `src/infra/utils/textPreprocessing.ts` | JSDoc style | Module and function JSDoc structure |
| `tests/unit/infra/utils/speechHelpers.test.ts` | Test style | Simple `describe`/`it` blocks without complex mocks |
