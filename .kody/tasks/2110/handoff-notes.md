# Issue #2110 — WebhookEvents Dedup Implementation Complete

## What was built

A central `WebhookEvents` Payload collection for deduplicating Stripe and PayPal webhook handlers.

### Files created
- `src/server/payload/collections/WebhookEvents.ts` — New collection with compound unique index on `(provider, eventId)`, fields: provider, eventId, eventType, receivedAt (default: now), processed (default: false), timestamps

### Files modified
- `src/payload.config.ts` — Registered WebhookEvents collection
- `src/lib/payment/stripe.ts` — Added `tolerance?: number` parameter to `verifyStripeWebhook`, passed to `constructEvent`
- `src/app/api/webhooks/stripe/route.ts` — Added `isDuplicateKeyError` helper (handles MongoDB code 11000, E11000, Payload ValidationError with "unique" in message, and `e.data.errors[].message`), dedup gate after signature verification, marks `processed: true` after successful handling
- `src/app/api/webhooks/paypal/route.ts` — Same dedup gate pattern, added `id: string` to `PayPalWebhookEvent` interface
- `tests/int/payment-webhook-entitlements.int.spec.ts` — Added 5 new dedup tests and fixed all PayPal test bodies to include explicit `id` field

### Key design decisions
1. Dedup gate runs **after** signature verification (not before) — this avoids recording invalid events
2. `processed: false` is set at dedup gate time; `processed: true` only after `handleEvent()` completes successfully
3. If `handleEvent()` throws after the dedup row was created, the row stays at `processed: false` — PayPal/Stripe will retry and the event will be re-processed
4. `isDuplicateKeyError` checks 4 patterns: raw MongoDB code 11000, E11000 message, "unique" in error message, and `e.data.errors[].message` containing "unique" (Payload CMS wraps MongoDB duplicate-key in ValidationError)
5. Stripe tolerance of 300 seconds (5 minutes) added to prevent valid events near clock skew boundary from being rejected

### Test results
- All 46 tests pass (41 pre-existing + 5 new dedup tests)
- `pnpm verify` reports `ok: true`
