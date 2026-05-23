# Task #1840 - Search No Results Bug Fix

## What I Did

Fixed the `/search` page where pressing Enter or clicking submit after typing a search query did not update the URL or display results.

## Root Cause

The Search component's form `onSubmit` handler only called `e.preventDefault()` without triggering the URL update. The URL only updated via the debounced `useEffect` (200ms delay after typing stops). When a user typed quickly and pressed Enter, the debounce hadn't fired yet, so the URL stayed at `/search` without the query parameter.

## Files Changed

1. **src/ui/web/search/Component.tsx** - Added immediate `router.push` call in the form's `onSubmit` handler and made the Input a controlled component by adding `value={value}`.

2. **tests/e2e/search-no-results-1840.e2e.spec.ts** - Added E2E test to reproduce and verify the fix.

## Key Changes in Component.tsx

- Added `name="search"` to the Input for accessibility
- Added `value={value}` to make the Input a controlled component
- Modified form's `onSubmit` handler to immediately call `router.push('/search?q=${encodeURIComponent(query)}')` instead of only calling `e.preventDefault()`
- The existing debounced `useEffect` continues to work for live search-as-you-type behavior

## Verification

- TypeScript typecheck: PASSED
- ESLint: PASSED (only pre-existing warnings)
- Prettier format: PASSED
- Quality gate (mcp__kody-verify__verify): PASSED
