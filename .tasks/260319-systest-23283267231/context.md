# Codebase Context: 260319-systest-23283267231

## Files to Modify
- `src/infra/utils/pipeline-health.ts` (NEW) — Pipeline health monitoring utility module
- `tests/unit/infra/utils/pipeline-health.test.ts` (NEW) — Integration tests

## Files to Read (reference patterns)
- `src/infra/utils/validation/common-schemas.ts` — Zod validation patterns
- `src/infra/utils/logger/logger.ts` — Logger export pattern
- `scripts/cody/stages/registry.ts` — Stage timeout definitions (reference values)
- `tests/unit/infra/utils/speechHelpers.test.ts` — Test structure pattern

## Key Signatures
```typescript
// From registry.ts (reference for timeouts)
export function getStageTimeout(stage: StageName): number
export const STAGE_REGISTRY: Record<StageName, StageMetadata>

// Zod patterns from common-schemas.ts
export const emailSchema = z.string().email('Invalid email address')
export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format')

// Test pattern from speechHelpers.test.ts
import { describe, it, expect } from 'vitest'
```

## Reuse Inventory
- `zod` package — for input validation schemas
- `vitest` — for testing framework
- Stage timeout values from `scripts/cody/stages/registry.ts` — reference for timeouts

## Integration Points
- No Payload collections or endpoints to register
- No routes to add
- Standalone utility module

## Imports Verified
- `z` from 'zod' ✅
- `describe, it, expect` from 'vitest' ✅
- Stage names from registry: taskify, gap, clarify, architect, plan-gap, test, build, commit, review, fix, verify, docs, pr ✅
- Timeout ranges: 5m (commit/pr) to 45m (build) ✅
