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
- `tests/unit/ui/web/media/VideoMedia.test.tsx` (NEW)

**Root Cause**: The `useEffect` in `VideoMedia` (line 16–24 of `src/ui/web/media/VideoMedia/index.tsx`) calls `video.addEventListener('suspend', () => { ... })` with an anonymous arrow function and never returns a cleanup function. On unmount, the listener is never removed. On re-mount, a second identical listener is added.

**Reproduction Tests**: Create 8 tests that demonstrate the bug and edge cases. The tests use `@testing-library/react` `render` and `unmount` to mount/unmount the component, and spy on `addEventListener` / `removeEventListener` on the `<video>` element.

Tests that MUST FAIL before the fix:
1. **"listener is added when component mounts"** — spy on `HTMLVideoElement.prototype.addEventListener`, render component with valid resource, assert `addEventListener` called with `'suspend'` and a function. **Should PASS even before fix** (listener IS added, just not cleaned up).
2. **"listener is removed when component unmounts"** — render then unmount, assert `removeEventListener` called with `'suspend'`. **FAILS before fix** — no cleanup function exists.
3. **"no duplicate listeners after re-render"** — render, trigger re-render (e.g., update props), assert `addEventListener` called only once for `'suspend'`. **Should PASS before fix** (effect has `[]` deps).
4. **"no duplicate listeners after navigation away and back"** — render, unmount, render again, count `addEventListener` calls with `'suspend'` — should be exactly 2 (one per mount). Before fix: 2 adds, 0 removes → leaked listeners. **FAILS before fix** because test also checks `removeEventListener` was called between cycles.
5. **"safety when videoRef.current is null on mount"** — render with `resource` as `null`, ensure no `addEventListener` calls and no crash. **Should PASS before fix** (null check on line 18 exists).
6. **"safety when videoRef.current becomes null after mount"** — render with valid resource, then simulate ref becoming null during cleanup. **FAILS before fix** — no cleanup function to test.
7. **"cleanup is called with correct handler reference"** — render, unmount, assert that the exact function reference passed to `addEventListener` is the same one passed to `removeEventListener`. **FAILS before fix** — no `removeEventListener` call.
8. **"multiple mount/unmount cycles don't accumulate listeners"** — mount/unmount 5 times, verify `addEventListener` count equals `removeEventListener` count for `'suspend'`. **FAILS before fix** — `removeEventListener` count is 0.

**Key Implementation Details for Tests**:
- Use `// @vitest-environment jsdom` directive at top of file.
- Mock `@/infra/utils/getMediaUrl` to return a simple string.
- Mock `@/infra/utils/ui` to provide a passthrough `cn` function.
- Create a mock `resource` object satisfying `Media` type: `{ filename: 'test.mp4', id: '1', url: '/media/test.mp4', mimeType: 'video/mp4', ... }` with required fields.
- Spy on `HTMLVideoElement.prototype.addEventListener` and `HTMLVideoElement.prototype.removeEventListener`.
- Use `(call: any[])` type annotations on `spy.mock.calls.filter(...)` callbacks to avoid TS7006 errors per NFR-001.
- Restore spies in `afterEach`.

**Acceptance Criteria**:
- [ ] File `tests/unit/ui/web/media/VideoMedia.test.tsx` exists with 8 test cases
- [ ] Tests 2, 4, 6, 7, 8 FAIL when run against the unmodified component
- [ ] Tests 1, 3, 5 PASS against the unmodified component
- [ ] All tests have proper TypeScript type annotations (no TS7006 errors)
- [ ] `pnpm test:unit -- --config ./vitest.config.unit.mts tests/unit/ui/web/media/VideoMedia.test.tsx` runs without type errors

**Test Command**:
```bash
pnpm test:unit -- tests/unit/ui/web/media/VideoMedia.test.tsx
```

---

## Step 2: Fix the Event Listener Leak (GREEN phase)

**Time Estimate**: 5–10 minutes

**Files to Touch**:
- `src/ui/web/media/VideoMedia/index.tsx` (MODIFIED — lines 16–24)

**Root Cause**: Lines 16–24 define a `useEffect` that:
1. Gets `videoRef.current`
2. If it exists, adds an anonymous `suspend` event listener
3. Returns **nothing** (no cleanup)

**Fix**: Minimal change to the `useEffect` block:
1. Define the handler as a **named const inside the effect** (not outside), e.g., `const handleSuspend = () => { /* existing comment body */ }`
2. Capture `videoRef.current` into a local `video` variable (already done on line 17)
3. Add listener: `video.addEventListener('suspend', handleSuspend)`
4. Return cleanup function: `return () => { video.removeEventListener('suspend', handleSuspend) }`
5. Add a brief inline comment explaining why cleanup is needed (per NFR-001): `// Cleanup: remove listener to prevent accumulation across mount cycles`
6. Keep the null check on `video` in the cleanup too (guard against edge cases)

**Exact behavioral change**:
- BEFORE: `useEffect` adds listener, never removes → memory leak
- AFTER: `useEffect` adds listener, returns cleanup that removes it → no leak

**What NOT to change**:
- Do NOT change the dependency array (`[]`) — it's correct
- Do NOT change JSX rendering, props, or any other logic
- Do NOT change imports

**Verification**:
- [ ] All 8 tests from Step 1 now PASS
- [ ] `pnpm -s tsc --noEmit` passes (no type errors)
- [ ] Component still renders `<video>` element with correct attributes
- [ ] No unrelated changes in the file

**Test Command**:
```bash
pnpm test:unit -- tests/unit/ui/web/media/VideoMedia.test.tsx && pnpm -s tsc --noEmit
```

---

## Spec Requirement Traceability

| Requirement | Plan Step | Verification |
|---|---|---|
| FR-001: Event listener cleanup | Step 2 | Tests 2, 7, 8 pass |
| FR-002: Null-reference safety | Step 2 (guard already exists + add to cleanup) | Tests 5, 6 pass |
| FR-003: Idiomatic React | Step 2 (correct deps, no duplicate listeners) | Tests 3, 4 pass |
| FR-004: 8 test cases | Step 1 | All 8 tests exist and pass after fix |
| NFR-001: Inline comment + type annotations | Steps 1 & 2 | Code review + `tsc --noEmit` |

---

## Guardrails Checklist

- [ ] Only `src/ui/web/media/VideoMedia/index.tsx` is modified (no other component changes)
- [ ] Fix is minimal: only the `useEffect` block changes
- [ ] No new dependencies added
- [ ] Component remains safe for re-renders (same `[]` dependency array)
- [ ] No unrelated logic changes
