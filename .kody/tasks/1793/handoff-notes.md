## Issue #1793 - Posts page shows misleading "Search produced no results"

### What was fixed

The `PageRange` component (`src/ui/web/PageRange/index.tsx`) was showing "Search produced no results." whenever `totalDocs === 0`, even on plain list views where no search was performed. This was confusing for users visiting `/posts` with no posts.

### Root cause

The original condition `(typeof totalDocs === 'undefined' || totalDocs === 0)` triggered the search message unconditionally when there were zero items.

### Changes

1. **src/ui/web/PageRange/index.tsx** — Added `isSearch?: boolean` prop. When `isSearch=true` and `totalDocs===0`: shows "Search produced no results." When `isSearch` is false/undefined and `totalDocs===0`: shows "No {plural} yet."

2. **tests/unit/components/PageRange.test.tsx** — Added 6 tests covering:
   - List view with 0 posts → "No Posts yet."
   - List view with 0 docs → "No Docs yet."
   - List view with 0 courses → "No Courses yet."
   - Search with 0 results → "Search produced no results."
   - Showing range for first and second page of posts

The existing posts pages (`/posts`, `/posts/page/[pageNumber]`) don't pass `isSearch`, so they now correctly show "No Posts yet." instead of the misleading search message.
