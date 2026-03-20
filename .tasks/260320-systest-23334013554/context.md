# Codebase Context: 260320-systest-23334013554

## Files to Modify

- `src/infra/utils/pipeline-health.ts` (NEW) — New utility module exporting `PipelineHealthReport` class, interfaces, and helper functions
- `tests/unit/infra/utils/pipeline-health.test.ts` (NEW) — Unit tests for all public exports

## Files to Read (reference patterns)

- `src/infra/utils/textPreprocessing.ts` — JSDoc pattern to follow (module-level + function-level comments)
- `src/infra/utils/validation/common-schemas.ts` — Zod validation pattern (`z.string().min(1)`)
- `tests/unit/infra/utils/speechHelpers.test.ts` — Test structure pattern (simple describe/it blocks)
- `scripts/cody/stages/registry.ts` — Source for `getStageTimeout`, `STAGE_NAMES`, `isValidStageName`

## Key Signatures

```typescript
// From scripts/cody/stages/registry.ts
export function getStageTimeout(stage: StageName): number  // line 218
export const STAGE_NAMES = [...] as const                    // line 21
export type StageName = (typeof STAGE_NAMES)[number]        // line 37
export function isValidStageName(name: string): name is StageName  // line 239
```

## Interface Definitions (from spec)

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

## Reuse Inventory

- `getStageTimeout` from `@/scripts/cody/stages/registry` — Reuse for timeout lookups (NOT hardcoded)
- `STAGE_NAMES` from `@/scripts/cody/stages/registry` — Use for stage name validation
- `isValidStageName` from `@/scripts/cody/stages/registry` — Use for runtime validation
- `z.string().min(1)` pattern from `src/infra/utils/validation/common-schemas.ts` — Non-empty string validation

## Integration Points

- No collections or routes to register
- Self-contained utility module in `src/infra/utils/`
- Tests in `tests/unit/infra/utils/`

## Imports Verified

- `@/scripts/cody/stages/registry` — exports `getStageTimeout`, `STAGE_NAMES`, `isValidStageName`, `StageName` ✅
- `z` from `zod` — Available in project ✅
- `vitest` — Available for testing ✅

## 14 Valid Stage Names

`taskify`, `gap`, `clarify`, `architect`, `plan-gap`, `test`, `build`, `commit`, `review`, `fix`, `verify`, `docs`, `pr`

## Fallback Behavior

- Unknown stage in `getStageTimeout` → returns `getRegistryTimeout('build')`
- Unknown stage in `checkStageHealth` → returns `isHealthy: false`
- Unknown stage in `getRetryRecommendation` → returns RetryStrategy for the unknown stage with default values
