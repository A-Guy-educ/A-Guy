# Codebase Context: 260322-systest-1774139412693

## Files to Modify

- `src/infra/utils/pipeline-health.ts` (NEW) — PipelineHealthReport class with health check methods
- `tests/unit/infra/utils/pipeline-health.test.ts` (NEW) — Integration tests for all public methods

## Files to Read (reference patterns)

- `src/infra/utils/zodToPayloadError.ts` — Zod validation pattern (zodErrorToPayloadErrors)
- `src/infra/utils/deepMerge.ts` — JSDoc comment patterns
- `tests/unit/infra/utils/speechHelpers.test.ts` — Test file pattern (vitest)
- `scripts/cody/stages/registry.ts` — Stage names (STAGE_NAMES) and timeouts (getStageTimeout)

## Key Signatures

```typescript
// From scripts/cody/stages/registry.ts
export const STAGE_NAMES = ['taskify', 'gap', 'clarify', 'architect', 'plan-gap', 'test', 'build', 'commit', 'review', 'fix', 'verify', 'docs', 'pr'] as const
export type StageName = (typeof STAGE_NAMES)[number]
export function getStageTimeout(stage: StageName): number

// From zodToPayloadError.ts
export function zodErrorToPayloadErrors(zodError: ZodError, options: {...}): Array<{ path: string; message: string }>
export function throwPayloadValidationError(zodError: ZodError, fieldPrefix: string): never
```

## Reuse Inventory

- `zod` — Input validation schemas (import { z } from 'zod')
- `ValidationError` from `payload` — For throwing validation errors
- `STAGE_NAMES`, `STAGE_REGISTRY` from `scripts/cody/stages/registry` — Stage name constants and metadata

## Integration Points

- This is a standalone utility — no integration with production code (per spec constraints)
- Tests will import from `src/infra/utils/pipeline-health`
- Uses same Zod validation pattern as `zodToPayloadError.ts`

## Imports Verified

- `z` from `zod` ✅
- `ValidationError` from `payload` ✅
- `STAGE_NAMES`, `STAGE_REGISTRY` from `@/scripts/cody/stages/registry` ✅ (path alias configured)

## Stage Names (for validation)

```typescript
['taskify', 'gap', 'clarify', 'architect', 'plan-gap', 'test', 'build', 'commit', 'review', 'fix', 'verify', 'docs', 'pr']
```

## Stage Timeouts (from registry)

| Stage | Timeout |
|-------|---------|
| taskify | 10m |
| gap | 15m |
| clarify | 10m |
| architect | 30m |
| plan-gap | 15m |
| test | 20m |
| build | 45m |
| commit | 5m |
| review | 15m |
| fix | 45m |
| verify | 10m |
| docs | 10m |
| pr | 5m |
