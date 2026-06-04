# Issue #2395 — Mark derived coupon fields as read-only in admin

## What was done

Fixed 4 fields in `src/server/payload/collections/Coupons.ts` that were virtual computed fields (with `afterRead` hooks) but were missing `admin: { readOnly: true }`, causing them to render as editable inputs in the admin UI instead of read-only labels.

## Changes

- **`src/server/payload/collections/Coupons.ts`**: Added `readOnly: true` to the `admin` config of:
  - `status` (afterRead: `afterReadCouponStatus`)
  - `usageDisplay` (afterRead: `afterReadCouponUsageDisplay`)
  - `expiresDisplay` (afterRead: `afterReadCouponExpiresDisplay`)
  - `discountDisplay` (afterRead: `afterReadCouponDiscountDisplay`)

- **`tests/int/coupons.int.spec.ts`**: Added 4 unit tests in a new `Derived fields admin readOnly config` describe block that assert each of the 4 fields has `admin.readOnly === true`.

## Pattern followed

Mirrored the existing `usesCount` field in the same collection which already had `admin: { readOnly: true }` set, as well as similar patterns in `Users/index.ts`, `Transactions.ts`, and other collections.

## Verification

- TypeScript typecheck passes
- All 4 new tests pass (verified with `vitest run --test-name-pattern "Derived fields admin readOnly"`)
- Full quality gates pass via `verify` tool
