# Fix: Admin Dashboard Recent Transactions Widget 404

## What

Created the missing `GET /api/collections/transactions` route that the `RecentTransactionsWidget` component fetches from. The widget was failing with "HTTP 404" because no Next.js route handler existed at that path.

## Root Cause

The `RecentTransactionsWidget` (src/ui/admin/RecentTransactionsWidget/index.tsx:95) fetches from `/api/collections/transactions?limit=5&sort=-createdAt&depth=2`. This endpoint did not exist — the project uses custom API routes under `/api/admin/` patterns rather than a generic Payload REST API at `/api/collections/<slug>`.

## Files Changed

- `src/app/api/collections/transactions/route.ts` — NEW: Admin-only transactions list endpoint that queries Payload's Local API and returns `{ docs: [...] }` matching the widget's expected format.
- `tests/int/admin-recent-transactions-api.int.spec.ts` — NEW: Integration test covering auth (401/403) and response shape.

## Route Details

The new route:
- Authenticates via Payload JWT (same pattern as `/api/admin/dashboard-metrics`)
- Returns 401 without auth, 403 for non-admin users
- Accepts `limit`, `sort`, `depth` query params (mirrors widget's fetch call)
- Returns `{ docs: result.docs }` with full transaction objects (populated by depth)

## Why This Approach

Mirrored the auth/admin-check pattern from existing `src/app/api/admin/transactions/[id]/refund/route.ts`. The widget expects Payload's standard list response shape `{ docs: [...] }` with depth-populated relations for user and product.
