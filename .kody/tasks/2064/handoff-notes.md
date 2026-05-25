# Issue #2064 Fix Summary

## Bug
/posts page title showed hardcoded "Payload Website Template Posts" instead of brand-driven title like "Posts | A-Guy".

## Root Cause
`posts/page.tsx` and `posts/page/[pageNumber]/page.tsx` used hardcoded strings in `generateMetadata()` instead of the `pageMetadata()` utility that applies the brand title template.

## Changes
- **src/app/(frontend)/posts/page.tsx**: Added `pageMetadata` import and changed `generateMetadata()` to return `pageMetadata({ title: 'Posts' })` instead of hardcoded title.
- **src/app/(frontend)/posts/page/[pageNumber]/page.tsx**: Same fix pattern — changed hardcoded title to `pageMetadata({ title: \`Posts — Page ${pageNumber || ''}\` })`.
- **tests/e2e/posts-page-title.e2e.spec.ts**: Added E2E test that asserts `/posts` page title is "Posts | A-Guy" and does NOT contain "Payload Website Template".

## Verification
- Typecheck: PASS
- Lint: PASS (pre-existing warnings unrelated to changes)
- Format: PASS
- Verify tool: PASS
