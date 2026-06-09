## Fix: Search results area absent after query submission

### Root Cause
The `Search` component in `src/ui/web/search/Component.tsx` initialized its state to an empty string (`useState('')`) without reading the `q` query parameter from the URL. When navigating directly to `/search?q=algebra`:

1. Server renders results correctly based on `q=algebra` in searchParams
2. Client-side `Search` component mounts with empty state
3. Debounced effect fires after 200ms and pushes `/search` (no query), clearing the results

### Fix
- Added `useSearchParams` from `next/navigation` to read the initial `q` value
- Changed `useState('')` to `useState(searchParams.get('q') ?? '')` to initialize from URL
- Added `value={value}` to the `Input` to make it a controlled component showing the initial URL value

### Files Changed
- `src/ui/web/search/Component.tsx` — initialize state from URL `q` param
- `tests/e2e/verification/catalog-navigation.e2e.spec.ts` — added test for navigating to `/search?q=query`

### Note
`useSearchParams()` requires a `Suspense` boundary in the parent component tree. The Next.js App Router handles this automatically for pages. No changes needed to the page itself.