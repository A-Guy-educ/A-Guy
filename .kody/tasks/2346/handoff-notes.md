Fixed CI failure in `admin-dashboard-revenue-metrics-1641.int.spec.ts`.

**Root cause:** The PR changed `revenueTransactionCount` from `allTransactions.length` (counting ALL transactions in the period) to summing `payment_stats.transactionCount` (which only counts transactions at terminal states: succeeded/refunded/failed). The test `transactionCount reflects all transactions in period` expects the original behavior.

**Fix:** In `src/app/api/admin/dashboard-metrics/route.ts` line ~723, changed:
```typescript
// Before (buggy):
const revenueTransactionCount = (paymentStatsResult as PaymentStatsRow[]).reduce(
  (sum, row) => sum + (row.transactionCount || 0), 0,
)

// After (fixed):
const revenueTransactionCount = allTransactions.length
```

This preserves the original `transactionCount` semantics (all transactions) while keeping `payment_stats` as the authoritative source for revenue amounts (totalRevenueByCurrency, refundedTotal, failedTotal, etc.) per issue #2279.
