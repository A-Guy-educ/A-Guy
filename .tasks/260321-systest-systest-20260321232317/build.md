# Pipeline Health Monitoring Utility - Build Report

## Summary

Implemented the `PipelineHealthReport` class and supporting utilities at `src/infra/utils/pipeline-health.ts`, plus integration tests at `tests/unit/infra/utils/pipeline-health.test.ts`.

## What Was Implemented

### 1. Source File: `src/infra/utils/pipeline-health.ts`

**Interfaces:**
- `HealthStatus` — `{ status: 'pass'|'fail'|'warn', message: string, timestamp: Date }`
- `Report` — `{ overallHealth: 'healthy'|'degraded'|'unhealthy', stageStatuses: Record<string,HealthStatus>, generatedAt: Date }`
- `RetryStrategy` — `{ shouldRetry: boolean, maxRetries: number, backoffMultiplier: number }`

**Zod Schemas:**
- `stageNameSchema` — validates stage names against the 13 known pipeline stages
- `failedStageSchema` — same validation (reuses `stageNameSchema`)

**Helper:**
- `getStageTimeout(stage: string): number` — returns timeout in ms per stage (sourced from `scripts/cody/stages/registry.ts`); throws `ZodError` for invalid stage names

**Class: `PipelineHealthReport`**
- `checkStageHealth(stage: string): HealthStatus` — validates `stage` with Zod, returns health status
- `generateReport(): Report` — returns full report with all 13 stage statuses and derived `overallHealth`
- `getRetryRecommendation(failedStage: string): RetryStrategy` — validates `failedStage` with Zod, returns retry advice

**All exported members have JSDoc comments.**

### 2. Test File: `tests/unit/infra/utils/pipeline-health.test.ts`

33 tests covering:
- `getStageTimeout` — all 13 stage timeouts, invalid stage throws `ZodError`
- `PipelineHealthReport.checkStageHealth` — valid/invalid stage validation, return shape
- `PipelineHealthReport.generateReport` — all 13 stages present, `overallHealth` derived, `generatedAt` is Date
- `PipelineHealthReport.getRetryRecommendation` — retry/no-retry stages, backoff multipliers (2.0 agent / 1.5 other), Zod validation
- Zod schema validation — accepts all valid stage names, rejects invalid ones

## Verification

| Check | Result |
|-------|--------|
| `pnpm -s tsc --noEmit` | ✅ Pass |
| `pnpm vitest run` (33 tests) | ✅ Pass — 377ms |

## Notes

- Does NOT import from `scripts/cody/stages/registry.ts` (different domain); mirrors timeout values directly
- Stage timeout map matches registry: taskify=10m, gap=15m, clarify=10m, architect=30m, plan-gap=15m, test=20m, build=45m, commit=5m, review=15m, fix=45m, verify=10m, docs=10m, pr=5m
- No Payload collections, globals, or endpoints created — pure utility module
