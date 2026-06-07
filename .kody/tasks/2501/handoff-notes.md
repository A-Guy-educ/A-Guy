## Task 2501: Admin dashboard widgets permanently stuck loading

### What was done

Added proper error handling to `src/app/api/admin/dashboard-metrics/route.ts`:

1. Wrapped `getPayload({ config })` in try-catch - returns 500 if initialization fails
2. Wrapped `payload.auth({ headers: req.headers })` in try-catch - returns 401 if auth throws
3. Wrapped the Promise.all (all database queries) in try-catch - returns 500 if queries fail

### Root cause hypothesis

The widgets were stuck in loading because the API route was crashing without returning a response when an async operation failed. Without error handling, any exception from `getPayload`, `payload.auth`, or the `Promise.all` would crash the route, causing the fetch to hang indefinitely.

### Files changed

- `src/app/api/admin/dashboard-metrics/route.ts` - Added try-catch blocks around getPayload, payload.auth, and Promise.all

### Why the fix works

By ensuring the route always returns a response (even a 500 error), the client fetch will always complete. When the fetch completes with an error, the MetricsProvider's catch block sets an error state, and the widgets show an error message instead of being stuck in loading.

### Open questions

- The underlying cause of what made getPayload/payload.auth/Promise.all fail was not identified. The error handling prevents crashes but doesn't fix the root cause.
- Consider investigating why the QA account's request caused a failure when E2E tests work correctly.
