# Fix for Issue #2459: Pending purchase shows 'Unknown Product'

## Root Cause
The transaction detail page (`src/app/(frontend)/account/purchases/[transactionId]/page.tsx`) was fetching the transaction with `depth: 0`, which does NOT populate the `product` relationship. This caused `tx.product` to be a string ID instead of a populated object, and the productName extraction failed.

## Fix
Changed `depth: 0` to `depth: 1` on line 64 of `[transactionId]/page.tsx`. This matches the API route (`src/app/api/account/transactions/[id]/route.ts`) which already uses `depth: 1`.

## Files Changed
- `src/app/(frontend)/account/purchases/[transactionId]/page.tsx`: Changed `depth: 0` to `depth: 1` when fetching transaction
- `tests/int/transaction-detail-product-name.int.spec.ts`: New integration test documenting the bug and verifying the fix

## Verification
- Integration test passes (2 tests: verifies depth:1 fix works, documents depth:0 bug)
- Quality gates pass (typecheck, lint, tests)
