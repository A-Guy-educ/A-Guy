# Gate Request

## 🚦 Risk Gate: Approval Required

This task has been classified as **medium risk** and is paused for review before building.

| Field | Value |
|-------|-------|
| **Control Mode** | risk-gated |
| **Risk Level** | medium |
| **Task Type** | fix_bug |
| **Confidence** | 0.9 |
| **Scope** | `VideoMedia React component` |

### Task Summary
> Fix a memory leak in the `VideoMedia` React component caused by an improperly managed `suspend` event listener on a `<video>` DOM node. Currently, the component attaches an inline anonymous function on mount without returning a cleanup function, resulting in orphaned event listeners if the component unmounts and remounts. Additionally, the `<video>` tag uses an implicit `muted` attribute rather than an explicit `muted={true}`.

### Assumptions
- The VideoMedia component exists in the codebase
- The fix involves adding proper useEffect cleanup for the suspend event listener
- The fix involves changing implicit muted to explicit muted={true}

### Plan
```
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

```

---

Reply with `/cody approve` to proceed or `/cody reject` to cancel.
