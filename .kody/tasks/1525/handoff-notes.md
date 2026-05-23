Resolved git merge conflicts from `git merge origin/dev` into PR #1525.

**layout.tsx conflict:** HEAD had hardcoded static `metadata` export; origin/dev had dynamic `generateMetadata()` using brand config. Took origin/dev's async approach (multi-brand compatible) and preserved the PR's static `viewport` export.

**LoginForm.tsx conflict:** HEAD added `safeValidate`/`emailSchema` imports and validation logic; origin/dev changed telescope SVG path from `@/ui/web/TelescopeLogo/telescope.svg` to `@/brands/aguy/assets/telescope.svg`. Kept both — merged validation utilities from HEAD with dev's brand asset path.

Typecheck and lint pass with no errors.
