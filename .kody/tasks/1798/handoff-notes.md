# Stats Page No Data - Fix Summary

## What was fixed

**File:** `src/app/(frontend)/stats/_components/StatsDashboard.tsx`

The `fetchData` function had a bug where non-OK API responses (e.g., 401 Unauthorized) were silently ignored. When the `/api/stats/dashboard` endpoint returned an error status, the component would:
1. Skip setting `data` (stayed `null`)
2. Still set `loading = false` (via finally block)
3. Render the error div with `t('errorLoading')` — which may appear as "no data" to users

**Fix applied:**
- Added `error` state (`useState<string | null>(null)`)
- Added explicit `else` branch when `response.ok` is false — sets error message with HTTP status and response body text
- Added catch branch now sets `data = null` explicitly (was missing before)
- Added `setError(null)` at the start of each fetch
- Updated render to show the `error` string when present (with `text-destructive` styling), falling back to `t('errorLoading')` only when error is null

## Potential root cause (not fully verified)

The QA account may have triggered a 401 from the stats API. Possible causes:
1. The `credentials: 'include'` fetch may not be sending auth cookies the same way `getMeUser` (server-side) does with explicit `Authorization: JWT <token>` header
2. The `payload.auth` call in the stats API route may not be correctly reading auth from the browser-sent cookies

The fix surfaces the actual error message (e.g., "Failed to load statistics (401)") so future debugging is easier.

## Verification

- TypeScript: passes
- ESLint: passes (warnings only, pre-existing)
- Prettier: passes
- Quality gates: green

## Notes

- Could not run integration tests — MongoDB Atlas cluster unreachable from this environment
- The root cause of why the API might return 401 (when user is logged in) was not fully determined
- The stats API uses `payload.auth({ headers: req.headers })` same pattern as other working API routes