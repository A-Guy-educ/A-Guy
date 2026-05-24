## Fix: Admin Recent Transactions widget returns HTTP 404

### Problem
The RecentTransactionsWidget on `/admin` dashboard fetches from `/api/collections/transactions` which is the Payload REST API. The Transactions collection has `adminOnly` access control. When a QA (non-admin) user accesses the endpoint, Payload returns HTTP 404 instead of 403 — this is intentional security behavior (don't reveal resource existence to unauthorized users).

The widget only handles HTTP 403 specifically (returns null), so 404 causes it to throw an error and display "Failed to load: HTTP 404".

### Solution
Created a custom admin endpoint `/api/admin/recent-transactions` that:
1. Authenticates the user via `payload.auth()`
2. Returns 401 for unauthenticated requests
3. Returns 403 for non-admin users
4. Uses `overrideAccess: true` when fetching transactions, bypassing the `adminOnly` access control

### Files Changed
- **NEW**: `src/app/api/admin/recent-transactions/route.ts` — custom endpoint
- **MODIFIED**: `src/ui/admin/RecentTransactionsWidget/index.tsx` — changed fetch URL from `/api/collections/transactions` to `/api/admin/recent-transactions`
- **NEW**: `tests/int/admin-recent-transactions-1886.int.spec.ts` — integration test

### Root Cause
Payload REST API returns 404 (not 403) when access control denies, to avoid information disclosure. The widget couldn't handle this because it only had special handling for 403.
