# Codebase Context: 260322-systest-1774130474005

## Files to Modify
- `src/infra/utils/pipeline-health.ts` (NEW) — PipelineHealthReport class with HealthStatus, Report, RetryStrategy interfaces, getStageTimeout helper, Zod validation
- `tests/unit/infra/utils/pipeline-health.test.ts` (NEW) — Unit tests covering all public methods

## Files to Read (reference patterns)
- `src/infra/utils/path-utils.ts` — JSDoc comment style, simple utility function patterns
- `src/infra/utils/validation/validate.ts` — validate(), safeValidate() helpers for Zod
- `src/infra/utils/validation/common-schemas.ts` — Zod schema patterns (emailSchema, objectIdSchema, etc.)
- `tests/unit/infra/utils/speechHelpers.test.ts` — Test file structure with describe/it/expect

## Key Signatures

### Zod Validation Pattern
```typescript
// From src/infra/utils/validation/validate.ts
export function validate<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T>
export function safeValidate<T extends z.ZodTypeAny>(schema: T, data: unknown): { success: true; data: z.infer<T> } | { success: false; error: z.ZodError }

// From src/infra/utils/validation/common-schemas.ts
export const emailSchema = z.string().email('Invalid email address')
export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format')
```

### Test Pattern
```typescript
// From tests/unit/infra/utils/speechHelpers.test.ts
import { describe, it, expect } from 'vitest'
describe('functionName', () => {
  it('should do something', () => {
    expect(someFunction()).toBe(expected)
  })
})
```

## Reuse Inventory
- `z` from 'zod' — Zod validation schema creation
- `validate`, `safeValidate` from `@/infra/utils/validation` — validation helpers
- Vitest `describe`, `it`, `expect` — testing framework
- Existing `src/infra/utils/` patterns for JSDoc and exports

## Integration Points
- None — standalone utility module, no collection or API integration
- Import path: `@/infra/utils/pipeline-health`

## Imports Verified
- `zod` → exports `z` for schema creation ✅
- `@/infra/utils/validation` → exports `validate`, `safeValidate` ✅
- `vitest` → exports `describe`, `it`, `expect` ✅
- `src/infra/utils/` → exists with similar utilities ✅
