# Issue #2619 — Payment "Needs Attention" Dashboard Widget

## What was done

**API** (`src/app/api/admin/dashboard-metrics/route.ts`):
- Added `PaymentAttentionMetrics` interface with `stuckGrants`, `stuckReceipts`, `partialRefunds`, `stuckWebhooks`
- Added 4 `payload.find({ limit: 0 })` count queries to the existing Promise.all, using `overrideAccess: true` (admin-only endpoint)
- Added `paymentAttentionMetrics` to `DashboardMetricsResponse`

**Widget** (`src/ui/admin/ConversionTracking/NeedsAttentionWidget.tsx`):
- New client component with 4 `<a>` cards linking to filtered Payload list views
- Warning style (amber bg/border) applied per-card when count > 0
- "All clear" green success state when all counts are 0
- Registered above `RevenueWidget` in `DashboardWidgets`

**Strings** (`src/ui/admin/ConversionTracking/strings.ts`):
- Added `needsAttention`, `allClear`, `stuckGrants`, `stuckReceipts`, `partialRefunds`, `stuckWebhooks` in both EN and HE

**Widget Registration** (`src/ui/admin/ConversionTracking/DashboardWidgets.tsx`):
- Added import and placed `<NeedsAttentionWidget />` after `<DashboardHeader />` and before `<RevenueWidget />`

**Integration Test** (`tests/int/admin-dashboard-payment-attention.int.spec.ts`):
- 6 tests: auth checks (401/403) + 4 seeded query count tests (stuck grants, stuck receipts, partial refunds, stuck webhooks)

## Notes

- `stuckReceipts` uses `createdAt: { less_than: (now - 5min) }` to exclude in-flight webhooks — consistent with the 5-min grace window requirement
- `stuckWebhooks` uses `processed: { equals: false }` and `receivedAt: { less_than: (now - 15min) }`
- Deep-links use Payload's `where[field][operator]=value` query format
- Widget is admin-only via `error === 'admin-only'` guard in MetricsProvider (same pattern as RevenueWidget)
- Counts use `limit: 0` (count-only queries) for efficiency, not full doc loading
