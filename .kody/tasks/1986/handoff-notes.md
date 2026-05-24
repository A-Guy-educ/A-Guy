# Issue #1986 — Handoff Notes

## What was fixed

### Bug 1: Stripe refunds broken (cs_... vs pi_...)
- Added `paymentIntentId` (text) field to `Transactions` collection — indexed via Payload.
- `checkout.session.completed` now extracts `payment_intent` from the session object and persists it to `paymentIntentId` when `payment_status === 'paid'`.
- `charge.refunded` lookup now uses `paymentIntentId` first, falls back to `providerTransactionId` for backward compat.
- Admin refund route uses `paymentIntentId` with `providerTransactionId` fallback for Stripe refunds.

### Bug 2: Entitlement leak on async payments
- `checkout.session.completed` now gates on `payment_status === 'paid'`. Other values (unpaid/pending for Klarna/ACH/SEPA) leave transaction pending.
- Added `checkout.session.async_payment_succeeded` handler: grants entitlements, persists `paymentIntentId`, flips to succeeded.
- Added `checkout.session.async_payment_failed` handler: flips to failed.

### Bug 3: refundedBy wiped by charge.refunded
- Full refund: `charge.refunded` update no longer includes `refundedBy: null` — admin-set value is preserved.
- Partial refund: `refundedBy` only set to `null` if currently `null` (first partial refund population).

## Files changed
- `src/server/payload/collections/Transactions.ts` — added `paymentIntentId` field
- `src/app/api/webhooks/stripe/route.ts` — gate on payment_status, persist paymentIntentId, async handlers, fix refundedBy
- `src/app/api/admin/transactions/[id]/refund/route.ts` — use `paymentIntentId` for Stripe refunds
- `tests/int/payment-webhook-entitlements.int.spec.ts` — updated existing tests with `payment_status: 'paid'`, added 4 new tests

## Backfill needed
Run `pnpm generate:types` after merging (already done locally). Existing Stripe transactions with `providerTransactionId = cs_...` need a one-shot migration to backfill `paymentIntentId` from Stripe's API — the webhook fallback handles the gap in the meantime.
