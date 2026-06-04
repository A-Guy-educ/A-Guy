# Fix for #2435: Purchase detail shows Unknown Product and raw i18n key

## Changes Made

1. **depth: 0 → depth: 1** in `src/app/(frontend)/account/purchases/[transactionId]/page.tsx`
   - The product relationship was not being populated because `depth: 0` returns only IDs
   - Changed to `depth: 1` so the product object is populated and `productName`/`productSlug` are extracted correctly

2. **i18n key fix** in `StatusBadge` (PurchasesPageContent.tsx) and `StatusDisplay` (TransactionDetailContent.tsx)
   - Changed `t('status.${status}')` to `t('statuses.${status}')`
   - The brand messages use `statuses` (plural) at `account.purchases.statuses.*`, not `status` (singular)
   - This ensures the translation lookup finds the correct key in the merged messages

3. **Duplicate key fix** in `src/i18n/en.json` and `src/i18n/he.json`
   - Renamed duplicate `status` key (string value) to `statusLabel` to avoid JSON duplicate key issue
   - en.json: line 184 changed from `"status": "Status"` to `"statusLabel": "Status"`
   - he.json: line 207 changed from `"status": "סטטוס"` to `"statusLabel": "סטטוס"`

## Root Cause Analysis

**Unknown Product**: The page fetched transactions with `depth: 0`, so `tx.product` was an ID string rather than a populated object. The condition `typeof tx.product === 'object'` was false, so `productName` stayed null.

**Raw i18n key**: The brand messages have `account.purchases.statuses.pending` (and other statuses) but the component was looking up `account.purchases.status.pending`. Since `status` didn't exist under `account.purchases` in the merged messages, the `t()` function returned the raw key.
