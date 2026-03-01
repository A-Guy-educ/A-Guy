# Task

## Issue Title

Add missing error handling in user-settings and teacher-profiles API routes
## Bug

Two API routes lack top-level try/catch blocks. Any unexpected error (DB timeout, malformed headers) produces an unhandled exception with a raw 500 page instead of structured JSON.

### `src/app/api/user-settings/route.ts`
- GET handler (lines 20-68): No try/catch
- PATCH handler (line 71): Has inner try/catch for JSON parsing but auth call and DB queries are unprotected

### `src/app/api/teacher-profiles/route.ts`
- GET handler (lines 12-42): No try/catch at all

Both routes also lack error logging, unlike peers (e.g., `conversations/by-context` uses `logger.error`).

## Expected

Both routes should:
1. Wrap handler bodies in try/catch
2. Return structured `{ error: "..." }` JSON on failure (status 500)
3. Log errors using the existing logger infrastructure

## Fix

- `src/app/api/user-settings/route.ts` — Wrap GET and PATCH in try/catch with JSON error response and logging
- `src/app/api/teacher-profiles/route.ts` — Wrap GET in try/catch with JSON error response and logging
- Import and use logger from `@/infra/utils/logger/logger`

/cody add try/catch error handling to src/app/api/user-settings/route.ts and src/app/api/teacher-profiles/route.ts: wrap all handlers in try/catch with structured JSON error responses and error logging
