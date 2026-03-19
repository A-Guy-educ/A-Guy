# Plan: Pipeline Health Monitoring Utility Module

## Rerun Context

This is a SPEC-ONLY pipeline. The previous run completed gap analysis and spec revision. No implementation was attempted. This plan proceeds with the revised spec.

## Research Findings

- **File paths verified**:
  - `src/infra/utils/pipeline-health.ts` - NEW file to create
  - `tests/unit/infra/utils/pipeline-health.test.ts` - NEW file to create (test dir exists at tests/unit/infra/utils/)
  - Existing pattern files reviewed: `src/infra/utils/validation/common-schemas.ts` (Zod schemas), `src/infra/utils/deepMerge.ts` (utility patterns)
  - Existing tests: `tests/unit/infra/circuit-breaker.spec.ts` (test patterns)

- **Patterns observed**:
  - Utilities in src/infra/utils/ use JSDoc comments on all exported functions
  - Zod schemas are exported as named const objects (e.g., `emailSchema`, `passwordSchema`)
  - Tests use vitest with describe/it/expect pattern

- **Integration points**:
  - None required - this is a standalone utility module
  - Must follow guardrail: Do NOT import from scripts/cody/stages/registry.ts

## Reuse Inventory

- **Zod**: Import from `zod` package (confirmed available from existing code)
- **Test utilities**: Use standard vitest imports (describe, it, expect, beforeEach)
- **No existing pipeline health code** - this is a new module

## Steps

### Step 1: Define TypeScript interfaces and Zod validation schemas

**Files to Touch**:
- `src/infra/utils/pipeline-health.ts` (NEW)

**Behavior**: 
- Define `StageName` type with literal union for all valid pipeline stages: taskify, gap, clarify, architect, plan-gap, test, build, commit, review, fix, verify, docs, pr
- Define `HealthStatus` interface per NFR-001: stage, status (healthy|degraded|failed|unknown), timestamp, optional message
- Define `Report` interface per NFR-002: stages array, overallHealth (0-100), generatedAt
- Define `RetryStrategy` interface per NFR-003: maxRetries, backoffMs, strategyType (fixed|exponential|linear)
- Create Zod validation schemas:
  - `stageNameSchema`: z.enum with all valid stage names
  - `healthStatusSchema`: z.object matching HealthStatus
  - `retryStrategySchema`: z.object matching RetryStrategy

**Test**:
- Test location: `tests/unit/infra/utils/pipeline-health.test.ts`
- Test: Type definitions compile correctly and Zod schemas validate correctly
- Run: `pnpm vitest run tests/unit/infra/utils/pipeline-health.test.ts`

### Step 2: Implement getStageTimeout helper function

**Files to Touch**:
- `src/infra/utils/pipeline-health.ts` (MODIFIED - add function)

**Behavior**:
- Define DEFAULT_TIMEOUTS constant mapping stage names to timeout values in milliseconds
- Implement `getStageTimeout(stage: string): number` that returns timeout for valid stage or default (5 minutes)
- Add Zod validation for stage parameter using stageNameSchema

**Test**:
- Test: getStageTimeout returns correct values for known stages
- Test: getStageTimeout returns default for unknown stage
- Test: Zod validation rejects invalid stage names

### Step 3: Implement PipelineHealthReport class

**Files to Touch**:
- `src/infra/utils/pipeline-health.ts` (MODIFIED - add class)

**Behavior**:
- Export `PipelineHealthReport` class with constructor accepting optional stage health data
- Implement `checkStageHealth(stage: string): HealthStatus`:
  - Validates stage using Zod
  - Returns HealthStatus object with stage, status (healthy by default), timestamp, optional message
- Implement `generateReport(): Report`:
  - Returns Report with stages array, overallHealth percentage, generatedAt timestamp
- Implement `getRetryRecommendation(failedStage: string): RetryStrategy`:
  - Returns RetryStrategy based on failed stage type
  - Map: taskify/gap/clarify/architect/plan-gap → exponential, test/build/commit → fixed, review/fix/verify → linear, docs/pr → fixed

**Test**:
- Test: checkStageHealth validates input and returns correct HealthStatus
- Test: generateReport returns valid Report with correct structure
- Test: getRetryRecommendation returns correct RetryStrategy per stage
- Test: All methods validate inputs with Zod and throw on invalid input

### Step 4: Write companion unit tests

**Files to Touch**:
- `tests/unit/infra/utils/pipeline-health.test.ts` (NEW)

**Behavior**: 
- Import all exports from src/infra/utils/pipeline-health.ts
- Test all exported functions and class methods
- Include edge cases for invalid inputs

**Test**:
- All tests must pass: `pnpm vitest run tests/unit/infra/utils/pipeline-health.test.ts`

## Acceptance Criteria

- [ ] PipelineHealthReport class exports successfully
- [ ] All three class methods implemented and return correct types
- [ ] HealthStatus, Report, RetryStrategy interfaces defined with required properties (NFR-001, NFR-002, NFR-003)
- [ ] getStageTimeout returns appropriate timeout values for all pipeline stages (FR-003)
- [ ] All exported members have JSDoc comments (FR-004)
- [ ] Zod validation schemas defined and used in public methods (FR-005)
- [ ] Test file exists at tests/unit/infra/utils/pipeline-health.test.ts (FR-006)
- [ ] Tests cover all public methods
- [ ] TypeScript compiles without errors: `pnpm tsc --noEmit`

## Notes

- Complexity: 25 (medium) - 2 new files, self-contained module
- This is a utility module only - no integration with actual pipeline runtime
- Must not import from scripts/cody/stages/registry.ts per guardrails
