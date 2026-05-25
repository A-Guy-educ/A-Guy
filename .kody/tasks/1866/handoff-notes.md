## Task 1866: Admin Dashboard Widgets Stuck in Loading State

### What I Did

**Root Cause**: The `MetricsProvider` component's `fetchMetrics()` function had no timeout mechanism. When the `/api/admin/dashboard-metrics` endpoint was slow to respond (e.g., during cold start or first-request seed process taking ~125s), the fetch would hang indefinitely. Since the `catch` block only handled fetch errors, a hanging fetch kept `loading=true` and `error=null`, causing all 7 dashboard widgets to display "Loading..." forever.

**Fix**: Added a 30-second AbortController-based timeout to `MetricsProvider.tsx`:
- `setTimeout(() => controller.abort(), 30_000)` fires after 30s
- `controller.abort()` causes the fetch to throw an `AbortError`
- The `catch` block now detects `err.name === 'AbortError'` and calls `setError('timeout')`
- All widgets transition from "Loading..." to error state, showing a user-friendly message

**Files Changed**:
- `src/ui/admin/ConversionTracking/MetricsProvider.tsx` — added AbortController + setTimeout + AbortError handling
- `tests/unit/ui/admin/metrics-provider.spec.ts` — new test file verifying timeout behavior

### Key Decision
`AbortSignal.timeout()` (static method) doesn't exist in the project's TypeScript lib definitions, so I used the `setTimeout + controller.abort()` pattern instead of `controller.signal.timeout = ms`.
