# Fix #1987: Persist PayPal captureId for refunds + forward currency + 400 on parse failure

## What was done

### Root cause
PayPal refunds were broken because: (1) `providerTransactionId` stored the Order ID, not the Capture ID; (2) the refund call used Order ID where Capture ID was needed; (3) `PAYMENT.CAPTURE.REFUNDED` looked up by wrong field; (4) currency defaulted to USD instead of using transaction.currency; (5) JSON parse failures returned 200 (masking malformed deliveries).

### Changes

**`src/server/payload/collections/Transactions.ts`**: Added `captureId` text field (no index — `providerTransactionId` already has index for general lookups; `captureId` is only used for refund lookups).

**`src/app/api/webhooks/paypal/route.ts`**: 
- JSON parse failure now returns 400 `{ error: 'invalid_body' }` with log (was 200 `{ received: true }`)
- `PAYMENT.CAPTURE.COMPLETED` now persists `captureId: event.resource.id` on the transaction update
- `PAYMENT.CAPTURE.REFUNDED` now looks up via `captureId` as primary, with fallback to `providerTransactionId` for legacy transactions (no `captureId` field)

**`src/app/api/admin/transactions/[id]/refund/route.ts`**: For PayPal refunds: uses `captureId ?? providerTransactionId` and forwards `transaction.currency` (was always passing Order ID and defaulting currency to USD).

**`src/payload-types.ts`**: Regenerated after adding `captureId` field.

### Tests added
- `tests/int/payment-webhook-entitlements.int.spec.ts`: `captureId` persistence test, `captureId`-lookup test, JSON parse 400 test
- `tests/int/transaction-refund.int.spec.ts`: `captureId` + currency forwarding test, legacy fallback test

### Followup
The existing test `PAYMENT.CAPTURE.REFUNDED should update transaction to refunded` still passes via the legacy fallback. Should be updated to use the `captureId` field (low priority).
