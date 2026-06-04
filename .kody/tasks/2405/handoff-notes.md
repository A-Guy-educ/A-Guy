# Fix: PayPal Checkout HTTP 500 Error (Issue #2405)

## Root Cause

In commit `fe4683821` ("fix: switch PayPal API base on env flag + require webhook secrets at boot"), `PAYPAL_WEBHOOK_ID` was changed from `required: false` to `required: true` in `getPaymentEnv()`. This was intended to ensure webhook secrets were configured at boot time.

However, `PAYPAL_WEBHOOK_ID` is ONLY used by `verifyPayPalWebhook()` for verifying incoming PayPal webhook signatures — it is NOT used by `createPayPalOrder()` or any checkout-related function.

The checkout flow calls:
`createPayPalOrder()` → `getPayPalAccessToken()` → `getPayPalApiBase()` → `getPaymentEnv()`

When `PAYPAL_WEBHOOK_ID` was missing, `getPaymentEnv()` threw with "Missing required payment environment variables: PAYPAL_WEBHOOK_ID". This error message does not match the specific strings checked in the checkout route's catch block (`"Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET..."`), so it returned a generic HTTP 500 instead of a proper 503.

## Fix

Changed `required: true` → `required: false` for `PAYPAL_WEBHOOK_ID` in `src/lib/payment/env.ts`.

The webhook handler (`verifyPayPalWebhook` in `src/lib/payment/paypal.ts`) already has its own explicit null-check: `if (!paypalWebhookId) throw new Error('Missing PAYPAL_WEBHOOK_ID environment variable')`. This ensures that webhook verification still fails with a clear error when the ID is missing.

## Files Changed

- `src/lib/payment/env.ts` — made `PAYPAL_WEBHOOK_ID` optional
- `tests/unit/lib/payment/env.spec.ts` — updated test to expect no throw when webhook ID is missing
- `tests/unit/lib/payment/paypal.spec.ts` — updated test to expect error from `verifyPayPalWebhook` directly (not from `getPaymentEnv()`)

## Verification

All 3337 tests pass, typecheck passes, lint passes.
