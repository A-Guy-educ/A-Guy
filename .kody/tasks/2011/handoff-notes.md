# Fix #2011: Fail-closed tenant guard in checkout

## What was done

**Bug**: The tenant isolation guard in `src/app/api/payments/checkout/route.ts` used an expression `productTenantId !== null && userTenantId !== null && productTenantId !== userTenantId` that short-circuits when `userTenantId === null`, silently allowing null-tenant users to purchase any tenant's products.

**Root cause**: `optionalTenantField` does not auto-populate on create, so users can exist with `tenant: null`. The AND-chain guard fails to catch the null-tenant case.

**Fix**: Added explicit null-tenant checks before the cross-tenant checks for both product and coupon tenant guards:

- `route.ts:118`: `if (productTenantId !== null && userTenantId === null) → 404 product_not_found`
- `route.ts:268`: `if (couponTenantId !== null && userTenantId === null) → 400 invalid_coupon`

**Tests added** (`tests/int/checkout-tenant-isolation.int.spec.ts`):
- `studentUserNullTenantId` / `studentUserNullTenantEmail` fixture (no tenant set)
- Test 4: null-tenant user buys tenant-scoped product → 404
- Test 5: null-tenant user uses tenant-scoped coupon → 400
- Test 6: null-tenant user buys global product → 200 (no regression)

**Diagnostic script**: `scripts/diagnose-null-tenant-users.ts` — paginated scan of users with `tenant` not set, excludes super-admins, exits 0 if none found.

## Preserved behaviors
- Super-admin bypass unchanged
- Global/tenant-less products still accessible to all users
- Same-tenant checkout unchanged
- Cross-tenant blocks from #1727 unchanged
