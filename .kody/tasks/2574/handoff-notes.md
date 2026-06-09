## Fix Summary

**Issue**: Admin dashboard widgets permanently stuck on "Loading..." (issue #2574)

**Root Cause**: `MetricsProvider.tsx` fetch had no timeout. If the request to `/api/admin/dashboard-metrics` hung indefinitely, `loading` stayed `true` forever and all widgets remained on their loading state.

**Fix**: Added `AbortController` with a 15-second timeout to the `fetchMetrics` function in `MetricsProvider.tsx`. If the fetch doesn't complete within 15 seconds, the request is aborted and an error is set, which causes widgets to show their error state instead of being permanently stuck on loading.

**Files Changed**:
- `src/ui/admin/ConversionTracking/MetricsProvider.tsx` — added `AbortController` + `setTimeout(abort, 15000)` + `clearTimeout` around the fetch
- `tests/unit/admin/metrics-provider-timeout.test.ts` — new unit tests verifying the timeout behavior (passes, 3 tests)

**Test Coverage**: 3 unit tests for the timeout pattern (AbortSignal passing, setTimeout with 15s, clearTimeout on success)

**Verification**: `mcp__kody-verify__verify` → all gates green (typecheck, lint, tests)
