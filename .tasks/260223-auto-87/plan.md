# Plan: Fix VideoMedia Memory Leak (260223-auto-87)

**Task Type**: fix_bug
**Component**: `src/ui/web/media/VideoMedia/index.tsx`
**Estimated Time**: 15-20 minutes (1 step)

## Summary

The `VideoMedia` component has a memory leak caused by an anonymous `suspend` event listener that is never removed on unmount. Additionally, the `muted` attribute uses implicit boolean shorthand. This plan fixes both issues with proper React `useEffect` cleanup patterns.

## Root Cause Analysis

In `src/ui/web/media/VideoMedia/index.tsx` (lines 16-24):

```tsx
useEffect(() => {
  const { current: video } = videoRef
  if (video) {
    video.addEventListener('suspend', () => {
      // anonymous handler — no reference to remove
    })
  }
  // No cleanup function returned!
}, [])
```

**Problems**:
1. **Memory leak (FR-001, FR-002)**: The anonymous function passed to `addEventListener` cannot be removed because there's no reference to it. No cleanup function is returned from the `useEffect`, so even if we had a reference, it wouldn't be cleaned up on unmount. Each mount adds another listener that is never removed.
2. **Implicit muted (FR-003)**: Line 35 uses `muted` shorthand instead of `muted={true}`, which can cause issues with testing libraries (e.g., `@testing-library/react` attribute assertions).

---

## Step 1: Fix event listener leak and muted attribute, add regression tests

### Root Cause
Anonymous inline handler in `addEventListener` with no `useEffect` cleanup causes listener accumulation on remount. Implicit `muted` shorthand is not explicit.

### Files to Touch

- `src/ui/web/media/VideoMedia/index.tsx` (MODIFIED — lines 16-24 and line 35)
- `tests/unit/components/VideoMedia.test.tsx` (NEW)

### Reproduction Test (write FIRST — must FAIL before fix)

**Test location**: `tests/unit/components/VideoMedia.test.tsx`

The test file must use `// @vitest-environment jsdom` directive (matching existing component test patterns like `McqQuestion.test.tsx`).

**Tests to write** (all should FAIL before the fix):

1. **Test: `muted` attribute is explicitly set to true**
   - Render `<VideoMedia>` with a valid resource object (`{ filename: 'test.mp4' }`)
   - Assert the `<video>` element has `muted` attribute set to `true` via `video.muted === true`.
   - **Purpose**: This test ensures the explicit `muted={true}` attribute is used. It might pass with the shorthand `muted` before the fix, acting as a regression guard for correct JSX attribute usage rather than a failing reproduction test for a functional bug.

2. **Test: `suspend` event listener is added and cleaned up on unmount**
   - Create spies on `HTMLVideoElement.prototype.addEventListener` and `removeEventListener`
   - Render `<VideoMedia>` with a valid resource
   - Assert `addEventListener` was called with `'suspend'` and a function reference
   - Unmount the component (via `cleanup()` or `unmount()`)
   - Assert `removeEventListener` was called with `'suspend'` and **the exact same function reference** that was passed to `addEventListener`
   - **Why it fails before fix**: Currently, no `removeEventListener` is ever called because there's no cleanup function in the `useEffect`. The spy on `removeEventListener` will show 0 calls with `'suspend'`. This test directly verifies the memory leak issue.

### Fix (apply AFTER tests are written and test 2 fails)

In `src/ui/web/media/VideoMedia/index.tsx`:

**Lines 16-24** — Replace the `useEffect` body:
- Define a named `const handleSuspend = () => { /* commented-out fallback logic */ }` inside the `useEffect`
- Only call `video.addEventListener('suspend', handleSuspend)` when `videoRef.current` is truthy
- Return a cleanup function: `return () => { video.removeEventListener('suspend', handleSuspend) }`
- Add an inline comment: `// Cleanup: remove listener to prevent accumulation on remount`
- Keep dependency array as `[]` (handler is defined inside the effect, videoRef is a ref — stable)

**Line 35** — Change `muted` to `muted={true}`

### Acceptance Criteria (spec requirement mapping)

- [ ] A stable named handler `handleSuspend` is defined inside the `useEffect` (not inline anonymous) — **FR-001**
- [ ] The `suspend` event listener is only added when `videoRef.current` is truthy — **FR-001**
- [ ] A cleanup function is returned that calls `removeEventListener('suspend', handleSuspend)` — **FR-002**
- [ ] The `<video>` element explicitly sets `muted={true}` — **FR-003**
- [ ] An inline comment explains why cleanup is required — **NFR-002**
- [ ] The fix follows idiomatic React patterns (`useEffect` with cleanup, correct deps) — **NFR-001**
- [ ] No unrelated logic is changed — **NFR-002**
- [ ] `removeEventListener` spy test FAILS before fix, PASSES after — **FR-002 verification**
- [ ] No TypeScript errors: `pnpm tsc --noEmit` passes
- [ ] Tests run: `pnpm vitest run tests/unit/components/VideoMedia.test.tsx`

### Mock Strategy

The test needs to mock:
- `@/infra/utils/getMediaUrl` — return a dummy URL string (e.g., `'/media/test.mp4'`)
- `@/infra/utils/ui` — return the `cn` utility (can re-export `clsx` or identity function)
- Use `vi.spyOn(HTMLVideoElement.prototype, 'addEventListener')` and `vi.spyOn(HTMLVideoElement.prototype, 'removeEventListener')` for listener tracking
- Provide a minimal resource object matching the `Media` type shape: `{ id: '1', filename: 'test.mp4', mimeType: 'video/mp4', url: '/media/test.mp4', createdAt: '', updatedAt: '' }` (check `payload-types.ts` for exact required fields)

### Verification Commands

```bash
# Run the specific test
pnpm vitest run tests/unit/components/VideoMedia.test.tsx

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint
```

---

## Assumptions

1. The `suspend` event handler body remains commented-out (matching existing code) — no functional change to handler logic.
2. The `useEffect` dependency array stays `[]` since `videoRef` is a React ref (stable identity) and `handleSuspend` is defined inside the effect.
3. JSdom environment supports `HTMLVideoElement` prototype spying for `addEventListener`/`removeEventListener`.
4. The minimal `resource` object shape needed for rendering can be determined from `payload-types.ts` Media type.

## Quality Gates

| Gate | Command | Expected |
|------|---------|----------|
| Unit tests | `pnpm vitest run tests/unit/components/VideoMedia.test.tsx` | All 3 tests pass |
| TypeScript | `pnpm tsc --noEmit` | No errors |
| Lint | `pnpm lint` | No new errors |
