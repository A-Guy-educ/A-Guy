# Plan: Fix Missing useEffect Dependency Arrays in Hero Components

**Task ID**: 260223-auto-29
**Task Type**: fix_bug
**Spec Requirements**: FR-001, FR-002, NFR-001

---

## Summary

The `PostHero` and `HighImpactHero` components call `useEffect(() => { setHeaderTheme('dark') })` **without a dependency array**. This causes `setHeaderTheme('dark')` to fire on every render, which triggers a state update in `HeaderThemeProvider`, which causes a re-render, leading to an infinite re-render loop and severe performance degradation.

The fix is trivial: add `[]` as the second argument to both `useEffect` calls.

---

## Assumptions

- The `useHeaderTheme` provider is already mocked/wrappable in tests via a simple React context mock.
- No other components are affected (spec says out of scope).
- `setHeaderTheme` is stable (wrapped in `useCallback` with `[]` deps in the provider — confirmed from source).

---

### Step 1: Fix PostHero useEffect Dependency Array

**Root Cause**: `useEffect` on line 10-12 of `src/ui/web/heros/PostHero/index.tsx` has no dependency array, causing it to fire on every render instead of only on mount.

**Files to Touch**:
- `src/ui/web/heros/PostHero/index.tsx` (MODIFIED — line 12: add `, []` before closing paren)
- `tests/unit/ui/web/heros/PostHero.test.tsx` (NEW — reproduction test)

**Reproduction Test**:
- **Test location**: `tests/unit/ui/web/heros/PostHero.test.tsx`
- **What it tests**: Renders `PostHero` twice (initial + re-render with new props) and verifies `setHeaderTheme` is called exactly once (on mount only), not on every render.
- **Why it fails before fix**: Without `[]`, the `useEffect` fires on every render, so `setHeaderTheme` is called 2+ times instead of 1.

**Test approach**:
```
// @vitest-environment jsdom
// 1. Mock `@/ui/web/providers/HeaderTheme` to return a vi.fn() for setHeaderTheme
// 2. Mock `@/ui/web/media` to return a simple div (avoid complex media deps)
// 3. Render <PostHero post={mockPost} />
// 4. Assert setHeaderTheme called exactly 1 time with 'dark'
// 5. Re-render with different props
// 6. Assert setHeaderTheme STILL called exactly 1 time (not 2)
//    → This assertion FAILS before fix, PASSES after
```

**Fix**: Change line 12 from `})` to `}, [])` — adding the empty dependency array.

**Verification**:
- Run `pnpm test:unit -- --testPathPattern PostHero` → test FAILS before fix (call count > 1)
- Apply fix → test PASSES (call count === 1)

**Acceptance Criteria** (FR-001, NFR-001):
- [ ] `useEffect(() => { setHeaderTheme('dark') }, [])` is present in PostHero
- [ ] Test confirms `setHeaderTheme` called exactly once on mount
- [ ] Test confirms re-render does NOT trigger additional `setHeaderTheme` calls

---

### Step 2: Fix HighImpact useEffect Dependency Array

**Root Cause**: `useEffect` on line 13-15 of `src/ui/web/heros/HighImpact/index.tsx` has no dependency array, same issue as PostHero.

**Files to Touch**:
- `src/ui/web/heros/HighImpact/index.tsx` (MODIFIED — line 15: add `, []` before closing paren)
- `tests/unit/ui/web/heros/HighImpactHero.test.tsx` (NEW — reproduction test)

**Reproduction Test**:
- **Test location**: `tests/unit/ui/web/heros/HighImpactHero.test.tsx`
- **What it tests**: Renders `HighImpactHero` twice and verifies `setHeaderTheme` is called exactly once.
- **Why it fails before fix**: Without `[]`, effect runs on every render, so call count exceeds 1.

**Test approach**:
```
// @vitest-environment jsdom
// 1. Mock `@/ui/web/providers/HeaderTheme` to return vi.fn() for setHeaderTheme
// 2. Mock `@/ui/web/Link` (CMSLink) and `@/ui/web/RichText` as simple pass-through components
// 3. Render <HighImpactHero richText={mockRichText} links={[]} />
// 4. Assert setHeaderTheme called exactly 1 time with 'dark'
// 5. Re-render with different props
// 6. Assert setHeaderTheme STILL called exactly 1 time
//    → This assertion FAILS before fix, PASSES after
```

**Fix**: Change line 15 from `})` to `}, [])` — adding the empty dependency array.

**Verification**:
- Run `pnpm test:unit -- --testPathPattern HighImpactHero` → test FAILS before fix
- Apply fix → test PASSES

**Acceptance Criteria** (FR-002, NFR-001):
- [ ] `useEffect(() => { setHeaderTheme('dark') }, [])` is present in HighImpactHero
- [ ] Test confirms `setHeaderTheme` called exactly once on mount
- [ ] Test confirms re-render does NOT trigger additional `setHeaderTheme` calls

---

### Step 3: TypeScript Compilation Verification

**Files to Touch**: None (verification only)

**Verification**:
- Run `pnpm -s tsc --noEmit` → must pass with zero errors
- Run `pnpm test:unit` → all tests pass (including both new test files)

**Acceptance Criteria** (spec AC):
- [ ] `tsc --noEmit` passes
- [ ] All unit tests pass

---

## Test Infrastructure Notes

- **Test runner**: Vitest with `vitest.config.unit.mts`
- **Test command**: `pnpm test:unit`
- **Environment directive**: Each test file needs `// @vitest-environment jsdom` comment at top (unit config defaults to `node`)
- **Test file location**: `tests/unit/ui/web/heros/` (matches `tests/unit/**/*.test.tsx` glob)
- **Mocking**: Use `vi.mock()` for `@/ui/web/providers/HeaderTheme`, `@/ui/web/media`, `@/ui/web/Link`, `@/ui/web/RichText`
- **Rendering**: Use `@testing-library/react` `render` and `rerender` pattern
- **Re-render pattern**: Use `rerender(<Component newProps />)` from `@testing-library/react` to trigger a second render cycle and prove the effect doesn't fire again

## Important Mock Details

The `setHeaderTheme` mock must be created as `vi.fn()` and returned from the mocked `useHeaderTheme` hook:

```typescript
const mockSetHeaderTheme = vi.fn()
vi.mock('@/ui/web/providers/HeaderTheme', () => ({
  useHeaderTheme: () => ({
    headerTheme: undefined,
    setHeaderTheme: mockSetHeaderTheme,
  }),
}))
```

For PostHero, also mock `@/ui/web/media`:
```typescript
vi.mock('@/ui/web/media', () => ({
  Media: () => <div data-testid="mock-media" />,
}))
```

For HighImpactHero, also mock:
```typescript
vi.mock('@/ui/web/Link', () => ({
  CMSLink: ({ children }: any) => <a>{children}</a>,
}))
vi.mock('@/ui/web/RichText', () => ({
  default: ({ data }: any) => <div>{JSON.stringify(data)}</div>,
}))
```

## Guardrails (from spec)

- ❌ Do NOT change the theme value (must remain `'dark'`)
- ❌ Do NOT modify any other logic in the useEffect callbacks
- ❌ Do NOT modify any other components
