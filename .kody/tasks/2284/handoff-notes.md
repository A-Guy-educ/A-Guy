# Issue #2284 - What's Included list renders [object Object]

## Investigation Summary

Issue #2284 describes a bug where the "What's Included" list on `/products/7th-grade-prep-math` renders '[object Object]' instead of readable content.

## Root Cause

The bug was caused by `queryProductBySlug` using `depth: 1`, which only populated `items[].lesson` as `{ id }` without the `title` field. When `ProductDetailContent.tsx` accessed `itemObj.lesson?.title`, it returned `undefined`, and the fallback `String(item)` produced '[object Object]'.

## Fix Already Applied

Commit `e943abda4` (merged 2026-05-31, **before** issue was created on 2026-06-01) applied the fix:

1. `src/server/repos/queries/products.ts`: Changed `depth: 1` → `depth: 2` in `queryProductBySlug`
2. `src/app/(frontend)/products/[slug]/ProductDetailContent.tsx:106`: Replaced `String(item)` fallback with `t('items.unnamed')`
3. `src/i18n/en.json` and `src/i18n/he.json`: Added `products.items.unnamed` translation key ("Unnamed item" / "פריט ללא שם")

## Current Code (line 106)

```tsx
{itemObj.lesson?.title ?? itemObj.featureKey ?? t('items.unnamed')}
```

## Conclusion

No code changes were needed. The fix was already merged before the issue was created. The issue was likely opened based on QA testing of an environment not yet updated with the fix. Quality gates pass (`pnpm ci:local`).

## Files Touched

None — fix was already in place.
