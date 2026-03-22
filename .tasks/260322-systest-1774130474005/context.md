# Codebase Context: 260322-systest-1774130474005

## Files to Modify

- `src/infra/utils/pipeline-health.ts` (NEW) — Main utility module with PipelineHealthReport class, interfaces, and helper function
- `tests/unit/infra/utils/pipeline-health.test.ts` (NEW) — Integration tests for all public methods

## Files to Read (reference patterns)

- `src/infra/utils/validation/common-schemas.ts` — Zod schema patterns (import `z` from 'zod')
- `src/infra/utils/validation/validate.ts` — Validation helper functions (validate, safeValidate, formatZodErrors)
- `tests/unit/infra/utils/speechHelpers.test.ts` — Test file pattern with Vitest describe/it/expect

## Key Signatures

```typescript
// New exports from src/infra/utils/pipeline-health.ts
export class PipelineHealthReport {
  checkStageHealth(stage: string): HealthStatus
  generateReport(): Report
  getRetryRecommendation(failedStage: string): RetryStrategy
}

export function getStageTimeout(stage: string): number

// Interfaces
export interface HealthStatus {
  stage: string
  isHealthy: boolean
  lastCheck: Date
  message?: string
}

export interface Report {
  timestamp: Date
  stages: HealthStatus[]
  overallHealth: 'healthy' | 'degraded' | 'unhealthy'
}

export interface RetryStrategy {
  stage: string
  recommendedRetries: number
  backoffMultiplier: number
  shouldRetry: boolean
}
```

## Reuse Inventory

- `z` from `zod` — Use for runtime validation schemas in pipeline-health.ts
- `validate`/`safeValidate` from `src/infra/utils/validation/validate.ts` — Can reuse for input validation
- Vitest (`describe`, `it`, `expect`) — Already used in existing test files

## Integration Points

- No Payload collection registration needed (pure utility module)
- No Next.js route registration needed
- No admin component registration needed

## Imports Verified

- `zod` — Available as project dependency ✅
- `vitest` — Available as dev dependency for testing ✅
- `src/infra/utils/` directory exists ✅
- `tests/unit/infra/utils/` directory exists ✅
