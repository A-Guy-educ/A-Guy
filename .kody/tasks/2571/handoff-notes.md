# Fix: Admin chat page stuck on Loading (#2571)

## What was fixed

The admin chat page at `/admin/chat` was stuck on "Loading..." forever because the `useCurrentUser` hook's `fetchUser` function made a fetch request to `/api/users/me` with no timeout. If that request hangs indefinitely, `isLoading` stays `true` forever.

## Root cause

`src/client/hooks/useCurrentUser.ts` - the `fetchUser` function had no timeout mechanism. This is the same pattern bug as #2570 (dashboard widgets) and #1822 (study plan page).

## How it was fixed

Added a 30-second timeout using `AbortController` following the exact pattern from `RecentTransactionsWidget`:

1. Created `AbortController` before the fetch
2. Set a 30s timeout that calls `controller.abort()`
3. Passed `signal: controller.signal` to the fetch call
4. Called `clearTimeout(timeoutId)` on success and in all error paths
5. Handled `AbortError` as a distinct "timeout" error type

## Files changed

- `src/client/hooks/useCurrentUser.ts` - added timeout pattern
- `tests/unit/client/hooks/useCurrentUser-timeout.spec.ts` - added test verifying timeout pattern

## Pattern to follow

When adding fetch calls in hooks or components that affect loading states, always add a timeout using `AbortController` + `setTimeout` + `controller.abort()` to prevent permanent loading states.
