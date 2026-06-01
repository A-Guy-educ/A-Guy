# Fix: Dashboard Revenue Widgets Query Payment_stats

## What Changed

**Root Cause**: The `/api/admin/dashboard-metrics` API route computed revenue metrics (totalRevenueAgorot, refundedAgorot, failedAgorot, transactionCount, successRate) by querying the `transactions` collection directly. The authoritative source for these values is `Payment_stats` — a daily-aggregated collection populated by the `syncPaymentStats` afterChange hook on every transaction change.

**Fix**: Changed the revenue aggregation in `src/app/api/admin/dashboard-metrics/route.ts` to:
1. Query `Payment_stats` (via new `findAll` call) for revenue metrics
2. Continue aggregating `topProducts` from `transactions` (since `Payment_stats` has no product field)

Added `PaymentStatsRow` and `TransactionRow` local type aliases to disambiguate the two `findAll` calls in the same `Promise.all` (TypeScript was swapping their types during destructuring).

**Test**: Added a test case in `tests/int/admin-dashboard-revenue-metrics-1641.int.spec.ts` that creates a transaction, verifies `Payment_stats` is populated via the sync hook, and asserts the dashboard API returns revenue from `Payment_stats`.

## Files Changed
- `src/app/api/admin/dashboard-metrics/route.ts` — replaced revenue aggregation from `transactions` to `Payment_stats`
- `tests/int/admin-dashboard-revenue-metrics-1641.int.spec.ts` — added test for Payment_stats as revenue source

## Followup
`RecentTransactionsWidget` fetches directly from `/api/transactions` — separate from revenue metrics but worth reviewing if consistent Payment_stats sourcing is desired across all dashboard widgets.
