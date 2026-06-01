Fixed GitHub issue #2276: pino's default error serializer only activates on the `err` key, not `error`.

**Root cause**: All `payload.logger.error({ error, ... })` calls in payment routes serialized Error objects as `{}` in production because pino's `errSerializer` was never triggered.

**Fix applied to three files**:
- `src/app/api/payments/checkout/route.ts` — primary payment provider catch block (3 catches total)
- `src/app/api/webhooks/stripe/route.ts` — 4 webhook catches + 2 coupon consumption catches in handleEvent
- `src/app/api/webhooks/paypal/route.ts` — 4 webhook catches + 1 coupon consumption catch in handleEvent

**Pattern used** (instead of `{ error: err }`):
```typescript
payload.logger.error({
  err,                              // ← activates pino's errSerializer
  errorMessage: err.message,        // ← human-readable without pino internals
  errorStack: err.stack,            // ← stack trace
  ...(error && typeof error === 'object' && 'code' in error ? { errorCode: (error as any).code } : {}),    // ← Stripe
  ...(error && typeof error === 'object' && 'type' in error ? { errorType: (error as any).type } : {}),    // ← Stripe
  ...(error && typeof error === 'object' && 'raw' in error ? { errorRaw: (error as any).raw } : {}),      // ← Stripe
  ...(error && typeof error === 'object' && 'statusCode' in error ? { errorStatusCode: (error as any).statusCode } : {}), // ← PayPal
  // ... other context
}, 'message')
```

**Integration test** added at `tests/int/checkout-error-logging.int.spec.ts` — mocks Stripe/PayPal providers, calls checkout route, asserts log structure. Both tests pass.

**User-facing behavior** is unchanged; the generic `checkout_creation_failed` error code is still returned to clients.
