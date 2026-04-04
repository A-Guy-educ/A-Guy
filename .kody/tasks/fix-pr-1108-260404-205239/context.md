
### build (2026-04-04T21:01:09)

The fix is complete. Here's a summary:

## Issue
Sorting chapters in the admin list using the up/down arrow buttons in `ChapterOrderCell` wasn't visually updating the list because `router.refresh()` only triggers Next.js server-side cache revalidation, which doesn't affect Payload's admin UI running in its own context.

## Fix
Changed `router.refresh()` to `window.location.reload()` in `src/ui/admin/ChapterOrderCell/index.tsx` (line 36).

## Changes Made
1. Replaced `router.refresh()` with `win
...(truncated)

### review (2026-04-04T21:07:26)
## Verdict: PASS

## Summary

The fix replaces `router.refresh()` with `window.location.reload()` in `ChapterOrderCell` to properly refresh Payload's admin UI after reordering chapters. The previous approach only triggered Next.js server-side cache revalidation, which doesn't affect Payload's admin context.

## Findings

### Critical

None.

### Major

None.

### Minor

None.

---

## Two-Pass Review

**Pass 1 — CRITICAL:**

### SQL & Data Safety
Not applicable — this is a frontend UI component.
...(truncated)

### review-fix (2026-04-04T21:11:22)
## Browser Verification Status

**Cannot complete browser verification** due to:
- MongoDB not running (Docker containers not available)
- `/admin` returns 500 without database

**Code verification completed:**
- TypeScript: PASS
- Lint: PASS  
- Code logic: `window.location.reload()` correctly forces full page refresh after reorder

The fix is correct - the previous implementation using `router.refresh()` only triggered Next.js cache revalidation which doesn't affect Payload's admin UI React st
...(truncated)
