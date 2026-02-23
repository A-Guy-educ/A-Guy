# Gate Request

## 🚦 Risk Gate: Approval Required

This task has been classified as **medium risk** and is paused for review before building.

| Field | Value |
|-------|-------|
| **Control Mode** | risk-gated |
| **Risk Level** | medium |
| **Task Type** | fix_bug |
| **Confidence** | 0.95 |
| **Scope** | `src/ui/web/media/VideoMedia/index.tsx`, `tests/unit/ui/web/media/VideoMedia.test.tsx` |

### Task Summary
> VideoMedia component added `suspend` event listeners without cleanup, accumulating on each navigation mount.

### Plan
```
# Plan: 260223-auto-38 — Fix VideoMedia suspend Event Listener Memory Leak

## Summary

The `VideoMedia` component attaches a `suspend` event listener inside a `useEffect` but never cleans it up. Each mount/unmount cycle (e.g., page navigation) adds a new listener without removing the old one, causing a memory leak. The fix is minimal: define the handler inside the effect, return a cleanup function that calls `removeEventListener` with the same reference.

## Assumptions

- The test environment for `tests/unit/**/*.test.tsx` files is `node` by default (per `vitest.config.unit.mts`), so we use the `// @vitest-environment jsdom` directive at the top of the test file.
- `@testing-library/react` and `jsdom` are already installed (confirmed in `package.json`).
- The `getMediaUrl` and `cn` utilities are irrelevant to the bug and will be mocked in tests.
- The `Props` type from `../types` includes `resource` which can be a full `Media` object, string, number, or null.

---

## Step 1: Write Reproduction Tests (RED phase)

**Time Estimate**: 15–20 minutes

**Files to Touch**:
```

---

Reply with `/cody approve` to proceed or `/cody reject` to cancel.
