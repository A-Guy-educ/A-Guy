# Search Form Submit Bug Fix (#1897)

## What was done

Fixed the search form so that submitting a search query correctly displays results or the empty-state message.

## Root cause

The `Search` component (`src/ui/web/search/Component.tsx`) initialized its state to an empty string `''` but didn't read the initial query from the URL. When navigating to `/search?q=test`:
1. Server renders correctly with the query in the URL
2. Client mounts with `value = ''` (not reading `?q=test`)
3. `useEffect` with `router` in deps fires on mount and pushes `/search` (empty), overwriting the URL
4. Results never display because the URL is now `?q=` (truncated)

## Fix

- Added `useSearchParams` to read the initial query from the URL
- Added `useRef` (`hasMounted`) to skip the `useEffect` on initial mount — the URL is already correct from server render
- Added `value={value}` prop to the `Input` to sync the input display with state
- When user types, debounced value updates the URL as before

## Files changed

- `src/ui/web/search/Component.tsx` — Added URL param initialization and mount guard
- `tests/int/search-posts.int.spec.ts` — New integration test verifying `searchPosts` query function

## Verification

- All 3 search posts tests pass
- Typecheck passes
- Lint passes (no new warnings)