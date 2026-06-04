# #2387: Verify Stripe webhook endpoint is receiving events

## Investigation Result: NO CODE BUG

The Stripe webhook endpoint is **correctly implemented**. All 46 webhook integration tests pass.

### Code Verified
- `src/app/api/webhooks/stripe/route.ts` — signature verification, dedup gate (creates WebhookEvents doc before processing, marks `processed: true` after success), event routing for all handled types
- `src/server/payload/collections/WebhookEvents.ts` — compound unique index on `(provider, eventId)` correctly configured
- `src/lib/payment/stripe.ts` — `verifyStripeWebhook` uses `stripe.webhooks.constructEvent` with `STRIPE_WEBHOOK_SECRET`

### Root Cause: Infrastructure Issue
The `webhook-events` collection is empty because **Stripe is not sending events to the endpoint**. This is a Stripe Dashboard configuration issue:

1. Webhook endpoint URL may not be registered, or points to wrong URL
2. `STRIPE_WEBHOOK_SECRET` env var may not match the signing secret in Stripe Dashboard
3. Webhook may be disabled in Stripe Dashboard
4. Enabled events may not include the required events

### Verification Steps (for ops team)
1. In Stripe Dashboard → Developers → Webhooks → your endpoint
2. Confirm endpoint URL is `https://yourdomain.com/api/webhooks/stripe`
3. Confirm "Signing secret" matches `STRIPE_WEBHOOK_SECRET` env var
4. Confirm enabled events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `charge.refunded`
5. Check endpoint is enabled (not disabled)
6. Check Stripe's "Failed webhook emails" for delivery attempts
