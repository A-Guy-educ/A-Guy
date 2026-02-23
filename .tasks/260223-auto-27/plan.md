# Plan: Fix Missing useEffect Dependency Arrays in Hero Components

**Task ID**: 260223-auto-27
**Task Type**: fix_bug
**Spec Requirements**: FR-001, FR-002, NFR-001

---

## Summary

The `PostHero` and `HighImpactHero` components both call `setHeaderTheme('dark')` inside a `useEffect` that is **missing its dependency array**. Without a dependency array, `useEffect` runs after *every* render, causing:

1. `setHeaderTheme('dark')` to fire on every re-render (wasteful)
2. Potential infinite re-render loops if `setHeaderTheme` triggers state updates that cause re-renders

The fix: add `[]` (empty dependency array) to both `useEffect` calls so they run only once on mount. This matches the codebase pattern seen in `src/app/(frontend)/search/page.client.tsx`, `src/app/(frontend)/posts/[slug]/page.client.tsx`, etc.

---

## Step 1: Reproduce and Fix `PostHero` Missing Dependency Array

**Root Cause**: `useEffect` on line 10-12 of `src/ui/web/heros/PostHero/index.tsx` has no dependency array, so `setHeaderTheme('dark')` fires on every render instead of only on mount.

**Files to Touch**:
- `src/ui/web/heros/PostHero/index.tsx` (MODIFIED — line 12)
- `tests/unit/heros/PostHero.test.tsx` (NEW)

**Reproduction Test** (write FIRST — must FAIL before fix):

- **Test location**: `tests/unit/heros/PostHero.test.tsx`
- **Test**: `"should call setHeaderTheme('dark') only once on mount, not on re-render"`
- **How it works**:
  1. Create a mock `setHeaderTheme` function via `vi.fn()`
  2. Mock the `@/ui/web/providers/HeaderTheme` module so `useHeaderTheme` returns `{ headerTheme: null, setHeaderTheme: mockFn }`
  3. Also mock `@/ui/web/media` to return a simple `<div>` stub (avoid importing the full Media component)
  4. `render(<PostHero post={minimalPost} />)` — assert `mockSetHeaderTheme` was called exactly 1 time
  5. `rerender(<PostHero post={minimalPost} />)` — assert `mockSetHeaderTheme` is STILL called exactly 1 time (no extra call on re-render)
- **Why it fails NOW**: Without `[]`, the `useEffect` fires again on re-render so the mock will be called 2 times, not 1. The `expect(mockSetHeaderTheme).toHaveBeenCalledTimes(1)` assertion after `rerender` will FAIL.

**Fix**: Change line 12 from:
```tsx
  })
```
to:
```tsx
  }, [])
```

This is an empty dependency array `[]`, consistent with the spec's acceptance criteria (AC line 26: "includes `[]` as its second argument"). The `setHeaderTheme` function from context is stable (wrapped in `useCallback` with `[]` deps in the provider), so omitting it from deps is safe and matches the spec requirement.

**Verification**:
- Run reproduction test → FAILS before fix (called 2 times)
- After fix applied → PASSES (called 1 time)

**Acceptance Criteria** (FR-001, NFR-001):
- [x] `useEffect` in `PostHero` includes `[]` as second argument
- [x] `setHeaderTheme('dark')` still executes on mount
- [x] No extra calls on re-render

---

## Step 2: Reproduce and Fix `HighImpactHero` Missing Dependency Array

**Root Cause**: `useEffect` on line 13-15 of `src/ui/web/heros/HighImpact/index.tsx` has no dependency array, identical bug to Step 1.

**Files to Touch**:
- `src/ui/web/heros/HighImpact/index.tsx` (MODIFIED — line 15)
- `tests/unit/heros/HighImpactHero.test.tsx` (NEW)

**Reproduction Test** (write FIRST — must FAIL before fix):

- **Test location**: `tests/unit/heros/HighImpactHero.test.tsx`
- **Test**: `"should call setHeaderTheme('dark') only once on mount, not on re-render"`
- **How it works**:
  1. Create a mock `setHeaderTheme` function via `vi.fn()`
  2. Mock the `@/ui/web/providers/HeaderTheme` module so `useHeaderTheme` returns `{ headerTheme: null, setHeaderTheme: mockFn }`
  3. Mock `@/ui/web/Link` (CMSLink) and `@/ui/web/RichText` to return simple stubs
  4. `render(<HighImpactHero links={[]} richText={null} />)` — assert `mockSetHeaderTheme` called exactly 1 time
  5. `rerender(...)` — assert STILL called exactly 1 time
- **Why it fails NOW**: Same as Step 1 — without `[]`, the effect re-runs on re-render, so the count will be 2 after rerender.

**Fix**: Change line 15 from:
```tsx
  })
```
to:
```tsx
  }, [])
```

**Verification**:
- Run reproduction test → FAILS before fix (called 2 times)
- After fix applied → PASSES (called 1 time)

**Acceptance Criteria** (FR-002, NFR-001):
- [x] `useEffect` in `HighImpactHero` includes `[]` as second argument
- [x] `setHeaderTheme('dark')` still executes on mount
- [x] No extra calls on re-render

---

## Step 3: Verify No Regressions — TypeCheck & Lint

**Files to Touch**: None (validation only)

**Commands to Run**:
1. `pnpm tsc --noEmit` — ensure TypeScript compiles cleanly
2. `pnpm lint` — ensure linter passes (ESLint's `react-hooks/exhaustive-deps` rule should be satisfied with `[]`)
3. `pnpm vitest run tests/unit/heros/` — run both new tests to confirm green

**Acceptance Criteria**:
- [x] TypeScript compiles with no errors
- [x] Lint passes with no warnings on modified files
- [x] Both new tests pass
- [x] No regressions to visual rendering (logic inside useEffect unchanged — Guardrails)

---

## Test Details for Build Agent

### File: `tests/unit/heros/PostHero.test.tsx`

```
// @vitest-environment jsdom
// Mock dependencies before import
// vi.mock('@/ui/web/providers/HeaderTheme', ...) 
// vi.mock('@/ui/web/media', ...)
// Minimal post fixture: { id: '1', title: 'Test', heroImage: null, ... } (only required Post fields)
// Test 1: "calls setHeaderTheme dark on mount" - render, expect calledWith('dark'), calledTimes(1)
// Test 2: "does not call setHeaderTheme again on re-render" - render, rerender, expect calledTimes(1) 
```

### File: `tests/unit/heros/HighImpactHero.test.tsx`

```
// @vitest-environment jsdom
// Mock dependencies before import
// vi.mock('@/ui/web/providers/HeaderTheme', ...)
// vi.mock('@/ui/web/Link', ...)
// vi.mock('@/ui/web/RichText', ...)
// Test 1: "calls setHeaderTheme dark on mount" - render, expect calledWith('dark'), calledTimes(1)
// Test 2: "does not call setHeaderTheme again on re-render" - render, rerender, expect calledTimes(1)
```

---

## Assumptions

1. **`setHeaderTheme` is stable**: The provider wraps it in `useCallback([], [])`, so it doesn't change between renders. An empty `[]` dep array is safe.
2. **Spec says `[]` not `[setHeaderTheme]`**: The spec acceptance criteria explicitly says `[]`. Although `[setHeaderTheme]` would also work (since it's stable), we follow the spec literally.
3. **No existing hero tests**: No tests exist for these hero components. We create new test files.
4. **Minimal mocking**: We mock context providers and sibling components to keep tests focused on the useEffect behavior.

---

## Estimated Time

- Step 1: ~10 minutes (write test + one-line fix)
- Step 2: ~10 minutes (write test + one-line fix)
- Step 3: ~5 minutes (run checks)
- **Total: ~25 minutes**
