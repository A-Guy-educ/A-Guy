# Fix for #1950: Recent Transactions widget HTTP 404

## What was done

The `RecentTransactionsWidget` was calling `/api/collections/transactions` directly via Payload REST API, which returned HTTP 404. Other dashboard widgets (RevenueWidget, TopProductsWidget) use a custom `/api/admin/dashboard-metrics` endpoint that uses Payload's local API instead.

**Fix approach**: Added `recentTransactions` field to the existing `/api/admin/dashboard-metrics` endpoint response and updated the widget to read from the shared `useMetricsContext()` instead of making its own API call.

## Files changed

1. **src/app/api/admin/dashboard-metrics/route.ts**
   - Added `RecentTransaction` interface
   - Added `recentTransactions` to `DashboardMetricsResponse` interface
   - Added `recentTransactionsResult` query (5 most recent, depth=2)
   - Included mapped `recentTransactions` in response

2. **src/ui/admin/RecentTransactionsWidget/index.tsx**
   - Removed client-side fetch to `/api/collections/transactions`
   - Now reads from `useMetricsContext()` like other widgets
   - Updated interface to match the response shape

3. **tests/int/recent-transactions-widget-1950.int.spec.ts**
   - Tests that the dashboard metrics endpoint returns `recentTransactions`
   - Tests auth (401 without auth, 403 for non-admin)
   - Tests response shape and sorting

## Why the original API returned 404

The root cause was not fully diagnosed - the Payload REST API `/api/collections/transactions` appears to not be accessible from client-side widgets in this setup, despite other collections working. The fix follows the established pattern used by other dashboard widgets.
