# Fix: Search submission produces no visible results (Issue #2033)

## What was fixed

The Search component (`src/ui/web/search/Component.tsx`) had a bug where the `useEffect` hook included `router` in its dependency array. In Next.js 15, `useRouter()` can return a reference that changes between renders, causing the effect to fire unpredictably and disrupting the debounce mechanism.

## Root cause

```tsx
// BEFORE (buggy):
useEffect(() => {
  router.push(`/search${debouncedValue ? `?q=${debouncedValue}` : ''}`)
}, [debouncedValue, router])  // router in deps = unreliable
```

## Fix applied

Used a `useRef` to hold the router reference, updated via a separate effect. The main effect only depends on `debouncedValue`:

```tsx
// AFTER (fixed):
const routerRef = useRef(router)
useEffect(() => { routerRef.current = router }, [router])
useEffect(() => {
  routerRef.current.push(`/search${debouncedValue ? `?q=${debouncedValue}` : ''}`)
}, [debouncedValue])
```

## Files changed

- `src/ui/web/search/Component.tsx` - Fixed useEffect dependency

## Tests

- Created `tests/e2e/search.e2e.spec.ts` with two tests for search functionality
