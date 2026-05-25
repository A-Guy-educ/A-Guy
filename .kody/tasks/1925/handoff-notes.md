# Fix #1925: Recent Transactions widget HTTP 404

## What was wrong

`RecentTransactionsWidget` made a client-side fetch to `/api/collections/transactions?limit=5&sort=-createdAt&depth=2` which returned HTTP 404. Payload CMS does not expose collections under the `/api/collections/` path — the correct REST API path is `/api/transactions`.

All other admin dashboard widgets (`RevenueWidget`, `TopProductsWidget`, `CourseEnrollmentsWidget`, etc.) fetch their data from `/api/admin/dashboard-metrics` via the shared `useMetricsContext` hook, which is the correct pattern.

## What changed

1. **`src/app/api/admin/dashboard-metrics/route.ts`** — Added `recentTransactions` field to `DashboardMetricsResponse` (type: `RecentTransaction[]`) and a `payload.find({ collection: 'transactions', limit: 5, sort: '-createdAt', depth: 2 })` query in the `Promise.all` array. Mapped results to the `RecentTransaction` shape in the response object.

2. **`src/ui/admin/RecentTransactionsWidget/index.tsx`** — Replaced the self-contained `useCallback`/`useState`/`useEffect` fetch pattern with `useMetricsContext()`. Now consumes `data.recentTransactions` instead of making a separate HTTP request. Removed unused `TransactionsResponse` interface and `useCallback`/`useState`/`useEffect` imports.

3. **`tests/int/admin-dashboard-recent-transactions-1925.int.spec.ts`** — New integration test that verifies `recentTransactions` is returned by the metrics endpoint (shape, max 5 items, sorted descending, correct fields).

## No regressions

The existing `admin-dashboard-metrics.int.spec.ts` and `admin-dashboard-revenue-metrics-1641.int.spec.ts` tests continue to pass. TypeScript, lint, and format all clean.
