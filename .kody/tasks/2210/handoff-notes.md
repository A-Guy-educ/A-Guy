# Issue #2210 - Resolve product item titles instead of rendering raw objects

## What was fixed

**Root cause**: `queryProductBySlug` used `depth: 1`, which populated `items[].lesson` as `{ id }` only — no `title`. When `ProductDetailContent.tsx` accessed `itemObj.lesson?.title`, it was `undefined`, and the fallback `String(item)` produced `[object Object]`.

**Changes made**:
1. `src/server/repos/queries/products.ts` — changed `depth: 1` → `depth: 2` in `queryProductBySlug`. `queryActiveProducts` was intentionally left at `depth: 1` since the product list page does not display items.
2. `src/i18n/en.json` and `src/i18n/he.json` — added `products.items.unnamed` translation key for orphaned items (lesson deleted or title unavailable).
3. `src/app/(frontend)/products/[slug]/ProductDetailContent.tsx:106` — replaced `String(item)` fallback with `t('items.unnamed')`.
4. `tests/int/product-billing.int.spec.ts` — added test case `queryProductBySlug should return lesson titles for items at depth 2` to prevent regression. DB was unavailable in this environment so the test was not run.

## Note
Integration test for the depth change could not be executed in this environment (MongoDB container not available). The test logic is correct — it creates a lesson-type ProductItem, links it to a product, and asserts `lesson.title` is a non-empty string at depth 2.
