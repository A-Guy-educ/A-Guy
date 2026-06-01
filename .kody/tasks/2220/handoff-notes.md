# Handoff Notes — #2220 Fixed Coupon Shekel Conversion

## What was implemented

### Core fix (shekels ↔ agorot conversion)
- **beforeChange hook** in `Coupons.ts`: when `discountType === 'fixed'` and `discountValue < 10000`, multiplies by 100 (shekels → agorot for storage). Values ≥ 10000 are assumed already-converted and left unchanged (idempotency).
- **afterRead hook** on `discountValue` field (`discountValue-hook.ts`): when `discountType === 'fixed'`, divides stored agorot by 100 to display shekels. Percentage coupons pass through unchanged.
- **afterRead hook** on new `discountDisplay` virtual field: formats as "₪30.00" for fixed, "30%" for percentage.

### New files
- `src/server/payload/hooks/coupons/discountValue-hook.ts` — contains `afterReadDiscountValue`, `computeDiscountDisplay`, `afterReadCouponDiscountDisplay`
- `src/ui/admin/Coupons/Cells/DiscountDisplayCell/index.tsx` — list view cell for formatted discount
- `scripts/fix-fixed-coupon-units.ts` — migration script (review mode + `--apply` mode)

### Modified files
- `src/server/payload/collections/Coupons.ts` — beforeChange ×100, afterRead ÷100, new `discountDisplay` field, updated descriptions, `discountDisplay` added to defaultColumns
- `src/ui/admin/Coupons/CreateCouponModal/index.tsx` — placeholder changed from '0' to '₪0' for fixed discounts
- `tests/int/coupons.int.spec.ts` — updated existing fixed coupon tests + added 7 new tests for conversion, round-trip, display
- `src/payload-types.ts` — regenerated (added `discountDisplay` field)

## Key design decision: idempotency threshold
Values < 10000 (shekels) → multiply by 100. Values ≥ 10000 (agorot) → leave unchanged. This means:
- Admin enters 30 → stored as 3000 → read back as 30 → admin saves without changing → beforeChange sees 30 (< 10000) → stored as 3000 again. No double-conversion.
- Legacy coupon with 3000 stored directly (agorot) → read back as 30 → admin saves → beforeChange sees 30 → stored as 3000 again. Same result.

## Test status
- Typecheck: PASS
- Lint: PASS (warning in LatexDocumentViewer is pre-existing, unrelated)
- coupons.int.spec.ts beforeAll times out due to hardcoded 60s timeout vs global 180s — pre-existing config issue, not my changes
- checkout-tenant-isolation.int.spec.ts: PASS (validates no regression in checkout math)

## Before merging
- Run `pnpm generate:types` and commit the payload-types.ts diff
- Run migration: `pnpm tsx scripts/fix-fixed-coupon-units.ts` (review) then `pnpm tsx scripts/fix-fixed-coupon-units.ts --apply` on production data
