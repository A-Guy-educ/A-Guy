## #2526 — Transaction amount displayed as raw integer

### What
- Amount column in `/admin/collections/transactions` showed raw agorot integers (e.g. `3900`) instead of formatted currency (e.g. `₪39.00`).

### Root cause
- The `amount` field in `Transactions.ts` had no `admin.components.Cell` override, so Payload rendered the raw number type.

### Fix
1. **Created** `src/ui/admin/TransactionAmountCell/index.tsx` — a Payload admin list Cell component that formats `amountAgorot / 100` with `₪` symbol and 2 decimal places for ILS, falls back to `{amount} {currency}` for other currencies.
2. **Updated** `src/server/payload/collections/Transactions.ts` — added `components: { Cell: '@/ui/admin/TransactionAmountCell#TransactionAmountCell' }` to the `amount` field's `admin` block.
3. **Added** `tests/unit/ui/admin/transaction-amount-cell.spec.ts` — unit test asserting the cell component is wired in the collection config.

### Files changed
- `src/ui/admin/TransactionAmountCell/index.tsx` (new)
- `src/server/payload/collections/Transactions.ts` (amount field admin block)
- `tests/unit/ui/admin/transaction-amount-cell.spec.ts` (new)

### Verification
- `pnpm test:unit` — all 255 test files pass (3361 tests)
- `pnpm lint` — clean
- `npx tsc --noEmit` — clean
