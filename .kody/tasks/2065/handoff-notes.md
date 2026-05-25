# Fix: /posts/page/1 redirects to /posts

## What

Modified `src/app/(frontend)/posts/page/[pageNumber]/page.tsx` to redirect `/posts/page/1` to `/posts` since page 1 is semantically equivalent to the main posts page.

## Why

The issue reported that navigating to `/posts/page/1` returned a 500 error. The fix redirects page 1 to `/posts` to avoid duplicate content issues and ensure users land on the canonical URL.

## Changes

1. Added `redirect` to import from `next/navigation`
2. Added redirect check: `if (sanitizedPageNumber === 1) { redirect('/posts') }`
3. Updated `generateStaticParams` to skip page 1 (since it redirects)

## Test

Created `tests/int/posts-pagination-redirect.int.spec.ts` with integration test for the redirect behavior.