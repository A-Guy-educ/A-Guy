# Issue #1907 — 404 on Transactions API Endpoint in Admin Dashboard

## Root Cause
Payload CMS REST API endpoints are at `/api/{slug}` (e.g. `/api/transactions`), NOT `/api/collections/{slug}`. The `RecentTransactionsWidget` and `TransactionEditView` were fetching from the wrong URL path, causing 404.

**Evidence from Payload source:**
- `payload/dist/config/defaults.js`: `routes.api = '/api'`
- `payload/dist/utilities/handleEndpoints.js`: uses `payload.collections[firstParam]` where `firstParam` is the first URL segment. For `/api/transactions` → `firstParam='transactions'` → matches `payload.collections['transactions']`. For `/api/collections/transactions` → `firstParam='collections'` → no such collection → falls through to custom endpoints → 404.

## Changes Made
1. **src/ui/admin/RecentTransactionsWidget/index.tsx:95** — Fixed fetch URL from `/api/collections/transactions?limit=5&sort=-createdAt&depth=2` to `/api/transactions?limit=5&sort=-createdAt&depth=2`
2. **src/ui/admin/TransactionEditView/index.tsx:693** — Fixed fetch URL from `/api/collections/transactions/${id}?depth=2` to `/api/transactions/${id}?depth=2`
3. **tests/int/admin-transactions-rest-api-1907.int.spec.ts** — New test file verifying the `/api/transactions` endpoint returns 200 with admin auth (and 401/403 for auth cases).

## Known Follow-up
CreateCouponModal at `src/ui/admin/Coupons/CreateCouponModal/index.tsx:105` uses the same wrong pattern (`/api/collections/coupons`) and may need the same fix.