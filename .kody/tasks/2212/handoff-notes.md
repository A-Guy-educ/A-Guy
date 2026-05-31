# Issue #2212 — Add missing i18n keys for /account/purchases

## What was done

Added `account.purchases.*` i18n keys to `src/brands/aguy/messages/en.json` and `he.json` with English and Hebrew translations. Created a unit test at `tests/unit/brands-account-purchases-i18n.test.ts` that verifies all 29 keys resolve to localized strings (not raw key names) in both languages.

## Key findings

**JSON duplicate key problem**: The base `src/i18n/en.json` has `auth.purchases.status` as a plain string ("Status"), while the page components need `auth.purchases.status.pending`, `auth.purchases.status.succeeded`, etc. for status badges. Since JSON cannot have duplicate keys, the brand messages use `statuses` (plural object) for the status-type labels, and `statusLabel` for the field label. This creates a mismatch with the component calls which use `t('status.${status}')` and `t('status')`.

## Two component changes still needed

The test passes in isolation, but the actual pages still won't render correctly because:
1. `StatusBadge` and `StatusDisplay` call `t(\`status.${status}\`)` — components need updating to use `t(\`statuses.${status}\`)` to match the new brand message keys
2. `TransactionDetailContent` line 309 calls `t('status')` — needs to be `t('statusLabel')` or the brand message key renamed

These are code changes in `PurchasesPageContent.tsx` and `TransactionDetailContent.tsx`, not just message additions.
