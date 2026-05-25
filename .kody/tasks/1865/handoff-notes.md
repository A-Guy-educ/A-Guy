# Fix: Admin Dashboard Recent Transactions HTTP 404

## What was fixed

The `RecentTransactionsWidget` on the admin dashboard was fetching from `/api/collections/transactions` (Payload REST API), which returned HTTP 404. Fixed by creating a dedicated `/api/admin/recent-transactions` endpoint and updating the widget to use it.

## Root cause

The widget used the Payload REST API endpoint at `/api/collections/transactions`, which either wasn't accessible or wasn't returning data in the expected format for the admin dashboard context.

## Files changed

1. **`src/app/api/admin/recent-transactions/route.ts`** (new) — Admin-only endpoint that uses `payload.find()` to return the 5 most recent transactions with depth=2. Mirrors the auth pattern from `dashboard-metrics/route.ts`.

2. **`src/ui/admin/RecentTransactionsWidget/index.tsx`** — Changed `fetch('/api/collections/transactions?limit=5&sort=-createdAt&depth=2')` to `fetch('/api/admin/recent-transactions')`. No other changes to the component.

3. **`tests/int/admin-recent-transactions-1865.int.spec.ts`** (new) — Integration tests covering 401/403 auth, 200 response shape, 5-transaction limit, descending sort order, and required fields.

## Test results

All 6 integration tests pass (auth checks + functionality). Full quality gates (typecheck, lint, tests) pass.
