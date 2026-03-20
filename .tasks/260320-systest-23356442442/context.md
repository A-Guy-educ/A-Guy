# Codebase Context: 260320-systest-23356442442

## Files to Create

- `src/infra/utils/pipeline-health.ts` (NEW) — Pipeline health monitoring utility with PipelineHealthReport class
- `tests/unit/infra/utils/pipeline-health.test.ts` (NEW) — Unit tests for pipeline health utility

## Files to Read (reference patterns)

- `src/infra/utils/deepMerge.ts` — JSDoc comment pattern for utilities
- `src/infra/utils/validation/common-schemas.ts` — Zod validation schema patterns
- `tests/unit/infra/utils/speechHelpers.test.ts` — Test file structure (vitest with describe/it/expect)
- `scripts/cody/stages/registry.ts` — Stage names and timeout values

## Key Signatures

```typescript
// From registry.ts
export function getStageTimeout(stage: StageName): number
export const STAGE_NAMES: readonly ['taskify', 'gap', 'clarify', 'architect', 'plan-gap', 'test', 'build', 'commit', 'review', 'fix', 'verify', 'docs', 'pr']

// From common-schemas.ts  
export const emailSchema = z.string().email('Invalid email address')
export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format')

// From speechHelpers.test.ts
import { describe, it, expect } from 'vitest'
import { stripMarkdown, detectLanguage } from '@/infra/utils/speechHelpers'
```

## Reuse Inventory

- `zod` — Input validation (from common-schemas.ts pattern)
- `vitest` — Testing framework (from speechHelpers.test.ts pattern)
- `ms` — Time conversion (from registry.ts pattern)

## Integration Points

- None — standalone utility module with no external dependencies

## Implementation Notes

- Stage timeouts should use milliseconds (matching registry.ts pattern)
- Valid stages: taskify, gap, clarify, architect, plan-gap, test, build, commit, review, fix, verify, docs, pr
- Default timeout for unknown stages: 30 minutes (1800000ms)
