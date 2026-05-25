# Fix #1936: RecentTransactionsWidget HTTP 404

## Root Cause
RecentTransactionsWidget at `src/ui/admin/RecentTransactionsWidget/index.tsx` called the Payload v3 REST API at the wrong URL: `/api/collections/transactions`. The correct Payload v3 REST API path is `/api/transactions`.

Confirmed via curl against the running dev server:
- `GET /api/collections/transactions` → **404** (route does not exist)
- `GET /api/transactions` → **403** (endpoint exists, auth required)

Payload v3 REST API endpoints are at `/api/{collection-slug}` (default `routes.api = '/api'`). The `/api/collections/` prefix is a Payload v2 convention that does not apply in v3.

## Changes Made
1. **`src/ui/admin/RecentTransactionsWidget/index.tsx`**: Changed API URL from `/api/collections/transactions` to `/api/transactions` (line 95).

2. **`tests/int/admin-recent-transactions-widget-1936.int.spec.ts`**: New integration test that:
   - Verifies admin can read transactions via Payload Local API (proving the correct URL works)
   - Verifies non-admin users are denied access
   - Proves `/api/collections/transactions` returns 404 (wrong URL)
   - Proves `/api/transactions` is the correct URL

## What Could Regress
The URL change is minimal (removes `/collections` from path). No adjacent code was changed.

## Follow-ups
- `TransactionEditView` at `src/ui/admin/TransactionEditView/index.tsx` also uses the wrong `/api/collections/transactions/{id}` URL — same bug, different component (not in #1936 scope).
- `CouponUsageModal` and `CreateCouponModal` also use `/api/collections/` URLs — same pattern.
