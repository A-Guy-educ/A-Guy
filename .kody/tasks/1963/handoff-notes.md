## Fix: RecentTransactionsWidget HTTP 404 (#1963)

### Root Cause
The `RecentTransactionsWidget` called `/api/collections/transactions?limit=5&sort=-createdAt&depth=2` directly — a Payload REST API route that does not exist in this project (the `src/app/(payload)/api/[...slug]/route.ts` auto-generated route exists but may not expose the transactions collection). All other dashboard widgets use the `MetricsProvider` context which fetches from `/api/admin/dashboard-metrics`.

### What Changed

**`src/app/api/admin/dashboard-metrics/route.ts`**
- Added `RecentTransaction` interface (mirrors the widget's existing `Transaction` type with depth=2 user/product population)
- Added `recentTransactions: RecentTransaction[]` to `DashboardMetricsResponse` interface
- Added `payload.find()` call for 5 most recent transactions with `depth: 2` (no period filter — always shows global most recent) alongside the existing Promise.all
- Uses `as Promise<{ docs: RecentTransaction[] }>` cast pattern matching all other payload.find calls in this file

**`src/ui/admin/RecentTransactionsWidget/index.tsx`**
- Removed local `useState` for transactions/loading/error
- Removed the broken `fetch('/api/collections/transactions?limit=5&sort=-createdAt&depth=2', ...)` call
- Now uses `useMetricsContext()` — same pattern as `RevenueWidget`, `TopProductsWidget`, etc.
- Falls back to `data?.recentTransactions ?? []`

**`tests/int/admin-recent-transactions-1963.int.spec.ts`**
- New integration test covering: 401/403 auth checks, `recentTransactions` array shape (≤5 items, sorted by createdAt desc), required fields per transaction

### Key Pattern
All dashboard widgets use `MetricsProvider` context. The `RecentTransactionsWidget` was the only outlier. The fix brings it in line with existing patterns (RevenueWidget, TopProductsWidget, etc.).
