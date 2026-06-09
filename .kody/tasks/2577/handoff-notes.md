# Search Results Bug Fix — Task #2577

## What I did

Fixed the `/search` page so results appear when navigating directly with a query param (e.g., `/search?q=algebra`).

## Root cause

`Search` component (`src/ui/web/search/Component.tsx`) initialized its `value` state to `''` always. On mount at `/search?q=algebra`, the `useEffect` (with `debouncedValue=''`) fired and called `router.push('/search')` — stripping the query from the URL and hiding results.

## Fix

Added `useSearchParams` to read the initial `q` param and initialize state from it. The `useEffect` now sees the correct initial debounced value, so the URL is not overwritten on mount.

Changed in `src/ui/web/search/Component.tsx`:
- Added `useSearchParams` import from `next/navigation`
- Read `searchParams?.get('q') ?? ''` to get initial query
- Initialize `value` state with `initialQuery` instead of hardcoded `''`

## Files changed

- `src/ui/web/search/Component.tsx` — fix: initialize input value from URL
- `tests/e2e/search-page.e2e.spec.ts` — new E2E tests for the search page

## Verification

- TypeScript: `npx tsc --noEmit` passed (no errors)
- Lint: pre-existing warning only, no new issues
- Quality gates: `verify` tool returned `ok: true`
