# Issue #2406 - React Hydration Error on Purchase Detail Page

## What was fixed

Two bugs causing React hydration mismatch (error #418) on `/account/purchases/[transactionId]` and `/account/purchases`:

### Bug 1: Wrong translation key
- **Root cause**: Both `StatusBadge` (PurchasesPageContent.tsx) and `StatusDisplay` (TransactionDetailContent.tsx) called `t('status.${status}')` but brand messages define `account.purchases.statuses.pending`, `statuses.succeeded`, etc. (plural 'statuses').
- **Effect**: The i18n t() function returned the raw key 'status.pending' when the translation was missing. If server and client resolved i18n at slightly different times or the fallback differed, the rendered text could diverge → hydration mismatch.
- **Fix**: Changed `t('status.${status}')` → `t('statuses.${status}')` in both files.

### Bug 2: toLocaleDateString non-determinism
- **Root cause**: `formatDate` used `new Date(iso).toLocaleDateString()` which produces different output between Node.js (server) and browser due to ICU data version differences and local timezone.
- **Effect**: Server-rendered date string could differ from client-rendered string → hydration mismatch.
- **Fix**: Replaced `toLocaleDateString` with manual UTC-based formatting using hardcoded month name arrays (both English and Hebrew).

## Files changed
- `src/app/(frontend)/account/purchases/PurchasesPageContent.tsx` — StatusBadge key fix + formatDate fix
- `src/app/(frontend)/account/purchases/[transactionId]/TransactionDetailContent.tsx` — StatusDisplay key fix + formatDate fix
- `tests/unit/components/StatusBadge.i18n-key.test.tsx` — new regression test

## Verification
- Unit tests: 251 files, 3342 tests passed (including new StatusBadge.i18n-key.test.tsx)
- Typecheck: passed
- Lint: passed (pre-existing warning in LatexDocumentViewer, unrelated)
- verify tool: ok=true
