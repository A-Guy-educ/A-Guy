# Plan: 260223-auto-97 — Fix VideoMedia Memory Leak

## Summary

Fix a memory leak in `VideoMedia` caused by an unmanaged `suspend` event listener. The `useEffect` attaches an anonymous handler without cleanup, leaking listeners on unmount/remount. Also fix implicit `muted` attribute to be explicit `muted={true}`.

**Root Cause**: The `useEffect` at line 16-24 of `src/ui/web/media/VideoMedia/index.tsx` calls `video.addEventListener('suspend', () => { ... })` with an inline anonymous function and never returns a cleanup function. On unmount, the listener stays attached to the DOM node. On remount, a new listener is added, accumulating orphaned listeners.

## Assumptions

- The unit test environment can be overridden per-file using Vitest's `@vitest-environment jsdom` docblock comment (standard Vitest feature).
- `@testing-library/react` (v16.3.1) and `jsdom` (v26.1.0) are available as dev dependencies.
- The test file will live in `tests/unit/ui/web/media/` to mirror the source structure.

---

## Step 1: Write Reproduction Tests for the Memory Leak and Implicit `muted`

**Time estimate**: 10-15 minutes

**Files to Touch**:
- `tests/unit/ui/web/media/VideoMedia.spec.tsx` (NEW)

**Root Cause**: See summary above. Three bugs: (1) no cleanup function returned from `useEffect`, (2) anonymous handler prevents `removeEventListener`, (3) `muted` is implicit (shorthand) instead of `muted={true}`.

**Reproduction Tests** (MUST FAIL before fix, PASS after):

### Test 1: Event listener cleanup on unmount
- **Test location**: `tests/unit/ui/web/media/VideoMedia.spec.tsx`
- **What it tests**: After rendering `VideoMedia` with a valid resource and then unmounting, `removeEventListener` should have been called with `'suspend'` and the same handler reference.
- **How**: Spy on `HTMLVideoElement.prototype.addEventListener` and `HTMLVideoElement.prototype.removeEventListener`. Render the component, then unmount it. Assert that `removeEventListener` was called with `('suspend', <function>)` where the function reference matches the one passed to `addEventListener`.
- **Why it fails now**: The current `useEffect` returns no cleanup function, so `removeEventListener` is never called.

### Test 2: Explicit `muted={true}` attribute
- **Test location**: `tests/unit/ui/web/media/VideoMedia.spec.tsx`
- **What it tests**: The rendered `<video>` element has `muted` set to `true` explicitly.
- **How**: Render the component, query the `<video>` element, and assert `video.muted === true`. (Note: this test may pass even before the fix because React treats shorthand `muted` the same as `muted={true}` at runtime. This test guards against regressions. The real check for FR-003 is source-code inspection, but we include this test for completeness.)
- **Why it may pass now**: React normalizes boolean attributes. The primary verification for FR-003 is a source grep assertion in the acceptance criteria.

### Test 3: No duplicate listeners on remount
- **Test location**: `tests/unit/ui/web/media/VideoMedia.spec.tsx`
- **What it tests**: Mount → unmount → mount the component. Assert `addEventListener('suspend', ...)` was called exactly twice (once per mount) and `removeEventListener('suspend', ...)` was called exactly once (once per unmount).
- **Why it fails now**: Without cleanup, `removeEventListener` call count is 0.

**Acceptance Criteria**:
- [ ] Test file exists at `tests/unit/ui/web/media/VideoMedia.spec.tsx`
- [ ] Running `pnpm test:unit -- tests/unit/ui/web/media/VideoMedia.spec.tsx` shows tests 1 and 3 FAILING (no `removeEventListener` call)
- [ ] Test 2 (muted attribute) may pass — that's acceptable

---

## Step 2: Fix the Memory Leak and Explicit `muted`

**Time estimate**: 10 minutes

**Files to Touch**:
- `src/ui/web/media/VideoMedia/index.tsx` (MODIFIED — lines 16-24 for useEffect, line 35 for muted)

**Root Cause**: Anonymous inline handler prevents cleanup; no cleanup function returned from `useEffect`.

**Fix** (three changes):

### Change A — FR-001 + FR-002: Stable handler + cleanup (lines 16-24)

Replace the current `useEffect`:

```typescript
useEffect(() => {
  const { current: video } = videoRef
  if (video) {
    video.addEventListener('suspend', () => {
      // setShowFallback(true);
      // console.warn('Video was suspended, rendering fallback image.')
    })
  }
}, [])
```

With:

```typescript
useEffect(() => {
  const { current: video } = videoRef
  if (video) {
    const handleSuspend = () => {
      // setShowFallback(true);
      // console.warn('Video was suspended, rendering fallback image.')
    }
    video.addEventListener('suspend', handleSuspend)
    return () => {
      video.removeEventListener('suspend', handleSuspend)
    }
  }
}, [])
```

Key details:
- `handleSuspend` is declared as a named const inside `useEffect` — stable reference for add/remove.
- Cleanup function returned calls `removeEventListener` with the same reference.
- The body of `handleSuspend` is unchanged (commented-out code preserved as-is per guardrails).

### Change B — FR-003: Explicit muted (line 35)

Change `muted` → `muted={true}` on line 35.

**Do NOT change**: `autoPlay`, `loop`, `playsInline` — spec says only `muted` must be explicit. Other boolean attributes MAY remain shorthand.

**Verification**:
- Run `pnpm test:unit -- tests/unit/ui/web/media/VideoMedia.spec.tsx` → all 3 tests PASS
- Run `pnpm tsc --noEmit` → no type errors
- Grep source: `grep 'muted={true}' src/ui/web/media/VideoMedia/index.tsx` → match found

**Acceptance Criteria**:
- [ ] (FR-001) A named `handleSuspend` function is declared inside `useEffect` and passed to `addEventListener` — verified by test 1
- [ ] (FR-002) `useEffect` returns a cleanup function calling `video.removeEventListener('suspend', handleSuspend)` — verified by tests 1 and 3
- [ ] (FR-003) JSX renders `muted={true}` — verified by grep on source file
- [ ] (NFR-001) Unmounting deallocates all event listeners — verified by tests 1 and 3
- [ ] No other behavior in VideoMedia is changed — verified by test 2 and visual code review
- [ ] TypeScript compiles: `pnpm tsc --noEmit` passes
- [ ] All reproduction tests pass: `pnpm test:unit -- tests/unit/ui/web/media/VideoMedia.spec.tsx`

---

## Test Implementation Notes for Build Agent

### Test File Template

```
tests/unit/ui/web/media/VideoMedia.spec.tsx
```

**Important**: Add `// @vitest-environment jsdom` as the first line of the test file (docblock comment) so Vitest uses jsdom for this specific file (the global unit test config uses `node` environment).

**Mocking strategy**:
- Mock `@/infra/utils/ui` to provide a passthrough `cn` function.
- Mock `@/infra/utils/getMediaUrl` to return the input string.
- Spy on `HTMLVideoElement.prototype.addEventListener` and `HTMLVideoElement.prototype.removeEventListener` using `vi.spyOn`.
- Use `@testing-library/react` `render` and `unmount` for component lifecycle.
- The `resource` prop should be an object like `{ filename: 'test.mp4', id: '1', mimeType: 'video/mp4', url: '/media/test.mp4', createdAt: '', updatedAt: '' }` matching the `Media` type shape (only `filename` is accessed, but TypeScript requires the full type — use `as any` cast if needed).

### Test Run Command

```bash
pnpm test:unit -- tests/unit/ui/web/media/VideoMedia.spec.tsx
```

---

## Final Verification Checklist

| Requirement | Verification | Test |
|---|---|---|
| FR-001: Stable handler | Source: named `handleSuspend` in useEffect | Test 1 (addEventListener spy) |
| FR-002: Cleanup function | Source: `return () => { video.removeEventListener(...) }` | Tests 1 & 3 |
| FR-003: Explicit muted | Source: `muted={true}` | grep + Test 2 |
| NFR-001: No residual listeners | removeEventListener called on unmount | Tests 1 & 3 |
| Guardrail: No logic change | Handler body unchanged | Code review |
| Guardrail: TypeScript | `pnpm tsc --noEmit` | CI |
