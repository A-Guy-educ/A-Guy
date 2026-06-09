## Issue #2546: Dashboard widgets show Loading for many seconds

### What was done

**Root cause:** `MetricsProvider.fetchMetrics` (`src/ui/admin/ConversionTracking/MetricsProvider.tsx`) called `fetch` with no timeout. If the `/api/admin/dashboard-metrics` endpoint was slow, `loading` stayed `true` indefinitely with no user feedback.

**Fix:** Added `AbortController` with a 10-second timeout — the same pattern already used in `InlineExerciseEditor.tsx` (issue #1822).

### Files changed

- `src/ui/admin/ConversionTracking/MetricsProvider.tsx` — added `AbortController` + `setTimeout(abort, 10_000)` to the fetch call; handles `AbortError` in catch block with a user-friendly message
- `tests/unit/admin/metrics-provider-timeout.spec.tsx` — new unit test that mocks a hanging fetch, advances timers, and asserts the component transitions to error state

### Key design decision

The 10-second timeout was chosen to match the existing pattern in `InlineExerciseEditor.tsx`. The error message shown to users is "Request timed out. Please try again."
