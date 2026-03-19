# Codebase Context: 260319-systest-23281989096

## Files to Modify

- `src/infra/utils/pipeline-health.ts` (NEW) — New utility module with PipelineHealthReport class
- `tests/unit/infra/utils/pipeline-health.test.ts` (NEW) — Unit tests for all exported members

## Files to Read (reference patterns)

- `src/infra/utils/validation/common-schemas.ts` — Zod schema patterns
- `src/infra/utils/deepMerge.ts` — Utility export patterns
- `tests/unit/infra/circuit-breaker.spec.ts` — Test patterns

## Key Signatures

```typescript
// New exports to create
export class PipelineHealthReport {
  checkStageHealth(stage: string): HealthStatus
  generateReport(): Report
  getRetryRecommendation(failedStage: string): RetryStrategy
}

export function getStageTimeout(stage: string): number

// Interfaces
export interface HealthStatus {
  stage: string
  status: 'healthy' | 'degraded' | 'failed' | 'unknown'
  timestamp: string
  message?: string
}

export interface Report {
  stages: HealthStatus[]
  overallHealth: number
  generatedAt: string
}

export interface RetryStrategy {
  maxRetries: number
  backoffMs: number
  strategyType: 'fixed' | 'exponential' | 'linear'
}

// Zod schemas
export const stageNameSchema: z.ZodEnum<['taskify', 'gap', 'clarify', ...]>
export const healthStatusSchema: z.ZodObject<...>
export const retryStrategySchema: z.ZodObject<...>
```

## Reuse Inventory

- `zod` — Use for validation schemas (already in project)
- `vitest` — Test framework (describe, it, expect, beforeEach)

## Integration Points

- None required — standalone utility module
- Must NOT import from `scripts/cody/stages/registry.ts` per guardrails

## Imports Verified

- `import { z } from 'zod'` ✅
- `import { describe, it, expect, beforeEach } from 'vitest'` ✅

## Valid Pipeline Stages

Per the spec and guardrails, the module must define its own stage list:
- taskify, gap, clarify, architect, plan-gap, test, build, commit, review, fix, verify, docs, pr

## Test Command

```bash
pnpm vitest run tests/unit/infra/utils/pipeline-health.test.ts
```
