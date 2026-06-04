# Fix PayPal checkout 500 → 503 error (task 2403)

## What I did

**Root cause**: The route handler at `src/app/api/payments/checkout/route.ts` checked for exact string equality when matching missing-payment-credential errors. `getPaymentEnv()` throws `"Missing required payment environment variables: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET"` but the handler looked for `"Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET environment variable"`. No match → fell through to generic 500 `checkout_creation_failed` instead of 503 `payment_provider_not_configured`.

**Fix**: Changed lines 401-404 to use `.includes()` substring checks:
```typescript
if (
  errorMessage.includes('STRIPE_SECRET_KEY') ||
  (errorMessage.includes('PAYPAL_CLIENT_ID') && errorMessage.includes('PAYPAL_CLIENT_SECRET'))
)
```

This correctly returns 503 when PayPal or Stripe credentials are missing.

**Test**: Added `tests/int/checkout-paypal-provider-error.int.spec.ts` — reproduces the bug (500) and verifies the fix (503).

**Files changed**:
- `src/app/api/payments/checkout/route.ts` — error message check fix
- `tests/int/checkout-paypal-provider-error.int.spec.ts` — new integration test
