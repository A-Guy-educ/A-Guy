# Gate Request

## 🚦 Risk Gate: Approval Required

This task has been classified as **medium risk** and is paused for review before building.

| Field | Value |
|-------|-------|
| **Control Mode** | risk-gated |
| **Risk Level** | medium |
| **Task Type** | fix_bug |
| **Confidence** | 0.95 |
| **Scope** | `VideoMedia component event listener memory leak fix`, `src/ui/web/media/VideoMedia/index.tsx` |

### Task Summary
> - [x] Fix VideoMedia event listener memory leak

### Assumptions
- The fix involves adding proper cleanup function to useEffect that removes the 'suspend' event listener
- TypeScript type errors related to 'controls' attribute were addressed with type assertion
- Test coverage was added to verify the fix

### Plan
```
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

```

---

Reply with `/cody approve` to proceed or `/cody reject` to cancel.
