# Fix: Study Plan page shows Loading indefinitely (#1822)

## What was done

Added an AbortController with a 15-second timeout to the `fetchPlan` function inside the `useStudyPlan` hook's useEffect. This prevents the fetch request from hanging indefinitely when the server doesn't respond.

## Files changed

1. `src/app/(frontend)/study-plan/_components/useStudyPlan.ts` - Added AbortController + 15s timeout to the fetch call, plus cleanup on unmount
2. `tests/int/study-plan-page-loading.int.spec.ts` - New integration test verifying the API returns `{ success: true, data: null }` when no plan exists

## Root cause

The `fetchPlan` function in `useStudyPlan` had no timeout mechanism. If the server didn't respond (e.g., database connection issue, network problem), the fetch would hang forever, `isLoading` would stay `true`, and the page would show "Loading..." indefinitely.

## Key changes in useStudyPlan.ts

- Added `AbortController` with `signal` passed to fetch
- Added 15-second timeout that calls `controller.abort()`
- Added cleanup: `return () => controller.abort()` to abort on unmount/effect re-run
- Catch block ignores `AbortError` silently (expected on timeout/unmount)
- `finally` block always sets `isLoading(false)` regardless of success/error/abort

## Verification

- All existing study-plan integration tests pass (5 tests in `study-plan-generation.int.spec.ts`)
- New test `study-plan-page-loading.int.spec.ts` passes (2 tests)
- `pnpm verify` passes (typecheck, lint, tests all green)