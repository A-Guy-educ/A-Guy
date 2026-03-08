# Spec: 260306-auto-330

## Overview

Refactor and harden five Cody dashboard Next.js API routes by removing blanket `eslint-disable` usage and `any`-typed error handling, adding structured request input validation (Zod), and standardizing/sanitizing GitHub API error handling via a shared utility.

## Requirements

### FR-001: Add request input validation to all five routes

**Priority**: MUST
**Description**: Each of the following routes MUST validate all externally supplied inputs (query string, path params, and any request body if present) using Zod schemas before use:

- `src/app/api/cody/prs/route.ts`
- `src/app/api/cody/prs/files/route.ts`
- `src/app/api/cody/workflows/route.ts`
- `src/app/api/cody/pipeline/[taskId]/route.ts`
- `src/app/api/cody/boards/route.ts`

Validation MUST:
- Fail fast with a 400 response when inputs are missing/invalid.
- Apply specific bounds:
  - `taskId` (prs, pipeline routes): Must match TASK_ID_REGEX pattern (e.g., `260221-test` format)
  - `prNumber` (prs/files): Must be a positive integer
  - `status` (workflows): Must be one of 'queued' | 'in_progress' | 'completed'
  - `taskId` (pipeline): Must be non-empty string
- Treat `null`/missing values from `URLSearchParams.get()` as invalid unless explicitly optional.
- Prefer `.strict()` object schemas so unexpected keys are rejected (unless backwards compatibility requires permitting unknown keys).

### FR-002: Replace unsafe error handling with type-safe narrowing

**Priority**: MUST
**Description**: All route handlers MUST use `catch (error: unknown)` and narrow errors safely (no direct property access on unknown values without guards). `catch (error: any)` MUST be removed.

Example of safe narrowing (from existing codebase at `src/app/api/cody/prs/status/route.ts`):
```typescript
catch (error: unknown) {
  const msg = error instanceof Error ? error.message : String(error)
  console.error('[Cody] Error:', msg)
  return NextResponse.json({ error: 'Internal error' }, { status: 500 })
}
```

### FR-003: Remove blanket file-level eslint disables

**Priority**: MUST
**Description**: The file-level directive `/* eslint-disable @typescript-eslint/no-explicit-any */` MUST be removed from all five route files. If any narrow, unavoidable type escape is required, it MUST be localized and justified (e.g., via a narrow `as` cast in a single expression) rather than disabling lint for the entire file.

### FR-004: Shared GitHub API error handler utility

**Priority**: MUST
**Description**: Implement a shared utility used by all five routes to translate GitHub/Octokit (and other upstream) errors into consistent, client-safe HTTP responses.

The utility MUST:
- Accept `unknown` errors and return a standardized `NextResponse` JSON payload.
- Detect and handle Zod validation errors (400).
- Detect and handle GitHub/Octokit-like errors which typically expose:
  - `status`: HTTP status code
  - `response.headers`: May contain rate limit info (X-RateLimit-Remaining, Retry-After)
- Sanitize responses so internal details are not leaked (no stack traces; no raw upstream response bodies).

The utility SHOULD:
- Provide a stable, documented mapping for common status codes (401/403/404/429/5xx).
- Optionally include a correlation/request identifier in responses for support/debugging (without exposing secrets).

### FR-005: Consistent error response contract across endpoints

**Priority**: MUST
**Description**: Error responses across all five endpoints MUST follow a consistent JSON shape.

Minimum required fields:
- A boolean success/ok flag (e.g., `success: false` or `ok: false`)
- A client-safe `message` or `error` string
- A machine-readable error `code` (e.g., `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `RATE_LIMITED`, `UPSTREAM_ERROR`, `INTERNAL_ERROR`)

For validation errors, the response SHOULD include structured `details` describing which parameters are invalid.

### FR-006: Preserve existing success payloads (avoid breaking consumers)

**Priority**: SHOULD
**Description**: The refactor SHOULD avoid changing the success response payload shape used by existing consumers. If the project standard is to wrap responses (e.g., `{ success: true, data: ... }`), apply it only if confirmed safe for existing clients, or provide a backwards-compatible transition (e.g., keep top-level fields while adding `success`).

### FR-007: GitHub status code handling policy

**Priority**: MUST
**Description**: The shared error handler MUST map GitHub/upstream errors to appropriate HTTP status codes and safe messages. At minimum:

- 400 for validation failures
- 401 for missing/invalid authentication to this API (if routes are protected)
- 403 for authenticated-but-forbidden access (or 404 if the privacy posture is to avoid resource enumeration)
- 404 when the requested resource should be treated as non-existent to the caller
- 429 when GitHub rate limiting / secondary rate limiting occurs (include `Retry-After` when available)
- 5xx upstream failures mapped to 502/503 as appropriate
- 500 for unexpected internal errors

**Special Case - boards route**: `src/app/api/cody/boards/route.ts` currently has no authentication and returns mock data on ALL errors. This route requires separate handling:
- Either add authentication check or explicitly document it as a public endpoint
- Remove mock data fallback in production; return proper errors instead

### FR-008: Evaluate Existing Error Response Utility

**Priority**: SHOULD
**Description**: Before creating a new shared utility, evaluate extending or using the existing error response utilities in the codebase:

The codebase already provides at `src/server/api/responses.ts`:
- Standardized error codes (VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, RATE_LIMITED, INTERNAL_ERROR, SERVICE_UNAVAILABLE)
- `apiError()`, `apiValidationError()` functions
- `parseAndValidate()` and `parseQueryParams()` helpers for Zod validation

If the existing utility's response format `{ error: { code, message, details? } }` is acceptable, use or extend it directly. Otherwise, create a new utility with the format specified in FR-005.

### NFR-001: Security—no internal error leakage

**Priority**: MUST
**Description**: Responses MUST NOT include stack traces, internal hostnames, raw upstream error bodies, request headers, tokens, or other sensitive implementation details.

### NFR-002: Observability—sanitized server-side logging

**Priority**: SHOULD
**Description**: Unexpected errors SHOULD be logged server-side with sanitized, minimal context (route name, mapped status, and safe upstream identifiers such as GitHub request IDs) without logging credentials or full upstream payloads.

### NFR-003: Code quality gates

**Priority**: MUST
**Description**: The refactor MUST keep TypeScript and lint rules satisfied without relying on broad disables. (Implementation phase should ensure `tsc --noEmit` and lint pass.)

### NFR-004: Testability / regression protection

**Priority**: SHOULD
**Description**: Add or update tests (unit and/or integration) to cover:
- Zod validation failures (400 + details)
- GitHub error mappings for 401/403/404/429/5xx
- Unknown/unexpected errors mapped to sanitized 500

## Acceptance Criteria

- [ ] All five routes use Zod schemas to validate their externally supplied inputs before use.
- [ ] Invalid/missing required parameters return HTTP 400 with a consistent, client-safe error payload.
- [ ] Zod schemas include specific bounds (taskId format validation via TASK_ID_REGEX, prNumber positive integer, status enum validation).
- [ ] No route file contains `/* eslint-disable @typescript-eslint/no-explicit-any */`.
- [ ] No route uses `catch (error: any)`; errors are caught as `unknown` and narrowed safely.
- [ ] A shared GitHub API error handler utility exists and is used by all five routes.
- [ ] GitHub/Octokit errors are mapped to consistent HTTP status codes and safe messages (including 429 handling where applicable).
- [ ] Error responses do not leak stack traces or raw upstream error details.
- [ ] Success response payloads are either unchanged or confirmed backwards-compatible with existing consumers.
- [ ] Tests exist/are updated to cover validation and error mapping behavior (at least one test per major error class).
- [ ] Boards route either has auth or is explicitly documented as public (currently returns mock data on error - must be fixed).

## Guardrails

- Do NOT add new API features or endpoints; this is a refactor/hardening pass only.
- Do NOT change business logic of GitHub queries beyond what is necessary to validate inputs and handle errors safely.
- Do NOT introduce broad lint/TS relaxations (no file-level `eslint-disable` for `no-explicit-any`).
- Do NOT return raw upstream GitHub error payloads to clients.
- Keep changes scoped to the five routes plus the new shared utility (and tests/docs if added).

## Out of Scope

- Redesigning authentication/authorization for Cody routes (unless required to correctly return 401/403/404).
- Implementing new rate-limiting infrastructure beyond propagating/mapping upstream 429 and (optionally) adding headers.
- Changing GitHub integration architecture (token acquisition, installation selection, etc.).
- Broad API response schema redesign across the entire codebase beyond these five routes.

## Open Questions

1. **Shared utility location**: Should the GitHub error handler live under `src/lib/github/…`, `src/lib/cody/…`, or another established utilities location?
2. **Schema placement**: Should each route define its Zod schema inline for clarity, or should shared schemas live alongside the shared utility for reuse/testing?
3. **Error privacy posture**: For GitHub access issues, should responses prefer 403 vs 404 to reduce resource enumeration risk?
4. **Existing API contract**: What is the current success and error response shape expected by the Cody dashboard client(s)? Can we safely standardize without breaking consumers?
5. **Special GitHub statuses**: Are there GitHub/Octokit error codes beyond 401/403/404/429 (e.g., secondary rate limit) that require special handling in this app?
6. **Auth requirements**: Are all five routes expected to require authentication (via Payload auth), or are any intended to be public?
7. **Existing utility**: Should the shared utility extend `src/server/api/responses.ts` or be a new module? What response format should be used?
8. **Error response format**: The existing five routes use `{ error: "string" }`, the existing utility at `src/server/api/responses.ts` uses `{ error: { code, message, details? } }`, and this spec proposes `{ success: false, message, code, details? }`. Which format should be used?

## Domain Expert Notes (pre-validation)

- **Security auditor feedback (conceptual, no code access)**: Emphasize strict Zod validation with bounds, consistent sanitized error schema, careful mapping for 401/403/404/429/5xx, and avoid logging sensitive headers/tokens.
- **Cody/pipeline expert feedback (conceptual, no code access)**: Use a consistent route handler pattern (validate → auth → execute → shared error handler), place shared utility in a `src/lib/github/`-style module, and prioritize non-breaking success payloads while standardizing errors.
