# Task 2277: Payment_stats has records but Transactions collection is empty

## What I Did

**Root cause identified:** The `syncPaymentStats` afterChange hook in `src/server/payload/collections/Transactions/hooks/syncPaymentStats-hook.ts` had an overly broad guard:

```typescript
// REMOVED (buggy):
if (!req?.context) { return doc }  // ← too aggressive
if (req.context._skipPaymentStatsUpsert) { return doc }
```

The first guard caused the hook to skip when `req.context` was undefined — which happens in webhook handlers (`handleEvent` in both `src/app/api/webhooks/stripe/route.ts` and `src/app/api/webhooks/paypal/route.ts`) because they call `payload.update()` without passing a `req` argument.

**Fix applied:** Removed the first guard, kept only the optional-chaining-safe loop-prevention guard:
```typescript
// FIXED:
if (req?.context?._skipPaymentStatsUpsert) { return doc }
```

This allows the hook to execute in webhook contexts where `req` is undefined or `req.context` is absent, while still preventing infinite loops via the `_skipPaymentStatsUpsert` context flag.

**Test added:** `tests/int/payment-stats.int.spec.ts` — "webhook-style pending→succeeded update (no req) creates PaymentStats row" — simulates a real webhook update by passing `req: undefined` explicitly.

## Files Changed

- `src/server/payload/collections/Transactions/hooks/syncPaymentStats-hook.ts` — removed buggy guard
- `tests/int/payment-stats.int.spec.ts` — added webhook-style test case

## Verified

- All 12 payment-stats integration tests pass
- TypeScript typecheck passes
- Lint passes
- Verify gates green

## Open Follow-up

The bug description says Transactions collection is empty while payment_stats has 8 transaction counts. My fix ensures the webhook path correctly updates payment_stats going forward, but does NOT explain why Transactions is empty. The 8 transaction counts (4 succeeded, 2 refunded, 2 failed) in payment_stats must have come from transaction records at some point — suggesting either: (1) transactions were deleted through admin access, or (2) a separate bug in transaction creation. Investigate whether a beforeDelete hook on Transactions is needed to prevent orphaned payment_stats rows.
