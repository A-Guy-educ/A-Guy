# Bug #2479 Fix — PayPal return renders "No Session Found"

## What was wrong

The checkout success page (`src/app/(frontend)/checkout/success/page.tsx`) only read the `session_id` query parameter from the URL. When PayPal redirected back with `?provider=paypal&token=<ORDER_ID>&PayerID=<PAYER_ID>`, `session_id` was undefined, so the entire transaction lookup block was skipped. The page rendered "No Session Found" even though the pending transaction existed in the database.

## What was changed

**`src/app/(frontend)/checkout/success/page.tsx`**:
- Updated `Props` type to include `provider`, `token`, `PayerID` alongside `session_id`
- Added `lookupId` computation: `provider === 'paypal' && token ? token : session_id`
- Changed `payload.find` call to use `lookupId` (was `session_id`)
- Changed `CheckoutSuccessContent sessionId` prop to use `lookupId` (was `session_id`)

**`tests/int/checkout-success-paypal-return.int.spec.ts`**: New unit test file (3 tests):
1. PayPal token → `payload.find` is called with `providerTransactionId = token` (FAILS before fix, PASSES after)
2. Stripe `session_id` → regression check that existing behavior is preserved
3. No params → `payload.find` is NOT called (edge case)

## Key details

- PayPal's `token` is the PayPal order ID, which is stored as `providerTransactionId` when the transaction is created in the checkout API
- For Stripe, the behavior is unchanged: `session_id` is used as `providerTransactionId`
- For PayPal without a token (malformed redirect), no lookup occurs — acceptable fallback
- `PayerID` is ignored in the lookup (used only by PayPal for its own confirmation; the transaction was already created with the order ID)
