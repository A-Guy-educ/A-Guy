# Plan: Add Zod Validation to Conversion Queue API Endpoints

**Task ID**: 260226-add-zod-validation
**Task Type**: fix_bug
**Risk Level**: Medium
**Estimated Total Time**: 20-30 minutes

## Summary

Two API endpoints (`queue/route.ts` and `queue-v2/route.ts`) destructure `request.json()` directly without Zod validation. Malformed or type-incorrect request bodies bypass validation and reach downstream logic (DB queries, job queuing), potentially causing cryptic errors or unexpected behavior. This plan adds Zod schemas at the API boundary and returns structured 400 errors on parse failure.

## Assumptions

1. The project already has `zod` as a dependency (confirmed: multiple API routes already import it).
2. The project pattern for Zod validation uses `safeParse` with structured error responses (confirmed in `src/app/api/chat-assets/finalize/route.ts`).
3. Existing integration tests in `tests/int/v2-queue-api.int.spec.ts` already cover valid request flows — we add unit tests for Zod validation specifically.
4. The v1 `queue/route.ts` requires `extractorPromptId` and `verifierPromptId` as **required** strings (they are passed directly to `payload.findByID` on lines 91-96 and 112-117 — no optional handling exists).
5. The v2 `queue-v2/route.ts` only requires `lessonId` and `mediaId` — the manual `if (!lessonId || !mediaId)` check on line 65 will be **replaced** by Zod validation.

---

## Step 1: Add Zod Schema and Validation to V2 Queue Endpoint

**Root Cause**: `src/app/api/exercises/convert/queue-v2/route.ts` line 62 destructures `request.json()` without type validation. The existing `if (!lessonId || !mediaId)` check on line 65 is a weak runtime guard (doesn't check types, allows empty strings, allows extra fields).

**Files to Touch**:
- `src/app/api/exercises/convert/queue-v2/route.ts` (MODIFIED - lines 1-67)
- `tests/unit/api/queue-v2-validation.test.ts` (NEW)

**Exact Behavior**:
- Add `import { z } from 'zod'` at the top of the file
- Define schema:
  ```typescript
  const queueV2RequestSchema = z.object({
    lessonId: z.string().min(1),
    mediaId: z.string().min(1),
  })
  ```
- Replace lines 62-67 (the `request.json()` destructure + manual check) with:
  ```typescript
  const body = await request.json()
  const parsed = queueV2RequestSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(
      'VALIDATION_ERROR',
      `Invalid request body: ${parsed.error.issues.map(i => i.message).join(', ')}`,
      400,
    )
  }
  const { lessonId, mediaId } = parsed.data
  ```
- Remove the old manual validation block (`if (!lessonId || !mediaId)` on lines 64-67)

**Reproduction Test** (file: `tests/unit/api/queue-v2-validation.test.ts`):

Write a unit test that imports the route handler and calls it with malformed bodies. Since Next.js route handlers are hard to unit-test in isolation, create **focused unit tests on the Zod schema** itself, plus note that the existing integration test at `tests/int/v2-queue-api.int.spec.ts` lines 215-257 already tests missing fields via HTTP.

Tests:
1. `queueV2RequestSchema rejects empty body` — `safeParse({})` returns `success: false`
2. `queueV2RequestSchema rejects empty strings` — `safeParse({ lessonId: '', mediaId: '' })` returns `success: false`
3. `queueV2RequestSchema rejects non-string lessonId` — `safeParse({ lessonId: 123, mediaId: 'abc' })` returns `success: false`
4. `queueV2RequestSchema rejects missing mediaId` — `safeParse({ lessonId: 'abc' })` returns `success: false`
5. `queueV2RequestSchema accepts valid input` — `safeParse({ lessonId: 'abc', mediaId: 'def' })` returns `success: true`
6. `queueV2RequestSchema strips extra fields` — After parse, the result should NOT contain `extraField`

**Why tests fail before fix**: The schema doesn't exist yet. After creating the schema and exporting it, all tests pass.

**Acceptance Criteria**:
- [ ] `z` is imported from `'zod'` in `queue-v2/route.ts`
- [ ] `queueV2RequestSchema` is defined with `lessonId: z.string().min(1)` and `mediaId: z.string().min(1)`
- [ ] `request.json()` result is validated via `safeParse` before destructuring
- [ ] On validation failure, returns HTTP 400 with `error.code === 'VALIDATION_ERROR'`
- [ ] The old manual `if (!lessonId || !mediaId)` check is removed (replaced by Zod)
- [ ] All 6 unit tests pass
- [ ] `pnpm tsc --noEmit` passes

---

## Step 2: Add Zod Schema and Validation to V1 Queue Endpoint

**Root Cause**: `src/app/api/exercises/convert/queue/route.ts` line 63 destructures `request.json()` without any type validation at all. No manual check exists — `lessonId`, `mediaId`, `extractorPromptId`, and `verifierPromptId` are passed directly to `payload.findByID()` calls. Invalid types (numbers, objects, null) would cause DB errors instead of clean 400 responses.

**Files to Touch**:
- `src/app/api/exercises/convert/queue/route.ts` (MODIFIED - lines 1-63)
- `tests/unit/api/queue-v1-validation.test.ts` (NEW)

**Exact Behavior**:
- Add `import { z } from 'zod'` at the top of the file
- Define schema:
  ```typescript
  const queueRequestSchema = z.object({
    lessonId: z.string().min(1),
    mediaId: z.string().min(1),
    extractorPromptId: z.string().min(1),
    verifierPromptId: z.string().min(1),
  })
  ```
  Note: All four fields are **required** in V1 (both prompt IDs are used unconditionally on lines 91 and 112). The task spec suggested `optional()` for prompt IDs, but code analysis shows they are required — `payload.findByID` is called unconditionally with both. Making them optional would create a runtime error. We keep them required.
- Replace line 63 with:
  ```typescript
  const body = await request.json()
  const parsed = queueRequestSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(
      'VALIDATION_ERROR',
      `Invalid request body: ${parsed.error.issues.map(i => i.message).join(', ')}`,
      400,
    )
  }
  const { lessonId, mediaId, extractorPromptId, verifierPromptId } = parsed.data
  ```

**Reproduction Test** (file: `tests/unit/api/queue-v1-validation.test.ts`):

Tests:
1. `queueRequestSchema rejects empty body` — `safeParse({})` returns `success: false`
2. `queueRequestSchema rejects missing prompt IDs` — `safeParse({ lessonId: 'a', mediaId: 'b' })` returns `success: false`
3. `queueRequestSchema rejects empty string fields` — `safeParse({ lessonId: '', mediaId: '', extractorPromptId: '', verifierPromptId: '' })` returns `success: false`
4. `queueRequestSchema rejects non-string types` — `safeParse({ lessonId: 123, mediaId: null, extractorPromptId: true, verifierPromptId: [] })` returns `success: false`
5. `queueRequestSchema accepts valid input` — `safeParse({ lessonId: 'a', mediaId: 'b', extractorPromptId: 'c', verifierPromptId: 'd' })` returns `success: true`
6. `queueRequestSchema strips extra fields` — Extra properties in input are not present in `parsed.data`

**Why tests fail before fix**: The schema doesn't exist yet. After creating the schema and exporting it, all tests pass.

**Acceptance Criteria**:
- [ ] `z` is imported from `'zod'` in `queue/route.ts`
- [ ] `queueRequestSchema` is defined with all four fields as `z.string().min(1)`
- [ ] `request.json()` result is validated via `safeParse` before destructuring
- [ ] On validation failure, returns HTTP 400 with `error.code === 'VALIDATION_ERROR'`
- [ ] All 6 unit tests pass
- [ ] `pnpm tsc --noEmit` passes

---

## Step 3: Verify Type-Check and Lint Pass

**Files to Touch**: None (verification only)

**Exact Behavior**:
- Run `pnpm tsc --noEmit` — must pass with zero errors
- Run `pnpm lint` — must pass (or only pre-existing warnings)
- Existing integration tests in `tests/int/v2-queue-api.int.spec.ts` should still pass (the Zod validation preserves the same HTTP contract: 400 for missing fields, 401 for unauth, etc.)

**Tests**:
1. `pnpm tsc --noEmit` exits 0
2. `pnpm lint` exits 0

**Acceptance Criteria**:
- [ ] No new TypeScript errors introduced
- [ ] No new lint errors introduced
- [ ] Both modified route files have consistent error response format (`{ error: { code, message } }`)

---

## Implementation Notes for Build Agent

### Schema Export Pattern

Export the schemas so unit tests can import them directly without importing the full route handler:

```typescript
// In each route.ts file, export the schema:
export const queueV2RequestSchema = z.object({ ... })
```

In unit tests:
```typescript
import { queueV2RequestSchema } from '@/app/api/exercises/convert/queue-v2/route'
```

If Next.js route exports cause issues with test bundling, extract schemas to a shared file like `src/app/api/exercises/convert/schemas.ts` and import from there in both route files and tests.

### Error Message Format

Follow the existing project pattern from `chat-assets/finalize/route.ts`:
- Use `safeParse` (not `parse`) to avoid throwing
- Return structured error with the existing `errorResponse` helper
- Use `VALIDATION_ERROR` as the error code (matches existing convention in both files)

### Zod `.parse()` in catch block

The existing `catch` block in both routes catches errors with `code` and `message` properties. Zod's `ZodError` has a `message` property but no `code`. Using `safeParse` (not `parse`) avoids this entirely — validation errors are handled explicitly before the try/catch block's error handling.

### Key Deviation from Spec

The task spec suggested `extractorPromptId: z.string().optional()` and `verifierPromptId: z.string().optional()`. Code analysis shows both are **required** — they're passed to `payload.findByID()` unconditionally (lines 91-96 and 112-117 of `queue/route.ts`). Making them optional would cause a runtime error when `undefined` is passed to `findByID`. The plan uses `.min(1)` (required) for all four fields.

---

## Test Commands

```bash
# Run unit tests for the new validation schemas
pnpm vitest run tests/unit/api/queue-v1-validation.test.ts
pnpm vitest run tests/unit/api/queue-v2-validation.test.ts

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint
```

## Files Summary

| File | Action | Lines Changed |
|------|--------|---------------|
| `src/app/api/exercises/convert/queue-v2/route.ts` | MODIFIED | ~15 lines changed (add import, schema, replace destructure + remove manual check) |
| `src/app/api/exercises/convert/queue/route.ts` | MODIFIED | ~15 lines changed (add import, schema, replace destructure) |
| `tests/unit/api/queue-v2-validation.test.ts` | NEW | ~50 lines |
| `tests/unit/api/queue-v1-validation.test.ts` | NEW | ~50 lines |
