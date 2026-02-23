# Plan: 260223-auto-74 — Fix Memory Leak in VideoMedia Event Listener

## Summary

Fix a memory leak in `VideoMedia` where a `suspend` event listener is added to the `<video>` element inside a `useEffect` but never cleaned up. Each mount/unmount cycle accumulates duplicate listeners. The fix adds a cleanup return function to `removeEventListener` with the same handler reference.

**Task Type**: fix_bug
**Spec Requirements**: FR-001, FR-002, NFR-001, NFR-002

---

## Step 1: Write Reproduction Test for Event Listener Leak (FR-001)

**Root Cause**: In `src/ui/web/media/VideoMedia/index.tsx` (lines 16-24), the `useEffect` calls `video.addEventListener('suspend', () => { ... })` with an anonymous arrow function and returns no cleanup function. When the component unmounts and re-mounts, a new listener is added but the old one is never removed, causing listener accumulation (memory leak).

**Files to Touch**:

- `tests/unit/ui/web/media/VideoMedia.test.tsx` (NEW) — Reproduction test
- `src/ui/web/media/VideoMedia/index.tsx` (MODIFIED — lines 16-24) — Fix the useEffect

**Reproduction Test**: Write a test that demonstrates the bug (MUST FAIL before fix):

- **Test location**: `tests/unit/ui/web/media/VideoMedia.test.tsx`
- **Test 1 — `should remove suspend event listener on unmount`**:
  - Render the `VideoMedia` component with a valid `resource` object (`{ id: '1', filename: 'test.mp4', mimeType: 'video/mp4' }`)
  - Spy on `HTMLVideoElement.prototype.addEventListener` and `HTMLVideoElement.prototype.removeEventListener`
  - Unmount the component
  - Assert that `removeEventListener` was called with `'suspend'` and a function reference
  - **Why it fails now**: The current `useEffect` has no cleanup return, so `removeEventListener` is never called on unmount
- **Test 2 — `should have only one suspend listener after re-mount`**:
  - Render the component, unmount it, render it again
  - Track `addEventListener` calls for `'suspend'`
  - After the second mount, assert that `removeEventListener` was called once between mounts (on first unmount)
  - **Why it fails now**: Without cleanup, `removeEventListener` is never called, so each mount adds a new listener without removing the old one

**Test 3 — `should not throw when video element is null`** (NFR-001):
  - Render the component with `resource={null}` (which renders `null`, meaning no video element)
  - Assert the component renders without error (returns null)
  - This test should PASS both before and after fix (guard against regressions)

**Test 4 — `should render video with controls={false} and muted`** (FR-002):
  - Render the component with a valid resource
  - Assert the rendered `<video>` element does NOT have the `controls` attribute (since `controls={false}`)
  - Assert the rendered `<video>` element HAS the `muted` attribute
  - This test should PASS both before and after fix (no behavioral change needed for FR-002)

**Fix** (applied in same step — minimal change):

In `src/ui/web/media/VideoMedia/index.tsx`, lines 16-24, refactor the `useEffect`:

```
// BEFORE (buggy):
useEffect(() => {
  const { current: video } = videoRef
  if (video) {
    video.addEventListener('suspend', () => {
      // setShowFallback(true);
    })
  }
}, [])

// AFTER (fixed):
useEffect(() => {
  const { current: video } = videoRef
  if (!video) return

  // Handler stored in named reference for proper cleanup.
  // Without cleanup, duplicate listeners accumulate on re-mount.
  const handleSuspend = () => {
    // setShowFallback(true);
    // console.warn('Video was suspended, rendering fallback image.')
  }

  video.addEventListener('suspend', handleSuspend)

  return () => {
    video.removeEventListener('suspend', handleSuspend)
  }
}, [])
```

**Verification**:

- Run `pnpm vitest run tests/unit/ui/web/media/VideoMedia.test.tsx`
  - Tests 1 & 2 → FAIL before fix (no `removeEventListener` call)
  - Tests 1 & 2 → PASS after fix (cleanup properly removes listener)
  - Tests 3 & 4 → PASS before and after fix (guard tests)
- Run `pnpm tsc --noEmit` → no type errors

**Acceptance Criteria** (FR-001, FR-002, NFR-001, NFR-002):

- [ ] `useEffect` cleanup function calls `removeEventListener('suspend', handleSuspend)`
- [ ] Handler is stored as a named function inside the effect scope (not anonymous inline)
- [ ] Listener is only added when `videoRef.current` is truthy (early return if null)
- [ ] `controls={false}` remains on the `<video>` element (no change needed per FR-002)
- [ ] `muted` attribute remains on the `<video>` element
- [ ] Inline comment explains why cleanup is required (NFR-002)
- [ ] No changes to unrelated logic in the component
- [ ] All 4 tests pass
- [ ] `pnpm tsc --noEmit` passes with no errors

**Test Setup Notes for Build Agent**:

The test file needs:
- `// @vitest-environment jsdom` directive at the top
- Mock `@/infra/utils/ui` for `cn` (return args joined)
- Mock `@/infra/utils/getMediaUrl` to return the passed string
- Use `@testing-library/react` for `render`/`cleanup`/`unmount`
- Spy on `HTMLVideoElement.prototype.addEventListener` and `removeEventListener` using `vi.spyOn`
- Provide a minimal resource object matching the `Media` type from `@/payload-types` (needs at minimum `id`, `filename`, `mimeType` fields; use `as any` or type assertion for brevity)

**Estimated Time**: 15–25 minutes

---

## Quality Gates

After all steps:

1. `pnpm vitest run tests/unit/ui/web/media/VideoMedia.test.tsx` — all 4 tests pass
2. `pnpm tsc --noEmit` — no TypeScript errors
3. `pnpm lint` — no new lint warnings/errors

---

## Files Changed Summary

| File | Status | Lines Changed |
|------|--------|---------------|
| `src/ui/web/media/VideoMedia/index.tsx` | MODIFIED | Lines 16-24 (useEffect block) |
| `tests/unit/ui/web/media/VideoMedia.test.tsx` | NEW | ~80-100 lines |
