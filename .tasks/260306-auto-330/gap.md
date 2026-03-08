# Gap Analysis: 260306-auto-330

## Summary

- Gaps Found: 6
- Spec Revised: Yes

## Gaps Found

### Gap 1: Existing Error Response Utility Overlooked

**Severity:** High
**Location:** All five route files and new utility location
**Issue:** The codebase already has a comprehensive error response utility at `src/server/api/responses.ts` with standardized error codes, `apiError()`, `apiValidationError()`, and `parseAndValidate()`/`parseQueryParams()` helpers. The spec doesn't mention leveraging this existing utility.
**Fix Applied:** Added note in Open Question #7 and updated FR-004 to recommend using or extending `src/server/api/responses.ts` rather than creating a new standalone utility.

### Gap 2: Response Format Inconsistency Not Addressed

**Severity:** High
**Location:** Error response contracts in spec
**Issue:** The existing five routes return `{ error: "string" }` format. The spec proposes `{ success: false, message, code }` format. The existing `src/server/api/responses.ts` utility uses `{ error: { code, message, details } }` format. The spec doesn't address this inconsistency.
**Fix Applied:** Updated FR-005 to explicitly address response format choice and added Open Question #8 about backwards compatibility with existing format vs. using existing utility format.

### Gap 3: Boards Route Has No Auth and Returns Mock Data on Error

**Severity:** Critical
**Location:** `src/app/api/cody/boards/route.ts`
**Issue:** The boards route:
1. Has NO authentication check (publicly accessible - line 14-15 comments confirm this is intentional for testing)
2. Returns mock data on ALL errors (line 40-49) - this is a security anti-pattern that hides real errors

The spec mentions mapping 401/403 errors, but this route doesn't even check auth.
**Fix Applied:** Added explicit requirement in FR-007 to handle boards route separately - it should either add auth or explicitly document its public nature, and should NOT return mock data in production.

### Gap 4: prs/status Route Already Uses `error: unknown`

**Severity:** Medium
**Location:** `src/app/api/cody/prs/status/route.ts` (not in original five but related)
**Issue:** The spec assumes all five routes use `catch (error: any)`. However, `prs/status/route.ts` (line 26-27) already uses `catch (error: unknown)` with proper narrowing. This is inconsistent with the other five routes and shows the pattern already exists in the codebase.
**Fix Applied:** Added reference to this existing pattern in FR-002 as an example to follow.

### Gap 5: No Validation Bounds Specified

**Severity:** Medium
**Location:** FR-001 validation requirements
**Issue:** FR-001 mentions "basic bounds (e.g., non-empty strings; maximum lengths; numeric ranges if pagination is supported)" but doesn't specify actual bounds. Looking at the routes:
- `taskId`: Should validate format (e.g., TASK_ID_REGEX pattern like `260221-test`)
- `prNumber`: Should be positive integer
- `status` (workflows): Should validate against allowed values ('queued' | 'in_progress' | 'completed')
- `taskId` (pipeline): Should validate format

**Fix Applied:** Added specific validation bounds to FR-001 acceptance criteria.

### Gap 6: GitHub Error Structure Not Documented

**Severity:** Low
**Location:** FR-004 shared error handler
**Issue:** The spec mentions GitHub/Octokit errors but doesn't specify the actual error structure. From the code patterns (e.g., `error.status === 401`), errors have a `status` property. Octokit errors may also expose `response` object with headers.
**Fix Applied:** Added description of GitHub error structure to FR-004 requirements.

## Changes Made to Spec

### Added FR-008: Evaluate Existing Utility

Added a new requirement:
> **FR-008: Evaluate Existing Error Response Utility**
> 
> Priority: SHOULD
> Description: Before creating a new shared utility, evaluate extending `src/server/api/responses.ts` which already provides:
> - Standardized error codes (VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, INTERNAL_ERROR)
> - `apiError()`, `apiValidationError()` functions
> - `parseAndValidate()` and `parseQueryParams()` helpers
> 
> If the existing utility's `{ error: { code, message, details } }` format is acceptable, use it directly. Otherwise, create a new utility with the spec's proposed format.

### Updated FR-001: Added Specific Validation Bounds

Added more specific validation requirements:
- `taskId`: Must match TASK_ID_REGEX pattern (e.g., `260221-test` format)
- `prNumber`: Must be a positive integer
- `status` (workflows): Must be one of 'queued' | 'in_progress' | 'completed'
- `taskId` (pipeline): Must be non-empty string

### Updated FR-004: Added GitHub Error Structure

Added:
> The utility SHOULD detect GitHub/Octokit error structure which typically includes:
> - `status`: HTTP status code
> - `response.headers`: May contain rate limit info (X-RateLimit-Remaining, Retry-After)

### Updated FR-005: Clarified Format Options

Updated to clarify:
> Error responses MUST follow a consistent JSON shape. Options:
> 1. Use existing `src/server/api/responses.ts` format: `{ error: { code, message, details? } }`
> 2. Use new format: `{ success: false, message, code, details? }`
> 
> Either format is acceptable if applied consistently across all five routes.

### Updated FR-007: Special Case for Boards Route

Added explicit handling:
> Note: `src/app/api/cody/boards/route.ts` currently has no authentication check and returns mock data on error. This route requires special handling:
> - Either add auth check or explicitly document it as a public endpoint
> - Remove mock data fallback in production; return proper errors instead

### Added Open Questions #7 and #8

- **Open Question #7**: Should the shared utility extend `src/server/api/responses.ts` or be a new module?
- **Open Question #8**: What error response format should be used? (Existing routes use `{ error: string }`, existing utility uses `{ error: { code, message } }`, spec proposes `{ success: false, message, code }`)

### Updated Acceptance Criteria

Added more specific validation bounds:
- [ ] Zod schemas include specific bounds (taskId format, prNumber positive integer, status enum validation)
- [ ] Boards route either has auth or is explicitly documented as public

## Notes for Implementation

1. The existing utility at `src/server/api/responses.ts` should be evaluated first - it provides most of what FR-004/FR-005 require
2. The boards route is a special case that needs different handling than others
3. The `prs/status/route.ts` file (not in scope) already demonstrates proper `error: unknown` handling - it could serve as a reference
4. There's also existing validation utilities in `src/infra/utils/validation/` that could be reused
