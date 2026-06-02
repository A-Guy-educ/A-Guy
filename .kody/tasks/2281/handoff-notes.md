# Handoff Notes: Issue #2281 - WebhookEvents Collection Empty

## What I Did

1. **Investigated the webhook handlers** (`src/app/api/webhooks/stripe/route.ts` and `paypal/route.ts`):
   - Both correctly create WebhookEvents records with `overrideAccess: true` in the dedup gate (step 2)
   - Both update `processed: true` after successful handling (step 6)

2. **Investigated the access control** (`src/server/payload/collections/WebhookEvents.ts`):
   - `access.read: adminOnly` — only admin users can read
   - `adminOnly` function checks `user.role === AccountRole.Admin`

3. **Investigated `syncPaymentStats` hook** (`src/server/payload/collections/Transactions/hooks/syncPaymentStats-hook.ts`):
   - Recent fix (commit `120623827`) changed guard from `!req?.context` to `req?.context?._skipPaymentStatsUpsert`
   - This allows webhook-initiated transaction updates to correctly update Payment_stats
   - NOT related to WebhookEvents visibility

4. **Created targeted integration test** (`tests/int/webhook-events-admin-access.int.spec.ts`):
   - Test 1: Webhook handler pattern — create with overrideAccess, query without
   - Test 2: Admin user can query WebhookEvents with adminOnly access
   - Test 3: Stripe webhook handler creates WebhookEvents record
   - Test 4: BUG REPRODUCTION — query without overrideAccess returns created record

5. **Ran all tests**: All 50 tests pass (46 existing + 4 new)

## Why No Code Bug Found

All tests pass, meaning:
- WebhookEvents CAN be created with `overrideAccess: true` ✓
- WebhookEvents CAN be queried without `overrideAccess` when admin user is authenticated ✓
- The webhook handlers correctly create WebhookEvents records ✓
- The dedup gate works correctly ✓

**The collection may be empty in the target environment because webhooks are not firing**, not due to a code bug. Possible causes:
1. Webhook endpoint URL not configured in Stripe/PayPal dashboard
2. Firewall/network issues preventing webhooks from reaching the server
3. Webhook signature verification failing silently

## Recommendations

1. **Verify webhooks are being received**: Check server logs for incoming Stripe/PayPal webhook requests at `POST /api/webhooks/stripe` and `POST /api/webhooks/paypal`

2. **Check webhook configuration**: Ensure Stripe webhook endpoint is configured to send events to `https://your-domain.com/api/webhooks/stripe` with all required event types

3. **If actual code fix needed**: Please provide more specific reproduction steps or error logs showing how the admin UI fails to display records that were created by webhook handlers