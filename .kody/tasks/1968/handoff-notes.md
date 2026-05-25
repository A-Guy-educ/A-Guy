# Fix for #1968: Recent Transactions Widget HTTP 404

## What was fixed

The RecentTransactionsWidget was making a direct browser fetch to `/api/collections/transactions?limit=5&sort=-createdAt&depth=2`, which returned HTTP 404. All other dashboard widgets (RevenueWidget, TopProductsWidget, CourseEnrollmentsWidget) use `useMetricsContext()` to fetch data from `/api/admin/dashboard-metrics`.

## Root cause

The `/api/collections/*` Payload REST endpoints are not accessible from the browser when accessed from a client component in the admin dashboard. The admin session/auth context doesn't flow through the same way as it does for other widgets.

## Changes made

### 1. `src/app/api/admin/dashboard-metrics/route.ts`
- Added `RecentTransaction` interface (id, createdAt, amount, currency, status, user.email, product.name)
- Added `recentTransactions` field to `DashboardMetricsResponse`
- Added query to fetch 5 most recent transactions sorted by createdAt desc with depth=2
- Built the `recentTransactions` array from the query results

### 2. `src/ui/admin/RecentTransactionsWidget/index.tsx`
- Removed the `useCallback`/`useEffect`/`useState` pattern with direct fetch
- Now uses `useMetricsContext()` like all other dashboard widgets
- Removed unused interfaces (Transaction, TransactionUser, TransactionProduct, TransactionsResponse)
- Error handling preserved with same `admin-only` / error states

### 3. `tests/int/admin-dashboard-recent-transactions-1968.int.spec.ts`
- New integration test verifying recentTransactions API response shape
- Tests: auth (401/403), array length <= 5, required fields, sort order, all periods

## Verification
- TypeScript compiles cleanly
- Lint passes (only pre-existing warnings in unrelated files)
- Verify passed on first attempt