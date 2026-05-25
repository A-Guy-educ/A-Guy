## Fix Summary

**Issue**: #1990 - Search page gives no UI feedback after submit

**Root cause**: The `Search` component's `onSubmit` handler only called `e.preventDefault()` without triggering navigation. The `useEffect` that navigated via `router.push` depended on `debouncedValue` changing, but form submit doesn't update the `value` state — so clicking submit had no effect.

**Fix**: Modified `src/ui/web/search/Component.tsx` line 21-25 to navigate immediately on form submit:
```tsx
onSubmit={(e) => {
  e.preventDefault()
  const query = value.trim()
  router.push(`/search${query ? `?q=${query}` : ''}`)
}}
```

The debounce effect still handles the case where users type and wait, providing the same navigation behavior for both typing and explicit submit.

**Files changed**:
- `src/ui/web/search/Component.tsx` — added navigation to onSubmit handler
- `tests/e2e/verification/search-ui-feedback.e2e.spec.ts` — added regression test

**Verification**: Typecheck and lint passed. E2E test written but could not be executed locally (requires built Next.js server); designed to run in CI.
