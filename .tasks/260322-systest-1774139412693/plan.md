# Plan: Pipeline Health Monitoring Utility

## Rerun Context

Rerun requested via `/cody rerun`. Previous implementation exists but requires review against spec.md requirements.

## Research Findings

**File paths verified:**
- `src/infra/utils/pipeline-health.ts` (NEW) — will create alongside existing utils
- `tests/unit/infra/utils/pipeline-health.test.ts` (NEW) — test location confirmed
- `src/infra/utils/zodToPayloadError.ts` ✅ exists — pattern for Zod validation
- `src/infra/utils/deepMerge.ts` ✅ exists — pattern for JSDoc comments
- `scripts/cody/stages/registry.ts` ✅ exists — contains `getStageTimeout` and `STAGE_NAMES`

**Patterns observed:**
- Utilities in `src/infra/utils/` use simple exported functions with JSDoc comments
- Zod validation pattern: `zodErrorToPayloadErrors` for converting Zod errors
- Tests use vitest with `describe`/`it`/`expect` format
- Stage names from `scripts/cody/stages/registry.ts` include: taskify, gap, clarify, architect, plan-gap, test, build, commit, review, fix, verify, docs, pr

**Integration points:**
- Must import `getStageTimeout` from `scripts/cody/stages/registry.ts` OR replicate logic
- Note: `scripts/cody/stages/registry.ts` is in `scripts/` not `src/infra/utils/` — this utility is standalone

## Reuse Inventory

- `zod` from `zod` package — for input validation schemas
- Vitest (`describe`, `it`, `expect`) — from `tests/unit/infra/utils/speechHelpers.test.ts` pattern
- JSDoc patterns from `src/infra/utils/deepMerge.ts` — function documentation
- Stage names and timeouts from `scripts/cody/stages/registry.ts` — for `getStageTimeout` implementation

---

## Step 1: Create pipeline-health.ts with interfaces, schemas, and helper function

**Files to Touch:**
- `src/infra/utils/pipeline-health.ts` (NEW)

**Implementation:**
- Define `HealthStatus` interface with `stage`, `healthy`, `message`, `timestamp`
- Define `Report` interface with `overallHealth`, `stages`, `generatedAt`, `recommendations`
- Define `RetryStrategy` interface with `stage`, `shouldRetry`, `maxRetries`, `backoffMultiplier`, `reason`
- Create Zod schemas for input validation: `StageNameSchema` (from STAGE_NAMES list), `HealthStatusSchema`, `ReportSchema`, `RetryStrategySchema`
- Implement `getStageTimeout(stage: string): number` — returns default timeouts per stage based on registry values
- Add JSDoc comments to all exported types and functions

**Tests:**
- Test location: `tests/unit/infra/utils/pipeline-health.test.ts`
- `getStageTimeout('architect')` should return a positive number
- `getStageTimeout('invalid-stage')` should throw ValidationError

**Acceptance Criteria:**
- All 4 interfaces defined and exported
- Zod schemas validate stage names against STAGE_NAMES
- `getStageTimeout` returns correct timeout for valid stages
- `getStageTimeout` throws for invalid stage names

---

## Step 2: Implement PipelineHealthReport class

**Files to Touch:**
- `src/infra/utils/pipeline-health.ts` (MODIFIED — add class)

**Implementation:**
- Add `PipelineHealthReport` class with:
  - `checkStageHealth(stage: string): HealthStatus` — checks health of a specific stage
  - `generateReport(): Report` — generates comprehensive health report for all stages
  - `getRetryRecommendation(failedStage: string): RetryStrategy` — provides retry strategy
- All public methods use Zod schemas for input validation
- Health check considers: timeout configuration, stage type (agent/scripted/git)
- Retry recommendation considers: stage type, max retries from registry, failure patterns

**Tests:**
- `checkStageHealth('architect')` returns HealthStatus with stage name and healthy=true
- `checkStageHealth('invalid')` throws ValidationError
- `generateReport()` returns Report with all stages
- `getRetryRecommendation('build')` returns RetryStrategy with shouldRetry, maxRetries

**Acceptance Criteria:**
- PipelineHealthReport class exported with all 3 methods
- All public methods have Zod validation on inputs
- All exported members have JSDoc comments

---

## Step 3: Write integration tests

**Files to Touch:**
- `tests/unit/infra/utils/pipeline-health.test.ts` (NEW)

**Implementation:**
- Test all public methods of PipelineHealthReport class
- Test `getStageTimeout` helper function
- Test Zod validation errors for invalid inputs
- Follow vitest conventions from existing test files

**Tests:**
- `describe('getStageTimeout')` — tests for valid and invalid stage names
- `describe('PipelineHealthReport')` — tests for checkStageHealth, generateReport, getRetryRecommendation
- `describe('validation')` — tests that invalid inputs throw ValidationError

**Acceptance Criteria:**
- All public methods covered by tests
- Invalid inputs are rejected with ValidationError
- Tests follow project conventions (vitest)
