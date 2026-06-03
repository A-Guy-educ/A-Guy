## Fix: PayPal checkout 500 error → 503 on missing credentials

**Root cause**: `getPaymentEnv()` (src/lib/payment/env.ts:55) throws
`"Missing required payment environment variables: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET..."`
but the checkout route (src/app/api/payments/checkout/route.ts:403) only checked for the
exact string `"Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET environment variable"`.
Since the strings didn't match, the 500 `checkout_creation_failed` was returned instead of 503.

**Fix**: Changed the error detection in the route's catch block from exact string equality
to `includes()` checks on the error message, so any missing payment credential triggers the
correct 503 `payment_provider_not_configured` response.

**Files changed**:
- `src/app/api/payments/checkout/route.ts` — replaced exact-match error checks with
  `errorMessage.includes('PAYPAL_CLIENT_ID')` / `errorMessage.includes('STRIPE_SECRET_KEY')`
- `tests/int/paypal-checkout-error-handling.int.spec.ts` — new integration test that
  clears PayPal env vars, calls the route with `provider='paypal'`, and asserts 503+payment_provider_not_configured

**Note**: The same pattern exists in Stripe's `createPayPalOrder` which calls `getStripeClient()`
that also uses `getPaymentEnv()`. Stripe errors would be caught by the same fix since the
`getStripeClient()` path also throws from `getPaymentEnv()`.
