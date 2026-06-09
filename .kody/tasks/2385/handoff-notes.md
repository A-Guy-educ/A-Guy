# Task 2385: Fix React Hydration Error #418 on Purchase Detail Page

## What was fixed

**Root cause**: The purchase detail page (`/account/purchases/[transactionId]`) was fetching transactions with `depth: 0`, which means the `product` relationship was not populated. This caused `productName` to always be `null`, resulting in "Unknown Product" being displayed.

**Changes made to `src/app/(frontend)/account/purchases/[transactionId]/page.tsx`**:

1. Changed `depth: 0` to `depth: 1` on the transaction fetch so the product relationship is populated
2. Restructured the try-catch block so that `notFound()` is called outside the catch block for both the transaction fetch and the authorization check - this ensures Next.js properly handles 404 rendering
3. Moved the entitlements fetch into its own try-catch so failures don't affect the main transaction display

**Created E2E test**: `tests/e2e/purchase-detail.e2e.spec.ts` - tests that product names display correctly without hydration errors

## Why this fixes the issue

- `depth: 1` populates the product relationship so `tx.product.name` is available
- Restructured notFound() calls ensure Next.js can properly render the 404 page
- Entitlements fetch failure is now non-fatal (transaction still displays)
