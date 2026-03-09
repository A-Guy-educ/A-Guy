# Build Agent Report: 260306-auto-330

## Changes

### Files Modified

1. **`src/server/api/responses.ts`** - Extended `ApiErrorCode` type with `RATE_LIMITED` and `UPSTREAM_ERROR` codes, added `rateLimited()` and `upstreamError()` factory methods to `ApiErrors` object

2. **`src/app/api/cody/prs/route.ts`** - Removed `eslint-disable`, added Zod validation via `parseQueryParams` and `prsQuerySchema`, replaced `catch (error: any)` with `catch (error: unknown)` and `handleCodyApiError`

3. **`src/app/api/cody/prs/files/route.ts`** - Removed `eslint-disable`, added Zod validation via `parseQueryParams` and `prFilesQuerySchema` (with string-to-number coercion), replaced `catch (error: any)` with `handleCodyApiError`

4. **`src/app/api/cody/workflows/route.ts`** - Removed `eslint-disable`, added Zod validation with `workflowsQuerySchema` (optional status enum), removed unsafe `as` cast, replaced `catch (error: any)` with `handleCodyApiError`

5. **`src/app/api/cody/pipeline/[taskId]/route.ts`** - Removed `eslint-disable`, added Zod validation for path parameter via `pipelineParamsSchema`, replaced `catch (error: any)` with `handleCodyApiError`

6. **`src/app/api/cody/boards/route.ts`** - Removed `eslint-disable`, added JSDoc documenting public access, removed mock data fallback on error, replaced `catch (error: any)` with `handleCodyApiError`

### Files Created

1. **`src/lib/cody/schemas.ts`** - Shared Zod schemas:
   - `taskIdSchema` - validates YYMMDD-description format
   - `prsQuerySchema` - validates taskId query param
   - `prFilesQuerySchema` - validates prNumber as positive integer
   - `workflowsQuerySchema` - validates optional status enum
   - `pipelineParamsSchema` - validates taskId path param

2. **`src/lib/cody/github-error-handler.ts`** - Shared error handler that:
   - Handles ZodError → 400 VALIDATION_ERROR
   - Handles 401 → 502 UNAUTHORIZED
   - Handles 403 → 403 FORBIDDEN (or 429 if rate-limited)
   - Handles 404 → 404 NOT_FOUND
   - Handles 429 → 429 RATE_LIMITED
   - Handles 5xx → 502 UPSTREAM_ERROR
   - Handles unknown → 500 INTERNAL_ERROR
   - Forwards `Retry-After` headers
   - Sanitizes logs (no stack traces)

3. **`tests/unit/cody-api-routes.spec.ts`** - 36 tests covering:
   - All schema validation scenarios
   - ApiErrors extension (rateLimited, upstreamError)
   - GitHub error handler mappings (all status codes)
   - Sanitization (no stack traces in responses)
   - Logging verification

## Tests Written

- `tests/unit/cody-api-routes.spec.ts` - 36 tests for schema validation, error handler, and API responses

## Quality

- TypeScript: PASS
- Lint: PASS
- Tests: 3075 passed (36 new tests)

## Acceptance Criteria Verified

- [x] All five routes use Zod schemas to validate externally supplied inputs
- [x] Invalid/missing required parameters return HTTP 400 with consistent error payload
- [x] Zod schemas include specific bounds (taskId regex, prNumber positive integer, status enum)
- [x] No route file contains `/* eslint-disable @typescript-eslint/no-explicit-any */`
- [x] No route uses `catch (error: any)`; errors are caught as `unknown` and narrowed safely
- [x] Shared GitHub error handler utility exists and is used by all five routes
- [x] GitHub/Octokit errors mapped to consistent HTTP status codes and safe messages
- [x] Error responses do not leak stack traces or raw upstream error details
- [x] Success response payloads preserved (unchanged)
- [x] Tests exist to cover validation and error mapping behavior
- [x] Boards route has explicit JSDoc documentation for public access
- [x] Boards route no longer returns mock data on error
