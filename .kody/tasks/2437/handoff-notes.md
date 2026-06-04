# Fix: Dashboard Revenue Widget Disconnected from PaymentStats (#2437)

## What was wrong

The GET /api/admin/dashboard-metrics endpoint computed revenue by querying raw `transactions` records (createdAt >= periodStart). If a PaymentStats row existed for the current period but no `transaction` was created in that period (e.g., legacy data inserted directly, or a PaymentStats upsert from an older webhook), the widget showed ₪0.00 / 0.0% success.

PaymentStats is the authoritative aggregated source — one row per (date, currency) with pre-computed sums (totalRevenueAgorot, succeededCount, refundedAgorot, etc.).

## What was changed

**src/app/api/admin/dashboard-metrics/route.ts:**
1. Added `allPaymentStats` to the Promise.all array — a findAll query on `payment_stats` filtered by `date >= periodStart` (YYYY-MM-DD format)
2. Replaced the transaction-based revenue loop with a PaymentStats-based loop that aggregates `totalRevenueAgorot` by currency, `refundedAgorot`, `failedAgorot`, `succeededCount`, and `nonPendingCount` (succeeded + refunded + failed counts)
3. Kept `topProducts` derivation from `allTransactions` since PaymentStats has no per-product breakdown
4. `revenueTransactionCount` now equals `nonPendingCount` (total counted transactions from PaymentStats)

**tests/int/admin-dashboard-revenue-payment-stats-disconnect-2437.int.spec.ts:**
- New integration test file covering the PaymentStats → revenueMetrics connection
- 6 tests: empty state, succeeded revenue reflect, refunded/failed amounts reflect, period boundary filter, auth 401, auth 403
- Uses deferred dynamic imports to start MongoDB container before @payload-config is loaded

## How to verify

`pnpm test:int -- tests/int/admin-dashboard-revenue-payment-stats-disconnect-2437.int.spec.ts`

All 6 tests pass. Existing payment-stats tests (11 tests) still pass. Quality gates (typecheck, lint, test) all green.
