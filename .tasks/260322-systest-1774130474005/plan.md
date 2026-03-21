# Plan: Pipeline Health Monitoring Utility Module

## Rerun Context
- **Rerun triggered**: User requested via `/cody rerun`
- **Previous run**: No prior run files found (fresh task)
- **Changes**: None yet — this is the first planning iteration

## Research Findings

### File Paths Verified
- ✅ `src/infra/utils/` — parent directory exists, contains similar utility modules
- ✅ `tests/unit/infra/utils/` — parent directory exists, test patterns confirmed
- 🆕 `src/infra/utils/pipeline-health.ts` — will create
- 🆕 `tests/unit/infra/utils/pipeline-health.test.ts` — will create

### Patterns Observed
- **JSDoc style**: Multi-line comments with `@param`, `@returns` for functions; description block at top
- **Zod usage**: Import `z` from 'zod'; schemas defined as `export const <name>Schema = z.object({...})`
- **Validation pattern**: Uses `validate()` and `safeValidate()` from `@/infra/utils/validation`
- **Test pattern**: `describe`/`it` blocks from vitest; `expect` assertions; file in `tests/unit/infra/utils/`
- **Interface naming**: PascalCase type names (e.g., `MCPHealthStatus`)

### Integration Points
- None required — this is a standalone utility module
- Will use existing validation utilities from `@/infra/utils/validation`

## Reuse Inventory
- `z` from 'zod' — Zod validation (already used project-wide)
- `validate()` and `safeValidate()` from `@/infra/utils/validation` — validation helpers
- Vitest `describe`, `it`, `expect` — testing framework
- Existing utility module patterns from `src/infra/utils/`

## Spec Requirements (from task.md)
1. Export a `PipelineHealthReport` class with methods:
   - `checkStageHealth(stage: string): HealthStatus`
   - `generateReport(): Report`
   - `getRetryRecommendation(failedStage: string): RetryStrategy`
2. Define TypeScript interfaces: `HealthStatus`, `Report`, `RetryStrategy`
3. Implement `getStageTimeout(stage: string): number` helper
4. Add JSDoc comments on all exported members
5. Include Zod input validation for all public method parameters
6. Write companion test at `tests/unit/infra/utils/pipeline-health.test.ts`

---

## Step 1: Create pipeline-health.ts with interfaces and schemas

**Files to Touch**:
- `src/infra/utils/pipeline-health.ts` (NEW)

**Behavior**:
- Define `HealthStatus` interface with `stage`, `healthy`, `message`, `timestamp`
- Define `Report` interface with `overallHealth`, `stages`, `generatedAt`, `recommendations`
- Define `RetryStrategy` interface with `stage`, `strategy`, `maxRetries`, `timeout`
- Define Zod schemas for input validation: `stageNameSchema`, `healthStatusSchema`
- Export `PipelineHealthReport` class with:
  - `checkStageHealth(stage: string): HealthStatus` — validates input, returns health status
  - `generateReport(): Report` — generates overall health report
  - `getRetryRecommendation(failedStage: string): RetryStrategy` — validates input, returns retry strategy
- Export `getStageTimeout(stage: string): number` helper function
- Add JSDoc on all exported members

**Reproduction Test** (should FAIL before implementation):
```typescript
// tests/unit/infra/utils/pipeline-health.test.ts
import { describe, it, expect } from 'vitest'
import { PipelineHealthReport } from '@/infra/utils/pipeline-health'

describe('PipelineHealthReport', () => {
  it('should export PipelineHealthReport class', () => {
    const reporter = new PipelineHealthReport()
    expect(reporter).toBeDefined()
  })
})
```

**Verification**:
- Run `pnpm tsc --noEmit` — should pass type checking
- Import from `@/infra/utils/pipeline-health` succeeds

---

## Step 2: Implement Zod validation schemas

**Files to Touch**:
- `src/infra/utils/pipeline-health.ts` (MODIFIED — add schemas)

**Behavior**:
- Add `stageNameSchema = z.string().min(1).trim()` for stage name validation
- Add input validation to all public methods using `safeValidate()` or `validate()`
- On validation failure, throw descriptive ValidationError

**Reproduction Test** (should FAIL before implementation):
```typescript
it('should throw on invalid stage name', () => {
  const reporter = new PipelineHealthReport()
  expect(() => reporter.checkStageHealth('')).toThrow()
  expect(() => reporter.checkStageHealth('   ')).toThrow()
})
```

**Verification**:
- `pnpm tsc --noEmit` passes
- Invalid inputs throw appropriate errors

---

## Step 3: Write comprehensive unit tests

**Files to Touch**:
- `tests/unit/infra/utils/pipeline-health.test.ts` (NEW)

**Behavior**:
- Test `PipelineHealthReport` instantiation
- Test `checkStageHealth()` with valid stage names
- Test `checkStageHealth()` throws on invalid input
- Test `generateReport()` returns valid Report structure
- Test `getRetryRecommendation()` with valid stage names
- Test `getRetryRecommendation()` throws on invalid input
- Test `getStageTimeout()` returns numbers for known stages
- Test `getStageTimeout()` returns default for unknown stages

**Reproduction Test**:
All tests in the file serve as reproduction tests — they should fail before implementation.

**Verification**:
- `pnpm vitest run tests/unit/infra/utils/pipeline-health.test.ts` — all tests pass

---

## Acceptance Criteria

1. ✅ `src/infra/utils/pipeline-health.ts` exports:
   - `PipelineHealthReport` class
   - `HealthStatus`, `Report`, `RetryStrategy` interfaces
   - `getStageTimeout()` function
   - Zod schemas for validation
2. ✅ All exported members have JSDoc comments
3. ✅ All public method parameters validated with Zod
4. ✅ `tests/unit/infra/utils/pipeline-health.test.ts` covers all public methods
5. ✅ `pnpm tsc --noEmit` passes
6. ✅ All tests pass with `pnpm vitest run`
