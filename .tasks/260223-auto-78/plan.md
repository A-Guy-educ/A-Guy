# Plan: Fix VideoMedia Memory Leak (260223-auto-78)

**Task Type**: fix_bug
**Component**: `src/ui/web/media/VideoMedia/index.tsx`
**Estimated Total Time**: ~20 minutes (1 step)

## Summary

The `VideoMedia` React component has a memory leak: a `suspend` event listener is added via `addEventListener` inside a `useEffect` but never cleaned up. Additionally, the `<video>` tag uses an implicit `muted` attribute instead of explicit `muted={true}`, and lacks a `preload` attribute.

**Root Cause**: The `useEffect` at line 16-24 calls `video.addEventListener('suspend', ...)` but does not return a cleanup function. On unmount/remount, listeners accumulate.

---

## Step 1: Fix suspend listener cleanup + explicit video attributes

**Time**: ~20 minutes

### Root Cause

The `useEffect` hook (lines 16-24) adds an event listener with `addEventListener('suspend', ...)` but returns no cleanup function. Each mount adds a new listener, and unmount never removes it → orphaned listeners leak.

Additionally:
- `muted` (line 35) is used implicitly without `={true}` — can cause React hydration warnings.
- No `defaultMuted` attribute for cross-browser autoplay reliability.
- No `preload` attribute, meaning videos may buffer aggressively.

### Files to Touch

- `src/ui/web/media/VideoMedia/index.tsx` (MODIFIED — lines 16-24 for useEffect, lines 30-41 for video element attributes)
- `tests/unit/ui/web/media/VideoMedia.test.tsx` (NEW — reproduction test)

### Reproduction Test

Write a test that demonstrates the bug (MUST FAIL before fix):

- **Test location**: `tests/unit/ui/web/media/VideoMedia.test.tsx`
- **What it tests**: 
  1. That after unmounting `VideoMedia`, the `suspend` event listener is removed from the video element (currently it is NOT removed — test will fail).
  2. That the `<video>` element has explicit `muted={true}`, `preload` attribute, and includes `defaultMuted`.
- **Why it fails before fix**: The current `useEffect` never returns a cleanup function, so `removeEventListener` is never called. The `muted` attribute is implicit (not `muted={true}`). No `preload` attribute exists.

**Test details**:

```
// @vitest-environment jsdom
// Uses @testing-library/react: render, cleanup, act, unmount
// Mocks getMediaUrl to return a dummy URL

Test 1: "removes suspend event listener on unmount"
  - Spy on HTMLVideoElement.prototype.addEventListener and removeEventListener
  - Render VideoMedia with a valid resource object { filename: 'test.mp4' }
  - Assert addEventListener was called with 'suspend' + a handler function
  - Capture the handler reference
  - Unmount the component
  - Assert removeEventListener was called with 'suspend' + the SAME handler reference
  → FAILS before fix (removeEventListener never called)
  → PASSES after fix

Test 2: "video element has explicit muted, defaultMuted, and preload attributes"
  - Render VideoMedia with a valid resource object
  - Query the <video> element
  - Assert video.muted === true
  - Assert video.defaultMuted === true
  - Assert video.getAttribute('preload') is one of 'metadata' or 'none'
  → FAILS before fix (defaultMuted missing, preload missing)
  → PASSES after fix

Test 3: "does not add listener when resource is null"
  - Spy on addEventListener
  - Render VideoMedia with resource=null
  - Assert addEventListener was NOT called with 'suspend'
  → Should PASS before and after (sanity check)

Test 4: "renders video with correct source URL"
  - Render VideoMedia with resource { filename: 'test.mp4' }
  - Find the <source> element
  - Assert src contains '/media/test.mp4'
  → Should PASS before and after (no regression)
```

### Fix

Two changes to `src/ui/web/media/VideoMedia/index.tsx`:

**Change 1 — useEffect cleanup (lines 16-24)**:

Replace the current `useEffect` with one that either:
- **(Preferred — FR-001)** Removes the `addEventListener`/`useEffect` entirely and uses React's synthetic `onSuspend` prop on the `<video>` element. Since the handler body is entirely commented-out (no-op), the simplest correct fix is to use `onSuspend` on the JSX element as a no-op handler or remove the listener entirely. However, for future-proofing (the commented code suggests intent to re-enable), use `onSuspend` on the `<video>` tag.
- OR: Capture `videoRef.current` into a local variable inside the effect, return a cleanup function that calls `removeEventListener` with that captured variable.

**Recommended approach**: Since the handler is a no-op (all logic is commented out), switch to React's `onSuspend` prop on the `<video>` element. This avoids manual DOM manipulation entirely. Remove the `useEffect` block. Add `onSuspend` to the `<video>` JSX tag with an empty handler (or keep the commented-out logic as a comment above it for future reference). This satisfies FR-001's preference: "Prefer using React's synthetic `onSuspend` prop."

If the build agent prefers keeping `useEffect` (perhaps for more complex future logic), the alternative is:
```
useEffect(() => {
  const video = videoRef.current
  if (!video) return
  const handleSuspend = () => {
    // future: setShowFallback(true)
  }
  video.addEventListener('suspend', handleSuspend)
  return () => {
    video.removeEventListener('suspend', handleSuspend)
  }
}, [])
```

**Change 2 — video attributes (lines 30-41)**:

On the `<video>` JSX element:
- Change `muted` → `muted={true}` (FR-002)
- Add `defaultMuted={true}` (FR-002 — for cross-browser autoplay)  
  Note: `defaultMuted` is not in React's type definitions for `<video>`. Use a type assertion or spread: e.g., `{...{ defaultMuted: true }}` or cast.
- Add `preload="metadata"` (NFR-001 — since autoplay is used, `metadata` is appropriate; `none` would prevent autoplay from working)
- `playsInline` is already present (confirmed at line 37) — no change needed
- `'use client'` directive already present at line 1 (FR-003) — no change needed

### Acceptance Criteria (Spec Reference)

| Criterion | Spec Req | How Verified |
|---|---|---|
| `suspend` listener cleaned up on unmount | FR-001 | Test 1: removeEventListener called with correct handler |
| `muted={true}` explicit | FR-002 | Test 2: video.muted === true |
| `defaultMuted={true}` present | FR-002 | Test 2: video.defaultMuted === true |
| `preload` attribute present | NFR-001 | Test 2: getAttribute('preload') === 'metadata' |
| `playsInline` present | FR-002 | Already present, test 2 can verify playsInline === true |
| `'use client'` directive present | FR-003 | Already present (line 1), no test needed |
| No orphaned listeners after navigation | FR-001 | Test 1 proves cleanup on unmount |
| Existing functionality not broken | Guardrails | Test 4: source URL renders correctly |

### Run Tests

```bash
pnpm test:unit -- tests/unit/ui/web/media/VideoMedia.test.tsx
```

Then run full quality checks:
```bash
pnpm tsc --noEmit
pnpm lint
```

---

## Assumptions

1. **`defaultMuted` typing**: React's `VideoHTMLAttributes` may not include `defaultMuted`. The build agent should handle this via a type-safe spread pattern like `{...({ defaultMuted: true } as React.VideoHTMLAttributes<HTMLVideoElement>)}` or by adding a `// @ts-expect-error` comment with explanation, since `defaultMuted` is a valid HTML attribute.
2. **`preload="metadata"`** is chosen over `"none"` because the component uses `autoPlay`, and `preload="none"` may conflict with autoplay behavior.
3. **The onSuspend handler is a no-op**: Since all logic in the current suspend handler is commented out, the fix can safely use React's `onSuspend` prop with a no-op callback (or leave comments for future use).
4. **Testing library available**: `@testing-library/react` is installed (confirmed by usage in `tests/unit/ui/web/heros/PostHero.test.tsx`).
5. **jsdom environment**: Tests for React components use `// @vitest-environment jsdom` directive at the top of the test file.
