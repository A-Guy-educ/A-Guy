# Fix for #2436: payment_intent.succeeded webhook handler missing

## Root Cause
The Stripe webhook handler (`src/app/api/webhooks/stripe/route.ts`) only handled `checkout.session.completed` events. When Stripe sends `payment_intent.succeeded` events (e.g., for direct Payment Intents API payments), they hit the `default` case and are silently acknowledged without processing, leaving transactions stuck in pending.

## Fix
Added a `payment_intent.succeeded` case to the `handleEvent` switch statement. The handler:
1. Extracts `paymentIntentId` from `event.data.object.id`
2. Looks up transaction by `paymentIntentId` (the field populated when Checkout sessions resolve)
3. Grants entitlements if not already granted (idempotent via `entitlementsGrantedAt`)
4. Updates status to `succeeded`
5. Handles coupon consumption (idempotent via `couponConsumedAt`)
6. Fires purchase receipt email (fire-and-forget)

## Files Changed
- `src/app/api/webhooks/stripe/route.ts` — added ~90 lines for new case
- `tests/int/payment-webhook-entitlements.int.spec.ts` — added 2 tests (success + idempotency)

## Note
If webhook-events collection is still empty after this fix, verify the Stripe Dashboard webhook URL is correct and the endpoint is reachable from Stripe's servers.
