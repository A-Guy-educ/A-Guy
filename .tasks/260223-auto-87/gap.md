# Gap Analysis: 260223-auto-87

## Summary

- Gaps Found: 5
- Spec Revised: Yes

## Gaps Found

### Gap 1: Missing Event Listener Cleanup Function (CRITICAL)

**Severity:** Critical
**Location:** `src/ui/web/media/VideoMedia/index.tsx` lines 16-24
**Issue:** The spec (FR-002) requires a cleanup function that calls `removeEventListener` to prevent memory leaks, but the current implementation does NOT return any cleanup function from the useEffect. The memory leak described in the task still exists.
**Fix Applied:** Updated spec to clarify this is NOT YET IMPLEMENTED and requires action.

### Gap 2: Anonymous Event Handler Instead of Stable Reference

**Severity:** Critical
**Location:** `src/ui/web/media/VideoMedia/index.tsx` lines 19-22
**Issue:** FR-001 requires a stable handler function, but the code uses an anonymous inline function:
```tsx
video.addEventListener('suspend', () => {
  // handler
})
```
This cannot be properly removed with `removeEventListener` because each render creates a new function reference.
**Fix Applied:** Updated spec to clarify a named handler function must be defined inside useEffect.

### Gap 3: Missing Explicit Muted Attribute

**Severity:** High
**Location:** `src/ui/web/media/VideoMedia/index.tsx` line 35
**Issue:** FR-003 requires `muted={true}` but the code uses the shorthand `muted` (implicit boolean).
**Fix Applied:** Updated spec to clarify this change still needs to be implemented.

### Gap 4: Missing Inline Comment

**Severity:** Medium
**Location:** `src/ui/web/media/VideoMedia/index.tsx` lines 16-24
**Issue:** NFR-002 requires a short inline comment explaining why cleanup is required to avoid listener accumulation, but no such comment exists.
**Fix Applied:** Added to acceptance criteria.

### Gap 5: Missing Test Coverage

**Severity:** Medium
**Location:** No test file exists for VideoMedia component
**Issue:** The task.md mentions "Add comprehensive test coverage" as completed, but no tests exist for the VideoMedia component in the codebase.
**Fix Applied:** Updated spec to reflect test coverage as not yet implemented.

## Changes Made to Spec

- Clarified FR-001: Handler must be a named function defined inside useEffect, not an inline anonymous function
- Clarified FR-002: Cleanup function MUST be returned from useEffect to remove the event listener
- Clarified FR-003: `muted={true}` must be explicitly set (not shorthand `muted`)
- Added explicit acceptance criteria for inline comment (NFR-002)
- Added test coverage requirement to acceptance criteria
- Added verification that TypeScript compiles without errors

## Codebase Findings

The actual implementation in `src/ui/web/media/VideoMedia/index.tsx`:

```tsx
useEffect(() => {
  const { current: video } = videoRef
  if (video) {
    video.addEventListener('suspend', () => {
      // setShowFallback(true);
      // console.warn('Video was suspended, rendering fallback image.')
    })
  }
  // ❌ MISSING: return () => video.removeEventListener(...)
}, [])
```

**Required Fix Pattern** (from codebase patterns at `src/ui/web/header/Component.client.tsx`):

```tsx
useEffect(() => {
  const video = videoRef.current
  if (!video) return
  
  const handleSuspend = () => {
    // handler logic
  }
  
  video.addEventListener('suspend', handleSuspend)
  // Cleanup required to prevent memory leaks on unmount/remount
  return () => video.removeEventListener('suspend', handleSuspend)
}, [])
```

## Validation Notes

- TypeScript compiles without errors (no gap here)
- No test files exist for VideoMedia component
- The codebase follows the correct pattern for event listener cleanup in other components (e.g., HeaderClient, ChatInterface)
