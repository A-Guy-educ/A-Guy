## Fix Summary

**Bug**: Lesson URL slugs contained unencoded spaces and literal " - Copy" artifacts (e.g., `/lessons/translate-local-lesson-4-en-196407 - Copy`).

**Root Cause**: The `Lessons` collection's `beforeChange` hook did not call `stripCopySuffix()` to clean up " - Copy" artifacts. When lessons are duplicated, the title becomes "Source Title - Copy", which via `formatSlugAsync` produces a slug like "source-title---copy". But if the slug is set via Payload's duplicate flow (copying the old slug), it could end up as "source-title-196407 - Copy" with a literal space.

The `stripCopySuffix()` function existed in `src/server/payload/fields/formatSlug.ts` but was never used in the Lessons hook.

**Fix**: Added `stripCopySuffix(data.slug)` call in `Lessons.ts` after the slug is cleaned by `formatSlug()` but before the uniqueness check. This ensures:
1. Spaces in slugs are first converted to hyphens by `formatSlug()`
2. " - Copy" artifacts (now "-copy" after slugify) are stripped by `stripCopySuffix()`
3. Uniqueness is computed on the clean base slug

**Files Changed**:
- `src/server/payload/collections/Lessons.ts` — added `stripCopySuffix` import and call in beforeChange hook
- `tests/unit/collections/formatSlug-integration.test.ts` — updated expected slug in test from `'first-lesson-copy'` to `'first-lesson'` (correct behavior)
- `tests/int/lesson-slug-copy-artifact.int.spec.ts` — new integration test reproducing the bug
