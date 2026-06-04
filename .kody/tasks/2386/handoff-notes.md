# Task #2386 — Investigate Transactions Stuck in Pending

## Investigation Summary

**No code bug found.** The webhook handlers are all correctly implemented.

## Code Verified (all correct):

- `src/app/api/webhooks/stripe/route.ts` — All Stripe webhook events handled correctly:
  - `checkout.session.completed` — grants entitlements (only when payment_status=paid), flips to succeeded, sends purchase receipt, consumes coupon
  - `checkout.session.async_payment_succeeded` — grants entitlements, flips to succeeded, sends purchase receipt, consumes coupon
  - `checkout.session.async_payment_failed` — flips to failed
  - `charge.refunded` — flips to refunded (or updates refundedAmount for partial)
- `src/server/payload/collections/Transactions.ts` — status field correct, hooks correct
- `src/server/payload/collections/WebhookEvents.ts` — dedup gate correct, compound unique index on (provider, eventId)
- `tests/int/payment-webhook-entitlements.int.spec.ts` — 50+ tests covering all paths, all pass

## Root Cause of "Transactions Stuck in Pending"

The webhook-events collection is **empty** because **Stripe is not sending webhook events** to the endpoint. This is an **infrastructure/configuration issue**, not a code bug.

**Verify in Stripe Dashboard:**
1. Webhook endpoint URL is correct: `https://yourdomain.com/api/webhooks/stripe`
2. Signing secret (`whsec_...`) matches `STRIPE_WEBHOOK_SECRET` env var
3. Events enabled: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `charge.refunded`
4. Network connectivity from Stripe to the webhook endpoint

## Quality Gates

`pnpm ci:local` passes — typecheck, lint, and all tests green. `mcp__kody-verify__verify` returns `ok: true`.
