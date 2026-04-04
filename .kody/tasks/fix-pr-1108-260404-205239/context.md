
### build (2026-04-04T21:01:09)

The fix is complete. Here's a summary:

## Issue
Sorting chapters in the admin list using the up/down arrow buttons in `ChapterOrderCell` wasn't visually updating the list because `router.refresh()` only triggers Next.js server-side cache revalidation, which doesn't affect Payload's admin UI running in its own context.

## Fix
Changed `router.refresh()` to `window.location.reload()` in `src/ui/admin/ChapterOrderCell/index.tsx` (line 36).

## Changes Made
1. Replaced `router.refresh()` with `win
...(truncated)
