# Issue #1783: Recent Transactions widget shows HTTP 404 error

## What was fixed

The RecentTransactionsWidget was making a client-side fetch to `/api/collections/transactions` (Payload REST API) which returned 404. This was because client-side components should not directly call Payload's REST API endpoints — they should use internal admin API endpoints instead (the same pattern used by RevenueWidget, TopProductsWidget, etc. via MetricsProvider).

## Files changed

1. **src/app/api/admin/recent-transactions/route.ts** — New internal admin endpoint at `GET /api/admin/recent-transactions` that:
   - Authenticates via `payload.auth()` (same as other admin endpoints)
   - Checks admin role explicitly (same pattern as refund endpoint)
   - Uses Payload local API with `overrideAccess: true` (server-side, no CORS/CSRF issues)
   - Returns recent transactions sorted by `createdAt` descending with limit 5
   - Populates `user.email` and `product.name` fields (depth=2)

2. **src/ui/admin/RecentTransactionsWidget/index.tsx** — Changed fetch URL from `/api/collections/transactions?limit=5&sort=-createdAt&depth=2` to `/api/admin/recent-transactions?limit=5`

3. **tests/int/admin-recent-transactions.int.spec.ts** — New integration test covering:
   - 401 without auth
   - 403 for non-admin users
   - Correct transaction shape for admin users
   - Sorted by createdAt descending

## Root cause

Payload's REST API (`/api/collections/transactions`) is not reliably accessible from client-side React components in the admin panel due to how Payload 3.x handles authentication/CSRF for client-side fetch calls. Internal admin API endpoints (server-side, using Payload local API) are the correct pattern — they bypass CORS/CSRF issues entirely.
