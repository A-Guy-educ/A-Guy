# Fix: admin Recent Transactions HTTP 404

## What

`RecentTransactionsWidget` on `/admin` was fetching from `/api/collections/transactions?limit=5&sort=-createdAt&depth=2` which returned HTTP 404.

## Root Cause

The Payload REST API (`/api/collections/transactions`) was not accessible as expected. The widget used a direct Payload API call pattern that didn't work in this deployment context.

## Fix

1. Created a new dedicated admin endpoint: `src/app/api/admin/recent-transactions/route.ts`
   - Pattern mirrors existing `/api/admin/dashboard-metrics` route
   - GET handler, admin-only (401 unauthenticated, 403 non-admin)
   - Returns `{ transactions: RecentTransaction[] }` with 5 most recent transactions

2. Updated `src/ui/admin/RecentTransactionsWidget/index.tsx`:
   - Changed fetch URL from `/api/collections/transactions?limit=5&sort=-createdAt&depth=2` to `/api/admin/recent-transactions`
   - Updated response type from `TransactionsResponse` (with `docs`) to `RecentTransactionsResponse` (with `transactions`)

3. Added integration test: `tests/int/admin-recent-transactions-api.int.spec.ts`

## Files Changed

- `src/app/api/admin/recent-transactions/route.ts` (new)
- `src/ui/admin/RecentTransactionsWidget/index.tsx` (modified)
- `tests/int/admin-recent-transactions-api.int.spec.ts` (new)
