# Issue #2408 Fix — PayPal Checkout Returns HTTP 500

## Root Cause

The checkout route at `src/app/api/payments/checkout/route.ts` used exact string matching (`===`) to detect PayPal credential errors, but `getPaymentEnv()` in `src/lib/payment/env.ts` throws a different format:

- Checkout route expected: `'Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET environment variable'`
- getPaymentEnv() threw: `'Missing required payment environment variables: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID'`

Since the exact match failed, the error fell through to the 500 `checkout_creation_failed` path instead of the 503 `payment_provider_not_configured` path.

## Fix

Changed exact string equality (`===`) to `.includes()` substring checks in the error detection at line ~401-408 of `src/app/api/payments/checkout/route.ts`:

```typescript
// Before (broken):
errorMessage === 'Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET environment variable'

// After (fixed):
errorMessage.includes('PAYPAL_CLIENT_ID') && errorMessage.includes('PAYPAL_CLIENT_SECRET')
```

Same pattern applied to Stripe: `errorMessage.includes('STRIPE_SECRET_KEY')`.

## Files Changed

- `src/app/api/payments/checkout/route.ts` — error detection substring matching
- `tests/unit/api/payments/checkout-validation.spec.ts` — added regression tests for error detection

## Verification

All unit tests pass (3341 total, 3 new regression tests added). Integration tests pass. Quality gates green.
