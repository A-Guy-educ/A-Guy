# Issue #2053 Fix — Admin Dashboard Widgets Stuck on Loading

## What Was Wrong

The `RecentTransactionsWidget` and several other admin widgets were calling Payload REST API endpoints at URLs like `/api/collections/transactions` (with a `collections` prefix). However, Payload's REST API endpoints are at `/api/{collection-slug}` — without the `collections` segment.

When a request hits `/api/collections/transactions`, Payload's `handleEndpoints` function (in `node_modules/payload/dist/utilities/handleEndpoints.js`) receives the path `/api/collections/transactions`. It strips the base API path (`/api`) to get `/collections/transactions`, then treats the first segment (`collections`) as the **collection name**. Since no collection is named `collections`, the lookup `payload.collections['collections']` returns `undefined` and the route returns 404.

## What Was Fixed

Updated all widget API calls from `/api/collections/{entity}` to `/api/{entity}`:

1. **src/ui/admin/RecentTransactionsWidget/index.tsx** — Changed `/api/collections/transactions` to `/api/transactions`
2. **src/ui/admin/TransactionEditView/index.tsx** — Changed `/api/collections/transactions/${id}` to `/api/transactions/${id}`
3. **src/ui/admin/Coupons/CreateCouponModal/index.tsx** — Changed `/api/collections/coupons` to `/api/coupons`
4. **src/ui/admin/Coupons/CouponUsageModal/index.tsx** — Changed `/api/collections/coupon-usages` to `/api/coupon-usages`

## Root Cause Analysis

In `handleEndpoints` (line 106-131), the URL path `/api/collections/transactions` is processed as:
- `pathname = '/api/collections/transactions'`
- `baseAPIPath = '/api'` (from `config.routes.api`)
- `adjustedPathname = '/collections/transactions'`
- `firstParam = 'collections'` — **this is the bug**: it looks for a collection named `collections` instead of `transactions`

The correct URL format is `/api/{collection-slug}` where `{collection-slug}` is the actual collection name (e.g., `transactions`, `coupons`).

## Test Added

**tests/int/collections-rest-api.int.spec.ts** — Integration test that:
- Creates a test tenant, admin user, product, and transaction
- Calls the collections REST API handler directly with `params.slug = ['transactions']`
- Verifies a 200 response with a docs array

Run with: `pnpm exec vitest run tests/int/collections-rest-api.int.spec.ts --config ./vitest.config.mts`

## Verification

- `pnpm typecheck` — PASSED
- `pnpm lint` — PASSED (pre-existing warnings only)
- `tests/int/collections-rest-api.int.spec.ts` — PASSED (1 test)
- `tests/int/transaction-status-transition.int.spec.ts` — PASSED (17 tests)
- `tests/int/teacher-profiles-api.int.spec.ts` — PASSED (4 tests)
