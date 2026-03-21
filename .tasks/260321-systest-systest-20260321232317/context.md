# Codebase Context: 260321-systest-systest-20260321232317

## Files to Modify

- `src/infra/utils/pipeline-health.ts` (NEW) — PipelineHealthReport class with checkStageHealth, generateReport, getRetryRecommendation; getStageTimeout helper; HealthStatus/Report/RetryStrategy interfaces; Zod validation schemas
- `tests/unit/infra/utils/pipeline-health.test.ts` (NEW) — Integration tests for all public methods and Zod validation

## Files to Read (reference patterns)

- `src/infra/utils/validation/common-schemas.ts` — Zod schema pattern used in this codebase
- `src/infra/utils/deepMerge.ts` — JSDoc comment style used in this codebase
- `tests/unit/infra/qa/schema.test.ts` — Test pattern for Zod validation with safeParse
- `scripts/cody/stages/registry.ts` — Stage timeouts and STAGE_NAMES reference (for getStageTimeout values)

## Key Signatures

```typescript
// Zod usage pattern (from common-schemas.ts)
export const emailSchema = z.string().email('Invalid email address')

// Class pattern — PipelineHealthReport (new file)
export class PipelineHealthReport {
  checkStageHealth(stage: string): HealthStatus
  generateReport(): Report
  getRetryRecommendation(failedStage: string): RetryStrategy
}

// Helper function (new file)
export function getStageTimeout(stage: string): number

// Interfaces (new file)
interface HealthStatus {
  status: 'pass' | 'fail' | 'warn'
  message: string
  timestamp: Date
}

interface Report {
  overallHealth: 'healthy' | 'degraded' | 'unhealthy'
  stageStatuses: Record<string, HealthStatus>
  generatedAt: Date
}

interface RetryStrategy {
  shouldRetry: boolean
  maxRetries: number
  backoffMultiplier: number
}
```

## Reuse Inventory

- `zod` — imported from 'zod' for validation schemas
- No utilities reused from src/infra/utils/ — fresh implementation per spec

## Integration Points

- No Payload collections, globals, or endpoints
- No Next.js routes
- Not registered in payload.config.ts
- Pure utility module — imported directly by consumers

## Imports Verified

- `zod` package available ✅ (standard dependency)
- `src/infra/utils/validation/common-schemas.ts` pattern confirmed ✅
- Stage timeouts from registry: taskify=10m, gap=15m, clarify=10m, architect=30m, plan-gap=15m, test=20m, build=45m, commit=5m, review=15m, fix=45m, verify=10m, docs=10m, pr=5m ✅
