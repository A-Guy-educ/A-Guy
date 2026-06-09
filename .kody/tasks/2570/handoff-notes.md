# Fix: Admin dashboard widget cards permanently stuck on Loading (#2570)

## What was wrong

`MetricsProvider` (which provides data to RevenueWidget, TopProductsWidget, CourseEnrollmentsWidget, UserMetricsWidget, ContentCountsWidget, EngagementWidget) and `RecentTransactionsWidget` (which fetches separately) had no timeout on their fetch calls. If either API endpoint hung indefinitely, `loading` stayed `true` forever and every widget rendered its static "Loading..." string indefinitely.

## Root cause

`fetchMetrics` in `MetricsProvider.tsx` and `fetchTransactions` in `RecentTransactionsWidget/index.tsx` used plain `fetch()` with no abort mechanism. There was no timeout, no signal, and no way to bail out if the request hung.

## Fix applied

Added `AbortController` with a 30-second timeout to both fetch functions:

- `MetricsProvider.tsx`: Wrapped `fetchMetrics` with `controller.abort()` after 30s; `signal: controller.signal` passed to `fetch`; `clearTimeout(timeoutId)` on all exit paths (success, catch, finally); `AbortError` caught separately and set as `error='timeout'`.
- `RecentTransactionsWidget/index.tsx`: Same pattern applied to `fetchTransactions`.

This is identical to the fix that was previously applied on a non-merged branch (9a99e990e from task #2532).

## Files changed

- `src/ui/admin/ConversionTracking/MetricsProvider.tsx` — fetch timeout in `fetchMetrics`
- `src/ui/admin/RecentTransactionsWidget/index.tsx` — fetch timeout in `fetchTransactions`
- `tests/unit/ui/admin/metrics-provider-timeout.spec.ts` — 14 unit tests verifying timeout mechanism

## Tests

Unit tests pass (`pnpm exec vitest run tests/unit/ui/admin/metrics-provider-timeout.spec.ts --config ./vitest.config.unit.mts`). All 14 tests verify AbortController presence, timeout abort, signal passing, and clearTimeout on all paths.
