# Codebase Context: 260321-systest-systest-20260321233915

## Files to Modify
- `src/infra/utils/pipeline-health.ts` (NEW) — PipelineHealthReport class with health monitoring methods
- `tests/unit/infra/utils/pipeline-health.test.ts` (NEW) — Integration tests for pipeline health utility

## Files to Read (reference patterns)
- `src/infra/utils/validation/common-schemas.ts` — Zod schema patterns
- `src/infra/utils/validation/validate.ts` — validate/safeValidate helpers to reuse
- `tests/unit/infra/utils/speechHelpers.test.ts` — test structure and patterns

## Key Signatures
- `validate<T>(schema: T, data: unknown): z.infer<T>` from `@/infra/utils/validation/validate`
- `safeValidate<T>(schema: T, data: unknown): { success: true, data } | { success: false, error }` from `@/infra/utils/validation/validate`
- `formatZodErrors(error: z.ZodError): Record<string, string[]>` from `@/infra/utils/validation/validate`

## Reuse Inventory
- `z` from 'zod' — Zod validation, already used in codebase
- `validate`/`safeValidate` from `@/infra/utils/validation/validate` — reuse not create new
- `formatZodErrors` from `@/infra/utils/validation/validate` — reuse for error formatting

## Integration Points
- None — standalone utility module, no registration required

## Imports Verified
- `@/infra/utils/validation/validate` → exports validate, safeValidate, formatZodErrors ✅
- `zod` → available as dependency ✅
