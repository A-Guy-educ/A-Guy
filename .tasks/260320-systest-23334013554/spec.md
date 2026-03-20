# Pipeline Health Monitoring Utility

## Overview

A new utility module at `src/infra/utils/pipeline-health.ts` that exports a `PipelineHealthReport` class for monitoring Cody pipeline health.

## Requirements

### FR-001: PipelineHealthReport Class

**Priority:** MUST
**Description:** Export a `PipelineHealthReport` class with the following public methods:

- `checkStageHealth(stage: string): HealthStatus` - Checks the health of a specific pipeline stage
- `generateReport(): Report` - Generates a comprehensive health report
- `getRetryRecommendation(failedStage: string): RetryStrategy` - Provides retry strategy for a failed stage

**Interface Definitions:**

```typescript
interface HealthStatus {
  stage: string
  isHealthy: boolean
  lastChecked: Date
  errorMessage?: string
}

interface Report {
  overallStatus: 'healthy' | 'degraded' | 'unhealthy'
  stageStatuses: HealthStatus[]
  generatedAt: Date
}

interface RetryStrategy {
  maxRetries: number
  backoffMultiplier: number
  retryDelay: number // milliseconds
  stage: string
}
```

### FR-002: Zod Input Validation

**Priority:** MUST
**Description:** Input validation using Zod schemas for all public method parameters:

- `checkStageHealth` accepts `stage: string` (must be non-empty)
- `getRetryRecommendation` accepts `failedStage: string` (must be non-empty)
- Schema pattern follows `src/infra/utils/validation/common-schemas.ts`

### NFR-001: Reuse Existing `getStageTimeout`

**Priority:** MUST
**Description:** The `getStageTimeout` helper must import and re-export from `scripts/cody/stages/registry.ts` rather than duplicating stage registry data. The implementation should validate stage names and return a sensible default for unknown stages.

```typescript
import { getStageTimeout as getRegistryTimeout, STAGE_NAMES } from '@/scripts/cody/stages/registry'

export function getStageTimeout(stage: string): number {
  if (!STAGE_NAMES.includes(stage as any)) {
    return getRegistryTimeout('build') // Default fallback
  }
  return getRegistryTimeout(stage as any)
}
```

### FR-003: JSDoc Documentation

**Priority:** MUST
**Description:** JSDoc comments on all exported members following the pattern in `src/infra/utils/textPreprocessing.ts`:
- Module-level JSDoc describing the utility's purpose
- Function-level JSDoc with `@param` and `@returns` tags

### FR-004: Unit Tests

**Priority:** MUST
**Description:** Companion test file at `tests/unit/infra/utils/pipeline-health.test.ts` covering all public methods following the pattern in `tests/unit/infra/utils/speechHelpers.test.ts`.

Test coverage must include:
- `checkStageHealth`: valid stage, invalid stage
- `generateReport`: returns correct structure, calculates overall status
- `getRetryRecommendation`: valid failed stage, returns retry strategy
- `getStageTimeout`: known stages return correct values, unknown stages return fallback

## Acceptance Criteria

- [ ] `PipelineHealthReport` class exports correctly
- [ ] `checkStageHealth(stage: string): HealthStatus` returns correct interface shape
- [ ] `generateReport(): Report` returns correct interface shape with `overallStatus`, `stageStatuses`, `generatedAt`
- [ ] `getRetryRecommendation(failedStage: string): RetryStrategy` returns correct interface shape
- [ ] `getStageTimeout` imports and re-exports from `@/scripts/cody/stages/registry`
- [ ] All exported members have complete JSDoc comments
- [ ] Zod schemas validate `stage` and `failedStage` parameters
- [ ] Unit tests cover all public methods with passing tests
- [ ] Code follows project TypeScript conventions (no `any`, proper error handling)

## Guardrails

- **DO NOT** hardcode timeout values - import from registry
- **DO NOT** create duplicate stage metadata - use `STAGE_NAMES` and `STAGE_REGISTRY`
- **DO NOT** use `any` types - use proper TypeScript types

## Out of Scope

- Runtime health monitoring (initial implementation uses in-memory state)
- Persistence of health data
- Health alert notifications
- Integration with external monitoring systems
