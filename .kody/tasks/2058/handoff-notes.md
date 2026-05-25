# Issue #2058 — Duplicate of #2053 (Already Fixed)

## Summary

Issue #2058 reports that the transactions collection API returns 404 for the admin dashboard. This is a **duplicate of issue #2053** which was already fixed on this branch.

## What Was Wrong

The `RecentTransactionsWidget` and other admin components were calling Payload REST API endpoints at URLs like `/api/collections/transactions` (with a `collections` prefix). However, Payload's REST API endpoints are at `/api/{collection-slug}` — without the `collections` segment.

When a request hits `/api/collections/transactions`, Payload's `handleEndpoints` function strips the base API path (`/api`) to get `/collections/transactions`, then treats the first segment (`collections`) as the collection name. Since no collection is named `collections`, the lookup returns `undefined` and the route returns 404.

## What Was Fixed (in #2053)

Updated all widget API calls from `/api/collections/{entity}` to `/api/{entity}`:

1. **src/ui/admin/RecentTransactionsWidget/index.tsx** — Changed `/api/collections/transactions` to `/api/transactions`
2. **src/ui/admin/TransactionEditView/index.tsx** — Changed `/api/collections/transactions/${id}` to `/api/transactions/${id}`
3. **src/ui/admin/Coupons/CreateCouponModal/index.tsx** — Changed `/api/collections/coupons` to `/api/coupons`
4. **src/ui/admin/Coupons/CouponUsageModal/index.tsx** — Changed `/api/collections/coupon-usages` to `/api/coupon-usages`

## Test Coverage

**tests/int/collections-rest-api.int.spec.ts** — Integration test that:
- Creates a test tenant, admin user, product, and transaction
- Calls the collections REST API handler directly with `params.slug = ['transactions']`
- Verifies a 200 response with a docs array

## Verification

- `pnpm typecheck` — PASSED
- `pnpm lint` — PASSED
- `tests/int/collections-rest-api.int.spec.ts` — PASSED (1 test)
- `tests/int/transaction-status-transition.int.spec.ts` — PASSED (17 tests)

## Root Cause

In Payload's `handleEndpoints` function, when given path `/api/collections/transactions`:
- `baseAPIPath = '/api'`
- `adjustedPathname = '/collections/transactions'`
- `firstParam = 'collections'` — looks for collection named 'collections' (doesn't exist)

The correct URL format is `/api/{collection-slug}` where `{collection-slug}` is the actual collection name (e.g., `transactions`, `coupons`).
