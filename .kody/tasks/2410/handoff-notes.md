# Fix: PayPal Checkout Returns HTTP 500

## What was fixed

The `/api/payments/checkout` route returned HTTP 500 for all PayPal errors, including when PayPal credentials were missing or invalid. The correct status code is 503 (Service Unavailable).

## Root cause

`src/app/api/payments/checkout/route.ts` lines 401–409: The error handling checked for exact strings `'Missing STRIPE_SECRET_KEY environment variable'` and `'Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET environment variable'`. However, `getPaymentEnv()` throws errors in the format `'Missing required payment environment variables: PAYPAL_CLIENT_ID'` — these never matched, so all credential errors fell through to the generic 500 response.

## Changes

1. **`src/app/api/payments/checkout/route.ts`**: Replaced exact-string error checks with `errorMessage.includes()` checks for each specific credential variable name (`STRIPE_SECRET_KEY`, `PAYPAL_CLIENT_ID`, etc.). This correctly handles both the `getPaymentEnv()` error format and payment provider API error formats.

2. **`tests/int/checkout-paypal-provider.int.spec.ts`** (new file): Added 4 integration tests covering:
   - PayPal checkout succeeds for valid products
   - PayPal API errors return 500 with `checkout_creation_failed`
   - Missing PayPal credentials return 503 with `payment_provider_not_configured` (the key regression test)
   - Super-admin exempt from rate limiting for PayPal checkout

## Files changed
- `src/app/api/payments/checkout/route.ts` — error detection fix
- `tests/int/checkout-paypal-provider.int.spec.ts` — new integration tests
