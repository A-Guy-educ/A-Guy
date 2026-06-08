# Handoff Notes — Task 1524 CI Fix

## Root Cause

PR #1524 added references to `h.vgCallCount` (resetting the mock call counter) in three places inside `tests/int/lesson-duplication-orchestrator.int.spec.ts`, but never declared the `h` object. The file had `const { mockState } = vi.hoisted(...)` but no corresponding `const h = vi.hoisted(...)`.

## Fix Applied

Added the missing declaration in `tests/int/lesson-duplication-orchestrator.int.spec.ts` at line 42–43:

```typescript
// Tracks call count for tests that need to reset between runs
const h = vi.hoisted(() => ({ vgCallCount: 0 }))
```

This matches the identical pattern already used in the sibling test file `tests/int/lesson-duplication-orchestrator-none.int.spec.ts`.

## Files Changed

- `tests/int/lesson-duplication-orchestrator.int.spec.ts` — added `const h = vi.hoisted(...)` declaration

## Verification

- `tsc --noEmit` passes with zero errors for the test file
