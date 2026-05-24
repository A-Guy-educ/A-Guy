# Fix for #1978: Admin Dashboard Recent Transactions 404

## What was done

**Root Cause**: The `RecentTransactionsWidget` component was calling `/api/collections/transactions?limit=5&sort=-createdAt&depth=2` which does not exist as an API route in the project.

**Fix Applied**:
1. Created new endpoint `src/app/api/admin/recent-transactions/route.ts` that:
   - Returns the 5 most recent transactions sorted by createdAt descending
   - Includes user email and product name via depth=2
   - Requires admin authentication (401 without auth, 403 for non-admin)
   - Returns `{ docs: Transaction[] }` format matching widget expectations

2. Updated `src/ui/admin/RecentTransactionsWidget/index.tsx` to call `/api/admin/recent-transactions` instead of the non-existent `/api/collections/transactions` endpoint

3. Added integration test `tests/int/admin-recent-transactions-1978.int.spec.ts` verifying:
   - 401 without auth
   - 403 for non-admin users
   - 200 with array of transactions for admin
   - Returns at most 5 transactions
   - Transactions include required fields (id, createdAt, amount, currency, status, user.email, product.name)
   - Transactions sorted by createdAt descending

## Files Changed
- `src/app/api/admin/recent-transactions/route.ts` (new)
- `src/ui/admin/RecentTransactionsWidget/index.tsx` (modified fetch URL)
- `tests/int/admin-recent-transactions-1978.int.spec.ts` (new)

## Verification
All quality gates pass (typecheck, lint, format). Integration tests are skipped in CI without DATABASE_URL but will run in environment with database.