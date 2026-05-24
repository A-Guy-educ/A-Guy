# Fix: Transactions API returns 404 on admin dashboard

## What I did

1. Created a custom admin endpoint at `src/app/api/admin/transactions/route.ts` that lists transactions with proper admin authentication.

2. Updated `RecentTransactionsWidget` to use the new `/api/admin/transactions` endpoint instead of the broken `/api/collections/transactions` Payload REST API endpoint.

## Root cause

The Payload REST API endpoint `/api/collections/transactions` (list operation) was returning 404 when called from the admin dashboard, while the `/api/collections/transactions/:id` endpoint (get by ID) worked fine in TransactionEditView. This suggests a bug or misconfiguration specific to the list operation of the transactions collection in Payload v3.73.0's REST API.

## Why this fix

- Consistent with other dashboard widgets that use `/api/admin/*` endpoints (e.g., `/api/admin/dashboard-metrics`)
- Avoids modifying Payload internals
- Provides proper admin authentication via JWT in Authorization header or cookies
- Uses `overrideAccess: true` after admin check for efficient querying

## Files changed

- `src/app/api/admin/transactions/route.ts` (new file)
- `src/ui/admin/RecentTransactionsWidget/index.tsx` (changed endpoint URL)

## Note

The underlying issue with Payload's REST API `/api/collections/transactions` endpoint was not investigated further since no dev server was available to reproduce the issue. The custom endpoint workaround should resolve the immediate bug.
