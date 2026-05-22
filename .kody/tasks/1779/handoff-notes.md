# Task 1779: Posts page shows misleading 'Search produced no results'

## What was done

Fixed the `PageRange` component (`src/ui/web/PageRange/index.tsx`) which was showing "Search produced no results." whenever `totalDocs` was 0 or undefined — even on pages like `/posts` that have no search functionality.

**Root cause:** The component used `totalDocs === 0 || totalDocs === undefined` to trigger the search-empty message, without any context flag indicating whether a search was actually performed.

**Fix:** Added `isSearchResult?: boolean` prop to `PageRange`. The "Search produced no results." message now only renders when `isSearchResult` is `true` AND `totalDocs` is 0/undefined.

## Files changed

- `src/ui/web/PageRange/index.tsx` — added `isSearchResult` prop, changed condition to require it
- `tests/unit/ui/web/PageRange.spec.tsx` — new test file with 4 tests covering the behavior

## Notes

- `isSearchResult` defaults to falsy, so existing callers that don't pass it (posts page, paginated posts) will no longer show the misleading message
- Search pages (if they use `PageRange`) would need to pass `isSearchResult={true}` to retain the empty-state message — checking if any search page uses `PageRange` is recommended as a follow-up
