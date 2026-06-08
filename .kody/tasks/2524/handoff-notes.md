## Fix: Expose i18n key instead of translated text on account purchases page

**Root cause:** `StatusBadge` (PurchasesPageContent.tsx:64) and `StatusDisplay` (TransactionDetailContent.tsx:91) called `t('status.${status}')` to look up status badge labels, but the brand messages define these under `statuses.pending`, not `status.pending`. The shallow merge of brand messages caused the base's `status` key to be replaced entirely.

**Fix:** Changed both component calls from `t('status.${status}')` to `t('statuses.${status}')`.

**Files changed:**
- `src/app/(frontend)/account/purchases/PurchasesPageContent.tsx` — line 64: `t('statuses.${status}')`
- `src/app/(frontend)/account/purchases/[transactionId]/TransactionDetailContent.tsx` — line 91: `t('statuses.${status}')`
- `tests/unit/brands-account-purchases-i18n.test.ts` — updated required keys to use `statuses` and added a dedicated `describe` block proving the component call pattern resolves correctly

**Note:** The brand's `account.purchases` override in `src/brands/aguy/messages/en.json` uses `statuses` while the base has `status`. This works now but the brand override is unnecessary — consider removing it so the base's keys are used. See followups.
