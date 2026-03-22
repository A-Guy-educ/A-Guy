# Build Summary

## Changes

- Created `src/infra/utils/pipeline-health.ts` with `PipelineHealthReport` class, `HealthStatus`/`Report`/`RetryStrategy` interfaces, `getStageTimeout` helper, and `stageNameSchema`/`failedStageSchema` Zod validation schemas
- Created `tests/unit/infra/utils/pipeline-health.test.ts` with 33 integration tests covering all public methods and Zod validation

## Files

- `src/infra/utils/pipeline-health.ts`
- `tests/unit/infra/utils/pipeline-health.test.ts`

## Implementation Details

**Interfaces:**
- `HealthStatus` — `{ status: 'pass'|'fail'|'warn', message: string, timestamp: Date }`
- `Report` — `{ overallHealth: 'healthy'|'degraded'|'unhealthy', stageStatuses: Record<string,HealthStatus>, generatedAt: Date }`
- `RetryStrategy` — `{ shouldRetry: boolean, maxRetries: number, backoffMultiplier: number }`

**Exports:**
- `stageNameSchema`, `failedStageSchema` — Zod schemas for parameter validation
- `getStageTimeout(stage: string): number` — returns timeout in ms per stage; throws ZodError for invalid names
- `PipelineHealthReport` class with `checkStageHealth()`, `generateReport()`, `getRetryRecommendation()`

**Timeout map (ms):** taskify=600000, gap=900000, clarify=600000, architect=1800000, plan-gap=900000, test=1200000, build=2700000, commit=300000, review=900000, fix=2700000, verify=600000, docs=600000, pr=300000

## Verification

| Check | Result |
|-------|--------|
| `pnpm -s tsc --noEmit` | ✅ Pass |
| `pnpm vitest run` (33 tests) | ✅ Pass — 378ms |
