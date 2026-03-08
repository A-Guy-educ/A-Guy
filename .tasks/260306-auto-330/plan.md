# Plan: 260306-auto-330 — Harden Cody Dashboard API Routes

## Rerun Context

This is a rerun with no specific code-level feedback (feedback was just "/cody rerun"). The previous run had no plan.md written. This plan is being created fresh based on the spec requirements. No approach changes needed — this is the first plan for this task.

## Summary

Refactor five Cody dashboard API routes to:
1. Remove blanket `eslint-disable` and `catch (error: any)` patterns
2. Add Zod input validation with specific bounds
3. Create a shared GitHub/upstream error handler utility
4. Standardize error response format using the existing `src/server/api/responses.ts` pattern
5. Add tests for validation and error mapping

## Assumptions

1. **Error response format**: We will use the existing `src/server/api/responses.ts` format (`{ error: { code, message, details? } }`) since it already exists and is well-typed. We extend `ApiErrorCode` with `RATE_LIMITED` and `UPSTREAM_ERROR` codes. This avoids breaking consumers of other endpoints that already use this format.
2. **Success payload preservation**: Success response shapes (`{ pr }`, `{ files }`, `{ runs }`, `{ boards }`, `{ status, source }`) are preserved exactly as-is per FR-006.
3. **Shared utility location**: `src/lib/cody/github-error-handler.ts` — keeps it scoped to Cody domain.
4. **Schemas location**: Inline per route for simplicity (small schemas), plus shared `taskIdSchema` in `src/lib/cody/schemas.ts`.
5. **Boards route**: Kept as public endpoint (no auth) with explicit documentation comment, but mock-data fallback on error is removed in favor of proper error responses per FR-007.
6. **Error privacy posture**: GitHub 403 is mapped to 403 (not 404) since these are admin-facing dashboard routes, not public-facing.

## File Inventory

| File | Action | Spec Refs |
|------|--------|-----------|
| `src/server/api/responses.ts` | MODIFIED (lines 6-25) — add `RATE_LIMITED`, `UPSTREAM_ERROR` codes | FR-005 |
| `src/lib/cody/schemas.ts` | NEW | FR-001 |
| `src/lib/cody/github-error-handler.ts` | NEW | FR-004, FR-005, FR-007 |
| `src/app/api/cody/prs/route.ts` | MODIFIED (full file) | FR-001, FR-002, FR-003 |
| `src/app/api/cody/prs/files/route.ts` | MODIFIED (full file) | FR-001, FR-002, FR-003 |
| `src/app/api/cody/workflows/route.ts` | MODIFIED (full file) | FR-001, FR-002, FR-003 |
| `src/app/api/cody/pipeline/[taskId]/route.ts` | MODIFIED (full file) | FR-001, FR-002, FR-003 |
| `src/app/api/cody/boards/route.ts` | MODIFIED (full file) | FR-001, FR-002, FR-003, FR-007 |
| `tests/unit/cody-api-routes.spec.ts` | NEW | NFR-004 |

---

## Step 1: Extend ApiErrorCode and add RATE_LIMITED / UPSTREAM_ERROR codes

**Time estimate**: 10 minutes

**Files to Touch**:
- `src/server/api/responses.ts` (MODIFIED — lines 6-25, add 2 new codes + factory helpers)

**Exact Behavior**:
- Add `'RATE_LIMITED'` and `'UPSTREAM_ERROR'` to the `ApiErrorCode` union type
- Add two factory methods to `ApiErrors`:
  - `rateLimited: (retryAfter?: string) => { ... }` — returns 429 with optional `Retry-After` header
  - `upstreamError: (message = 'Upstream service error') => apiError('UPSTREAM_ERROR', message, 502)`

**Tests** (in `tests/unit/cody-api-routes.spec.ts`):
1. `ApiErrors.rateLimited() returns 429 with code RATE_LIMITED` — FAILS before (no such method), PASSES after
2. `ApiErrors.upstreamError() returns 502 with code UPSTREAM_ERROR` — FAILS before (no such method), PASSES after

**Acceptance Criteria**:
- [ ] `ApiErrorCode` type includes `'RATE_LIMITED'` and `'UPSTREAM_ERROR'`
- [ ] `ApiErrors.rateLimited()` returns NextResponse with status 429 and JSON `{ error: { code: 'RATE_LIMITED', message: '...' } }`
- [ ] `ApiErrors.upstreamError()` returns NextResponse with status 502
- [ ] `tsc --noEmit` passes

---

## Step 2: Create shared Cody Zod schemas

**Time estimate**: 10 minutes

**Files to Touch**:
- `src/lib/cody/schemas.ts` (NEW)

**Exact Behavior**:
Create a module exporting Zod schemas for all five route inputs:

```
taskIdSchema: z.string().regex(/^[0-9]{6}-[a-zA-Z0-9-]+$/, 'Invalid taskId format')
```

Schemas to export:
- `prsQuerySchema` — `z.object({ taskId: taskIdSchema }).strict()`
- `prFilesQuerySchema` — `z.object({ prNumber: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive()) }).strict()`
- `workflowsQuerySchema` — `z.object({ status: z.enum(['queued', 'in_progress', 'completed']).optional() }).strict()`
- `pipelineParamsSchema` — `z.object({ taskId: taskIdSchema }).strict()`

Note: `boards` route has no query params so no schema needed.

**Tests** (in `tests/unit/cody-api-routes.spec.ts`):
1. `prsQuerySchema rejects missing taskId` — FAILS before (module doesn't exist), PASSES after
2. `prsQuerySchema rejects invalid taskId format (e.g., 'invalid')` — FAILS before, PASSES after
3. `prFilesQuerySchema rejects non-numeric prNumber` — FAILS before, PASSES after
4. `prFilesQuerySchema rejects negative prNumber` — FAILS before, PASSES after
5. `workflowsQuerySchema rejects invalid status value` — FAILS before, PASSES after
6. `workflowsQuerySchema accepts missing status (optional)` — FAILS before, PASSES after

**Acceptance Criteria**:
- [ ] All schemas exported from `src/lib/cody/schemas.ts`
- [ ] `taskIdSchema` uses the same regex as `TASK_ID_REGEX` from constants (`/^[0-9]{6}-[a-zA-Z0-9-]+$/`)
- [ ] `prFilesQuerySchema` coerces string to positive integer
- [ ] `workflowsQuerySchema` allows `status` to be omitted
- [ ] All schema tests pass

---

## Step 3: Create shared GitHub error handler utility

**Time estimate**: 20 minutes

**Files to Touch**:
- `src/lib/cody/github-error-handler.ts` (NEW)

**Exact Behavior**:
Export a function:
```typescript
function handleCodyApiError(error: unknown, routeName: string): NextResponse<ApiErrorResponse>
```

Logic:
1. If `error` is a `ZodError` → return `apiValidationError(error)` (400)
2. If `error` is an object with `status` property (Octokit-style):
   - `status === 401` → return `apiError('UNAUTHORIZED', 'GitHub authentication failed', 502)` (mapped to 502 because it's an upstream auth issue, not our API's auth)
   - `status === 403` → check for rate limit headers; if rate-limited return `ApiErrors.rateLimited(retryAfter)` (429); otherwise return `apiError('FORBIDDEN', 'GitHub access denied', 403)`
   - `status === 404` → return `ApiErrors.notFound('Resource')`
   - `status === 429` → return `ApiErrors.rateLimited(retryAfter)` with `Retry-After` header if available
   - `status >= 500` → return `ApiErrors.upstreamError('GitHub service error')`
3. Otherwise → `ApiErrors.internal()`

Server-side logging:
- `console.error(`[Cody] ${routeName}:`, sanitized message)` — no stack traces, no tokens, no full error objects
- Extract safe message: `error instanceof Error ? error.message : 'Unknown error'`

Rate-limit header forwarding:
- If the error has `response.headers` with `x-ratelimit-remaining` or `retry-after`, extract the `Retry-After` value and include it as a response header on the 429 response.

Sanitization (NFR-001):
- Never include `error.stack`, raw response bodies, or request headers in the response
- Response message is always a fixed, generic string per status code category

**Tests** (in `tests/unit/cody-api-routes.spec.ts`):
1. `handleCodyApiError with ZodError returns 400 VALIDATION_ERROR` — FAILS before, PASSES after
2. `handleCodyApiError with { status: 401 } returns 502 UNAUTHORIZED` — FAILS before, PASSES after
3. `handleCodyApiError with { status: 403 } returns 403 FORBIDDEN` — FAILS before, PASSES after
4. `handleCodyApiError with { status: 403, response: { headers: { 'x-ratelimit-remaining': '0' } } } returns 429 RATE_LIMITED` — FAILS before, PASSES after
5. `handleCodyApiError with { status: 404 } returns 404 NOT_FOUND` — FAILS before, PASSES after
6. `handleCodyApiError with { status: 429, response: { headers: { 'retry-after': '60' } } } returns 429 with Retry-After header` — FAILS before, PASSES after
7. `handleCodyApiError with { status: 500 } returns 502 UPSTREAM_ERROR` — FAILS before, PASSES after
8. `handleCodyApiError with unknown Error returns 500 INTERNAL_ERROR` — FAILS before, PASSES after
9. `handleCodyApiError does NOT leak stack traces in response body` — FAILS before, PASSES after

**Acceptance Criteria**:
- [ ] Function accepts `unknown` error and returns `NextResponse<ApiErrorResponse>`
- [ ] ZodError detected and mapped to 400
- [ ] GitHub status codes 401/403/404/429/5xx mapped correctly
- [ ] Rate-limit `Retry-After` header forwarded when available
- [ ] No stack traces, raw error bodies, or tokens in response
- [ ] Server-side log includes route name and sanitized message
- [ ] All 9 tests pass

---

## Step 4: Refactor `prs/route.ts` — remove eslint-disable, add Zod, use shared error handler

**Time estimate**: 10 minutes

**Files to Touch**:
- `src/app/api/cody/prs/route.ts` (MODIFIED — full file, 41 lines)

**Exact Behavior**:
- Remove line 7: `/* eslint-disable @typescript-eslint/no-explicit-any */`
- Import `parseQueryParams` from `@/server/api/responses` and `prsQuerySchema` from `@/lib/cody/schemas`
- Import `handleCodyApiError` from `@/lib/cody/github-error-handler`
- Replace manual `taskId` extraction with:
  ```typescript
  const parsed = parseQueryParams(req, prsQuerySchema)
  if ('error' in parsed) return parsed.error
  const { taskId } = parsed.data
  ```
- Replace `catch (error: any) { ... }` with:
  ```typescript
  catch (error: unknown) {
    return handleCodyApiError(error, 'prs')
  }
  ```
- Success response shape unchanged: `{ pr }`

**Tests** (in `tests/unit/cody-api-routes.spec.ts`):
1. `GET /api/cody/prs without taskId returns 400 with VALIDATION_ERROR code` — FAILS before (currently returns plain `{ error: 'taskId required' }`), PASSES after (returns `{ error: { code: 'VALIDATION_ERROR', ... } }`)
2. `GET /api/cody/prs with invalid taskId format returns 400` — FAILS before (no format validation), PASSES after

**Acceptance Criteria**:
- [ ] No `eslint-disable` directive in file
- [ ] No `catch (error: any)` — uses `catch (error: unknown)`
- [ ] Missing `taskId` returns 400 with `{ error: { code: 'VALIDATION_ERROR', ... } }`
- [ ] Invalid `taskId` format (e.g., `'abc'`) returns 400
- [ ] Valid `taskId` (e.g., `'260221-test'`) passes validation and calls `findAssociatedPR`
- [ ] Success response shape `{ pr }` is unchanged
- [ ] `tsc --noEmit` passes
- [ ] `eslint` passes (no broad disables)

---

## Step 5: Refactor `prs/files/route.ts` — remove eslint-disable, add Zod, use shared error handler

**Time estimate**: 10 minutes

**Files to Touch**:
- `src/app/api/cody/prs/files/route.ts` (MODIFIED — full file, 40 lines)

**Exact Behavior**:
- Remove `/* eslint-disable @typescript-eslint/no-explicit-any */`
- Import `parseQueryParams` from `@/server/api/responses` and `prFilesQuerySchema` from `@/lib/cody/schemas`
- Import `handleCodyApiError` from `@/lib/cody/github-error-handler`
- Replace manual `prNumber` extraction with:
  ```typescript
  const parsed = parseQueryParams(req, prFilesQuerySchema)
  if ('error' in parsed) return parsed.error
  const { prNumber } = parsed.data  // Already a number via Zod transform
  ```
- Remove manual `parseInt(prNumber, 10)` — Zod schema handles coercion
- Replace `catch (error: any)` with `catch (error: unknown)` + `handleCodyApiError`
- Success response shape unchanged: `{ files }`

**Tests** (in `tests/unit/cody-api-routes.spec.ts`):
1. `GET /api/cody/prs/files without prNumber returns 400 VALIDATION_ERROR` — FAILS before (plain error), PASSES after
2. `GET /api/cody/prs/files with non-numeric prNumber returns 400` — FAILS before (parseInt returns NaN silently), PASSES after
3. `GET /api/cody/prs/files with prNumber=0 returns 400` — FAILS before (no validation), PASSES after

**Acceptance Criteria**:
- [ ] No `eslint-disable` directive in file
- [ ] No `catch (error: any)`
- [ ] `prNumber` validated as positive integer via Zod
- [ ] Non-numeric/negative/zero `prNumber` returns 400
- [ ] Success response shape `{ files }` is unchanged
- [ ] `tsc --noEmit` passes

---

## Step 6: Refactor `workflows/route.ts` — remove eslint-disable, add Zod, use shared error handler

**Time estimate**: 10 minutes

**Files to Touch**:
- `src/app/api/cody/workflows/route.ts` (MODIFIED — full file, 40 lines)

**Exact Behavior**:
- Remove `/* eslint-disable @typescript-eslint/no-explicit-any */`
- Remove unsafe cast `as 'queued' | 'in_progress' | 'completed' | null`
- Import `parseQueryParams` and `workflowsQuerySchema`
- Import `handleCodyApiError`
- Replace manual param extraction:
  ```typescript
  const parsed = parseQueryParams(req, workflowsQuerySchema)
  if ('error' in parsed) return parsed.error
  const { status } = parsed.data
  ```
- Replace `catch (error: any)` with `catch (error: unknown)` + `handleCodyApiError`
- Success response shape unchanged: `{ runs }`

**Tests** (in `tests/unit/cody-api-routes.spec.ts`):
1. `GET /api/cody/workflows with invalid status returns 400` — FAILS before (unsafe cast accepts anything), PASSES after
2. `GET /api/cody/workflows with no status succeeds (status is optional)` — PASSES before and after (regression test)

**Acceptance Criteria**:
- [ ] No `eslint-disable` directive
- [ ] No `catch (error: any)` or unsafe `as` casts
- [ ] Invalid `status` value (e.g., `'invalid'`) returns 400
- [ ] Missing `status` is accepted (optional field)
- [ ] Success response shape `{ runs }` is unchanged
- [ ] `tsc --noEmit` passes

---

## Step 7: Refactor `pipeline/[taskId]/route.ts` — remove eslint-disable, add Zod, use shared error handler

**Time estimate**: 10 minutes

**Files to Touch**:
- `src/app/api/cody/pipeline/[taskId]/route.ts` (MODIFIED — full file, 69 lines)

**Exact Behavior**:
- Remove `/* eslint-disable @typescript-eslint/no-explicit-any */`
- Import `handleCodyApiError` and `pipelineParamsSchema`
- Validate the `taskId` path parameter from `params`:
  ```typescript
  const { taskId: rawTaskId } = await params
  const parsed = pipelineParamsSchema.safeParse({ taskId: rawTaskId })
  if (!parsed.success) {
    return apiValidationError(parsed.error)
  }
  const { taskId } = parsed.data
  ```
- Replace `catch (error: any)` with `catch (error: unknown)` + `handleCodyApiError`
- Success response shape unchanged: `{ status, source }`

**Tests** (in `tests/unit/cody-api-routes.spec.ts`):
1. `GET /api/cody/pipeline/:taskId with invalid taskId returns 400` — FAILS before (no validation), PASSES after
2. `handleCodyApiError is used for GitHub errors in pipeline route` — verified via no `error: any` in source

**Acceptance Criteria**:
- [ ] No `eslint-disable` directive
- [ ] No `catch (error: any)`
- [ ] Invalid `taskId` format returns 400 with `VALIDATION_ERROR`
- [ ] Valid `taskId` proceeds to pipeline logic
- [ ] Success response shape `{ status, source }` unchanged
- [ ] `tsc --noEmit` passes

---

## Step 8: Refactor `boards/route.ts` — remove eslint-disable, remove mock fallback, document public access

**Time estimate**: 15 minutes

**Files to Touch**:
- `src/app/api/cody/boards/route.ts` (MODIFIED — full file, 51 lines)

**Exact Behavior**:
- Remove `/* eslint-disable @typescript-eslint/no-explicit-any */`
- Add explicit JSDoc comment documenting this as a public/unauthenticated endpoint:
  ```typescript
  /**
   * Public endpoint (no auth required) — returns board categories.
   * Intentionally unauthenticated to support dashboard loading without login.
   */
  ```
- Import `handleCodyApiError`
- Remove the mock data fallback in the catch block. Replace with:
  ```typescript
  catch (error: unknown) {
    return handleCodyApiError(error, 'boards')
  }
  ```
- No query params to validate (route takes no input)
- Success response shape unchanged: `{ boards }`

**Tests** (in `tests/unit/cody-api-routes.spec.ts`):
1. `boards route catch block does NOT return mock data` — FAILS before (returns mock boards), PASSES after (returns proper error)
2. `boards route has no eslint-disable directive` — FAILS before, PASSES after (static check)

**Acceptance Criteria**:
- [ ] No `eslint-disable` directive
- [ ] No `catch (error: any)`
- [ ] No mock data fallback on error — returns proper error response
- [ ] Public access explicitly documented in JSDoc
- [ ] Success response shape `{ boards }` unchanged
- [ ] `tsc --noEmit` passes

---

## Step 9: Write comprehensive test suite

**Time estimate**: 25 minutes

**Files to Touch**:
- `tests/unit/cody-api-routes.spec.ts` (NEW)

**Exact Behavior**:
Create a test file covering:

### Section A: Schema validation tests (Step 2)
- Test all schemas with valid and invalid inputs
- Test edge cases: missing fields, wrong types, extra keys (strict mode)

### Section B: GitHub error handler tests (Step 3)
- Test each error type mapping (ZodError, Octokit 401/403/404/429/5xx, unknown)
- Test rate-limit header forwarding
- Test sanitization (no stack traces in response)
- Test server-side logging (spy on console.error)

### Section C: ApiErrors extension tests (Step 1)
- Test `ApiErrors.rateLimited()` returns proper 429
- Test `ApiErrors.upstreamError()` returns proper 502

### Section D: Integration-style route behavior tests (Steps 4-8)
These test the handler functions by importing them directly, mocking dependencies (`requireAuth`, GitHub client functions), and calling with mock `NextRequest` objects.

For each route:
- Valid input → success response shape preserved
- Missing/invalid input → 400 with `{ error: { code: 'VALIDATION_ERROR' } }`
- GitHub 401 → 502 (upstream auth failure)
- GitHub 403 with rate limit → 429
- GitHub 500 → 502 (upstream error)
- Unknown error → 500 (internal error)

**Test count**: ~25-30 test cases total

**Acceptance Criteria**:
- [ ] All schema validation tests pass
- [ ] All error handler mapping tests pass
- [ ] All route-level integration tests pass
- [ ] No tests use `any` type
- [ ] Tests verify error response format matches `{ error: { code, message } }`
- [ ] `vitest run tests/unit/cody-api-routes.spec.ts` passes

---

## Step 10: Final quality gate verification

**Time estimate**: 5 minutes

**Files to Touch**: None (verification only)

**Exact Behavior**:
Run quality checks:
1. `pnpm tsc --noEmit` — must pass with no errors
2. `pnpm lint` — must pass; verify no file-level `eslint-disable` remains in the five route files
3. `pnpm vitest run tests/unit/cody-api-routes.spec.ts` — all tests pass
4. Grep all five route files for `error: any` — must find zero matches
5. Grep all five route files for `eslint-disable` — must find zero matches

**Acceptance Criteria**:
- [ ] `tsc --noEmit` passes
- [ ] `lint` passes
- [ ] All tests pass
- [ ] Zero `catch (error: any)` in any of the five routes
- [ ] Zero `/* eslint-disable @typescript-eslint/no-explicit-any */` in any of the five routes
- [ ] Success response shapes preserved (no breaking changes)

---

## Dependency Graph

```
Step 1 (extend ApiErrorCode)
    ↓
Step 2 (create schemas)    Step 3 (create error handler) — depends on Step 1
    ↓                          ↓
Step 4 (prs route)         ← depends on Steps 2 + 3
Step 5 (prs/files route)   ← depends on Steps 2 + 3
Step 6 (workflows route)   ← depends on Steps 2 + 3
Step 7 (pipeline route)    ← depends on Steps 2 + 3
Step 8 (boards route)      ← depends on Step 3
    ↓
Step 9 (tests)             ← depends on Steps 1-8
    ↓
Step 10 (quality gates)    ← depends on Step 9
```

Steps 4-8 can be done in parallel. Steps 2 and 3 can be done in parallel after Step 1.

---

## Spec Coverage Matrix

| Requirement | Steps |
|-------------|-------|
| FR-001 (Zod validation) | 2, 4, 5, 6, 7 |
| FR-002 (type-safe error handling) | 3, 4, 5, 6, 7, 8 |
| FR-003 (remove eslint-disable) | 4, 5, 6, 7, 8 |
| FR-004 (shared error handler) | 3 |
| FR-005 (consistent error contract) | 1, 3 |
| FR-006 (preserve success payloads) | 4, 5, 6, 7, 8 |
| FR-007 (status code mapping) | 3, 8 |
| FR-008 (evaluate existing utility) | 1, 3 (extend existing `src/server/api/responses.ts`) |
| NFR-001 (no leakage) | 3, 9 |
| NFR-002 (sanitized logging) | 3 |
| NFR-003 (quality gates) | 10 |
| NFR-004 (tests) | 9 |
