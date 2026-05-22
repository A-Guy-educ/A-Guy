## Bug Fix: Posts page shows confusing "Search produced no results" on initial load

### What I did
Fixed the `PageRange` component (`src/ui/web/PageRange/index.tsx`) to only show "Search produced no results." when the `isSearchResult` prop is explicitly set to `true`.

### Root cause
The `PageRange` component was showing "Search produced no results." whenever `totalDocs === 0`, without distinguishing between:
1. An actual search that returned no results
2. A regular listing (like /posts) that happens to have no posts

### The fix
Added `isSearchResult?: boolean` prop to `PageRange`. The message only shows when `isSearchResult === true` and `totalDocs === 0`.

### Files changed
- `src/ui/web/PageRange/index.tsx` - Added `isSearchResult` prop and updated condition
- `tests/unit/components/PageRange.test.tsx` - New unit test file with 6 tests

### How it works now
- `/posts` page: Uses `PageRange` without `isSearchResult` (defaults to undefined/false), so no confusing message appears when there are no posts
- Search pages: Can pass `isSearchResult={true}` to show "Search produced no results." when appropriate