# Fix for #1988: Make coupon consumption retry-safe and tenant-scoped

## What was done

1. **Added `couponConsumedAt` field to Transactions** (`Transactions.ts`): `date`, optional, indexed. Provides independent idempotency for coupon consumption, decoupled from `entitlementsGrantedAt`.

2. **Decoupled coupon consumption from `entitlementsGrantedAt` guard** (both `webhooks/stripe/route.ts` and `webhooks/paypal/route.ts`): Coupon consumption now checks `couponConsumedAt` independently. On retry (when `entitlementsGrantedAt` is already set), consumption is still attempted if `couponConsumedAt` is null.

3. **Errors no longer swallowed**: If `consumeCouponOnPayment` throws, the error is re-thrown, causing the webhook to return 500 so the provider retries safely (entitlements are already granted via `entitlementsGrantedAt`).

4. **Tenant scoping in coupon lookup**: `consumeCouponOnPayment` now takes a `tenantId` parameter and adds `or: [{ tenant: { equals: tenantId } }, { tenant: { exists: false } }]` to the coupon lookup query. Global (tenant-less) coupons still match any tenant.

5. **New integration tests**: Added two tests in `payment-webhook-entitlements.int.spec.ts` asserting `couponConsumedAt` is set on successful consumption and tenant-specific coupons are consumed correctly.

## Why entitlements retry is safe
`entitlementsGrantedAt` is already idempotent — `grantProductEntitlements` is also idempotent, so re-running on retry causes no side effects. This allowed decoupling from coupon consumption.
