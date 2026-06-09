## Bug #2573 — Search results absent after query submission

### Root Cause
`src/ui/web/search/Component.tsx` initialized local state with `useState('')` — it never read the `?q=` URL parameter on mount. A `useEffect` then pushed the debounced value to the router on every render, including the initial one. This caused visiting `/search?q=algebra` to be immediately overwritten with `/search` (empty query), hiding the server-rendered results.

### Fix
- Added `useSearchParams` from `next/navigation` to read the initial `?q=` param
- Initialize local state from URL: `const initialQuery = searchParams.get('q') || ''`
- Set `value={value}` on the Input to make it a controlled component
- Guard the router push to only run when user has actively typed (non-empty `debouncedValue`), preventing the mount-time wipe

### Files Changed
- `src/ui/web/search/Component.tsx` — initialize state from URL, guard effect
- `tests/e2e/search-results-present.e2e.spec.ts` — new E2E repro test

### Test Notes
The repro test could not be executed locally (requires full dev environment with DB). TypeScript and lint both pass. The fix is minimal and well-scoped.
