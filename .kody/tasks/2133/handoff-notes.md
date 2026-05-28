## Issue #2133 — Send Purchase Confirmation Email After Webhook Payment Success

Implemented and verified. All 8 integration tests pass, typecheck passes, lint passes.

### What was built

- **`Transactions` collection** (`src/server/payload/collections/Transactions.ts`): Added `emailSentAt` date field (admin-readOnly, indexed) before refund audit fields.

- **Email templates** (`src/server/email/templates/purchase-receipt/`): Created `purchase-receipt.en.tsx` (English LTR) and `purchase-receipt.he.tsx` (Hebrew RTL) — React inline-styles templates with product name, amount, currency, transaction ID, payment date, purchase link, and optional coupon details. Barrel file at `index.ts` exports `PurchaseReceiptData` type.

- **Service** (`src/server/email/services/purchase-receipt-service.tsx`): `sendPurchaseReceipt(payload, options)` with idempotency check (`emailSentAt` already set → skip), no-op fallback when `payload.email` is unconfigured, error logging without throwing, and DB update of `emailSentAt` on success.

- **Stripe webhook** (`src/app/api/webhooks/stripe/route.ts`): Added `void sendPurchaseReceipt(...)` fire-and-forget call after coupon consumption in `checkout.session.completed` and `checkout.session.async_payment_succeeded` cases.

- **PayPal webhook** (`src/app/api/webhooks/paypal/route.ts`): Added `void sendPurchaseReceipt(...)` fire-and-forget call after coupon consumption in `PAYMENT.CAPTURE.COMPLETED` case.

- **Integration tests** (`tests/int/purchase-receipt-email.int.spec.ts`): 8 tests covering success, idempotency (replay no double-send), refund no-op, unpaid no-op, fire-and-forget error resilience.

### Key design decisions

- `payload.email as any` cast used to bypass TypeScript's `InitializedEmailAdapter` type (doesn't expose `.send()`) — safe since we're in the email service.
- No-op fallback: `if (!payload.email)` logs a warning and returns `false` — webhook still returns 200, payment + entitlements not affected.
- `userLocale` defaults to `'he'` — Users collection has no locale field yet.
- `formatDiscount` function was removed (unused) — was causing lint error.
- `userName` variable was removed (fetched but unused in template data) — was causing lint error.
