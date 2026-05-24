# Fix: RecentTransactionsWidget HTTP 404

## Root Cause
The `RecentTransactionsWidget` made client-side fetches to `/api/collections/transactions`, Payload's built-in REST API endpoint. In this project's deployment context, these requests returned HTTP 404. This was inconsistent with other admin dashboard widgets (RevenueWidget, TopProductsWidget, etc.) which all use a custom `/api/admin/dashboard-metrics` endpoint.

## Changes

1. **New endpoint** (`src/app/api/admin/transactions/recent/route.ts`): Created a dedicated admin API endpoint that uses Payload's local API directly (not REST) with `overrideAccess: true`, bypassing the authentication issue. Returns the 5 most recent transactions sorted by `createdAt` descending.

2. **Widget update** (`src/ui/admin/RecentTransactionsWidget/index.tsx`): Changed the fetch URL from `/api/collections/transactions?limit=5&sort=-createdAt&depth=2` to `/api/admin/transactions/recent?limit=5`. Updated the response type name from `TransactionsResponse` to `RecentTransactionsResponse`.

3. **Integration test** (`tests/int/admin-recent-transactions.int.spec.ts`): Added tests covering 401 (no auth), 403 (non-admin), 200 with array response, and limit query parameter.

## Follow-up
`TransactionPaymentDetail` in `src/ui/admin/TransactionEditView/index.tsx` uses the same `/api/collections/transactions/{id}` pattern and may have the same issue.
