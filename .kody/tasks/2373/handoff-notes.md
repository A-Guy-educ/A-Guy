## Bug #2373: Purchase detail shows 'Unknown Product'

### Root Cause
`src/app/(frontend)/account/purchases/[transactionId]/page.tsx` fetched the transaction with `depth: 0`, so `tx.product` was a string ID rather than a populated object. The product name extraction `typeof tx.product === 'object'` returned false, leaving `productName` null.

### Fix
Changed `depth: 0` → `depth: 1` (line 64 of page.tsx). The list page already used `depth: 1`, which is why it worked correctly while the detail page did not.

### Files Changed
- `src/app/(frontend)/account/purchases/[transactionId]/page.tsx` — one-line fix: `depth: 0` → `depth: 1`
- `tests/int/purchase-detail-product-name.int.spec.ts` — new integration test (3 cases: depth:1 extraction works, depth:0 bug docs the issue, slug extraction)

### Test Results
All 3 tests pass (typecheck, lint, and integration tests green).
