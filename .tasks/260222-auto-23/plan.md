# Plan: 260222-auto-23 — Fix Memory Leak from Unmounted Component State Updates

## Summary

Three React client components (`GreetingFlow`, `SelectedCourseCard`, `HealthBadge`) perform `fetch()` inside `useEffect` without `AbortController`. If the component unmounts mid-fetch, the resolved promise attempts `setState` on an unmounted component, causing React warnings and potential memory leaks. The fix adds `AbortController` to each `useEffect`, aborts on cleanup, and silently ignores `AbortError` in catch handlers.

## Assumptions

- We use `@testing-library/react` + `vitest` for unit tests (jsdom environment), consistent with existing component tests (e.g., `CourseCard.test.tsx`).
- `global.fetch` can be mocked with `vi.fn()` in the test environment.
- The `AbortError` check uses `err.name === 'AbortError'` (standard DOM API).
- Tests will use `vi.useFakeTimers()` where needed for timeouts, and `act()` / `waitFor()` for async state updates.

---

## Step 1: Fix `HealthBadge` — Add AbortController to fetch (FR-003, NFR-001, NFR-002)

**Estimated Time**: 10-15 minutes

### Root Cause

`HealthBadge` calls `fetch('/api/health')` inside `useEffect` with no cleanup. If the component unmounts before the response arrives, `setState`/`setData`/`setError` fire on an unmounted component.

### Files to Touch

- `src/ui/web/components/HealthBadge.tsx` (MODIFIED — lines 24-44)
- `tests/unit/components/HealthBadge.test.tsx` (NEW)

### Reproduction Test

**Test location**: `tests/unit/components/HealthBadge.test.tsx`

**Test 1 — "should abort fetch on unmount and NOT update state"**:
- Render `HealthBadge`, mock `fetch` to return a delayed promise.
- Unmount the component before the promise resolves.
- Assert that `AbortController.abort()` was called (via spy on the signal).
- Assert no React warnings / no state updates after unmount.
- **Why it fails now**: No `AbortController` exists; `fetch` is never aborted; `setState` fires post-unmount.

**Test 2 — "should silently ignore AbortError without logging or updating error state"**:
- Mock `fetch` to reject with an `AbortError` (`new DOMException('Aborted', 'AbortError')`).
- Spy on `console.error`.
- Assert `console.error` was NOT called with the abort error.
- Assert the component remains in `loading` state (no error state set).
- **Why it fails now**: The `catch` block runs `setError('Failed to fetch health status')` and `setState('error')` for ALL errors, including abort.

**Test 3 — "should still handle real network errors normally"**:
- Mock `fetch` to reject with a non-abort error (e.g., `TypeError('Network error')`).
- Assert the component renders the error state ("API ERROR").
- **Why it passes**: Ensures the fix doesn't swallow real errors.

### Fix

In `useEffect` (lines 24-44):
1. Create `const controller = new AbortController()` at the top of the effect.
2. Pass `{ signal: controller.signal }` as the second argument to `fetch('/api/health', { signal: controller.signal })`.
3. In the `catch` block, check `if (err instanceof DOMException && err.name === 'AbortError') return` before setting error state.
4. Return cleanup function: `return () => { controller.abort() }`.

### Acceptance Criteria

- [ ] `useEffect` creates an `AbortController` and passes its `signal` to `fetch`.
- [ ] `useEffect` returns a cleanup that calls `controller.abort()`.
- [ ] `AbortError` is caught and silently ignored (no `setError`, no `setState`, no `console.error`).
- [ ] Real network errors still update state to `'error'`.
- [ ] All 3 tests pass.

---

## Step 2: Fix `GreetingFlow` — Add AbortController to fetch (FR-001, NFR-001, NFR-002)

**Estimated Time**: 15-20 minutes

### Root Cause

`GreetingFlow` calls `fetch('/api/courses?...')` in a `useEffect` triggered when `step === 'courses'`. The `.then()` calls `setCourses()` and `.finally()` calls `setIsLoadingCourses(false)`. If the component unmounts mid-fetch, these fire on an unmounted component.

### Files to Touch

- `src/ui/web/homepage/GreetingFlow/index.tsx` (MODIFIED — lines 28-45)
- `tests/unit/components/GreetingFlow.test.tsx` (NEW)

### Reproduction Test

**Test location**: `tests/unit/components/GreetingFlow.test.tsx`

**Test 1 — "should abort fetch on unmount when step is courses"**:
- Render `GreetingFlow` with step forced to `'courses'` (by driving the component through its state, or by mocking).
- Mock `fetch` to return a never-resolving promise (or a delayed one).
- Unmount the component.
- Assert `AbortController.abort()` was called.
- Assert `setCourses` and `setIsLoadingCourses` were NOT called after unmount.
- **Why it fails now**: No `AbortController`; `.finally(() => setIsLoadingCourses(false))` fires post-unmount.

**Test 2 — "should silently ignore AbortError in catch handler"**:
- Mock `fetch` to reject with `AbortError`.
- Assert `console.error` is NOT called with 'Failed to load courses'.
- **Why it fails now**: The `catch` block logs `console.error('Failed to load courses:', error)` for all errors including abort.

**Test 3 — "should still load courses successfully on happy path"**:
- Mock `fetch` to return `{ docs: [{ id: '1', title: 'Course 1' }] }`.
- Assert courses are rendered correctly.
- **Why it passes**: Ensures normal functionality is not broken.

### Fix

In `useEffect` (lines 28-45):
1. Create `const controller = new AbortController()` at the top of the `useEffect` callback, before the `if (step === 'courses')` block.
2. Pass `{ signal: controller.signal }` to `fetch(url, { signal: controller.signal })`.
3. In `.catch()`, check `if (error?.name === 'AbortError') return` before `console.error`.
4. In `.finally()`, check `if (!controller.signal.aborted)` before `setIsLoadingCourses(false)`.
5. Return cleanup: `return () => { controller.abort() }` — must be returned from the `useEffect` callback itself (outside the `if` block, so the cleanup runs on any re-render or unmount). Create the controller before the `if` block and always return the cleanup.

### Acceptance Criteria

- [ ] `useEffect` creates an `AbortController` and passes its `signal` to `fetch`.
- [ ] `useEffect` returns a cleanup that calls `controller.abort()`.
- [ ] `AbortError` is caught silently (no `console.error`, no state update).
- [ ] `.finally()` checks `controller.signal.aborted` before calling `setIsLoadingCourses(false)`.
- [ ] Normal course fetching still works end-to-end.
- [ ] All 3 tests pass.

---

## Step 3: Fix `SelectedCourseCard` — Add AbortController to fetch (FR-002, NFR-001, NFR-002)

**Estimated Time**: 15-20 minutes

### Root Cause

`SelectedCourseCard` calls `fetchCourse(gradeLevel)` inside `useEffect`. The `fetchCourse` async function calls `fetch(url)` and then `setCourse(...)` / `setLoadingState(...)`. No `AbortController` is used, so if the component unmounts mid-fetch, state updates fire on an unmounted component.

This is slightly more complex because `fetchCourse` is also called from `handleRetry` (outside the `useEffect`). The fix must update `fetchCourse`'s signature to accept an optional `AbortSignal`, and only pass it from the `useEffect` call. The `handleRetry` call does not need a signal (user-initiated, component is still mounted).

### Files to Touch

- `src/app/(frontend)/account/_components/SelectedCourseCard.tsx` (MODIFIED — lines 29-75)
- `tests/unit/components/SelectedCourseCard.test.tsx` (NEW)

### Reproduction Test

**Test location**: `tests/unit/components/SelectedCourseCard.test.tsx`

**Test 1 — "should abort fetch on unmount and not update state"**:
- Mock `getUserProfile` to return `{ gradeLevel: '8' }`.
- Mock `fetch` to return a delayed/never-resolving promise.
- Render and immediately unmount `SelectedCourseCard`.
- Assert `fetch` was called with a signal (i.e., the options object contains `signal`).
- Assert no state updates happen after unmount.
- **Why it fails now**: `fetchCourse` never receives a signal; no abort on unmount.

**Test 2 — "should silently ignore AbortError without setting error state"**:
- Mock `getUserProfile` to return `{ gradeLevel: '8' }`.
- Mock `fetch` to reject with `AbortError`.
- Assert the component does NOT render the error state ("Failed to load course").
- **Why it fails now**: The `catch` block sets `setLoadingState('error')` for all errors including abort.

**Test 3 — "should still fetch and display course on success"**:
- Mock `getUserProfile` to return `{ gradeLevel: '8' }`.
- Mock `fetch` to resolve with a course doc.
- Assert the course title and label are rendered.
- **Why it passes**: Ensures normal functionality is preserved.

**Test 4 — "handleRetry should still work without signal"**:
- Mock `getUserProfile` to return `{ gradeLevel: '8' }`.
- First fetch fails (non-abort error), component shows error state.
- Click "Try Again" button.
- Second fetch succeeds.
- Assert the course is now displayed.
- **Why it passes**: Ensures retry path (no signal) still works.

### Fix

1. Update `fetchCourse` signature: `const fetchCourse = async (gradeLevel: string, signal?: AbortSignal)`.
2. Pass `{ signal }` to the `fetch` call: `fetch(url, { signal })`.
3. In the `catch` block, check `if (error instanceof DOMException && error.name === 'AbortError') return` before `setLoadingState('error')`.
4. In the `useEffect` (lines 29-38):
   - Create `const controller = new AbortController()`.
   - Call `fetchCourse(profile.gradeLevel, controller.signal)`.
   - Return cleanup: `return () => { controller.abort() }`.
5. `handleRetry` continues calling `fetchCourse(profile.gradeLevel)` without a signal (no abort needed for user-initiated retry).

### Acceptance Criteria

- [ ] `fetchCourse` accepts an optional `AbortSignal` parameter.
- [ ] `useEffect` creates an `AbortController`, passes its signal to `fetchCourse`, and returns a cleanup that aborts.
- [ ] `AbortError` is caught and silently ignored (no `setLoadingState('error')`).
- [ ] `handleRetry` still works without a signal.
- [ ] Normal course fetching and display still works.
- [ ] All 4 tests pass.

---

## Step 4: Verify All Quality Gates Pass

**Estimated Time**: 5-10 minutes

### Files to Touch

- None (verification only)

### Verification Commands

```bash
# Type check — no regressions
pnpm -s tsc --noEmit

# Lint — no new issues
pnpm -s lint

# Run all new tests
pnpm vitest run tests/unit/components/HealthBadge.test.tsx tests/unit/components/GreetingFlow.test.tsx tests/unit/components/SelectedCourseCard.test.tsx

# Run full unit test suite — no regressions
pnpm vitest run --config vitest.config.unit.mts
```

### Acceptance Criteria

- [ ] `tsc --noEmit` exits with code 0.
- [ ] `pnpm lint` exits with code 0.
- [ ] All 3 new test files pass (10+ total test cases).
- [ ] No existing tests are broken.

---

## Test Infrastructure Notes

All new test files should follow the existing pattern from `tests/unit/components/CourseCard.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
```

### Mocking Pattern for `fetch` with `AbortController`

```tsx
// Mock fetch that captures the signal
let capturedSignal: AbortSignal | undefined
const mockFetch = vi.fn().mockImplementation((_url: string, options?: RequestInit) => {
  capturedSignal = options?.signal
  return new Promise((resolve) => {
    // Never resolves — simulates slow network
    options?.signal?.addEventListener('abort', () => {
      // Fetch would reject with AbortError
    })
  })
})
global.fetch = mockFetch
```

### Mocking Pattern for AbortError

```tsx
// Create a proper AbortError
const abortError = new DOMException('The operation was aborted.', 'AbortError')
```

### Required Mocks (common to all 3 test files)

- `global.fetch` — mock with `vi.fn()`
- `next/navigation` — mock `useRouter` (for `SelectedCourseCard`)
- `@/ui/web/providers/I18n` — mock `useTranslations` to return identity function
- `@/client/state/localStorage/userProfile` — mock for `SelectedCourseCard`
- `@/infra/utils/getURL` — mock `getClientSideURL` for `SelectedCourseCard`

---

## Requirement Traceability

| Requirement | Step(s) | Test Coverage |
|-------------|---------|---------------|
| FR-001 (GreetingFlow AbortController) | Step 2 | GreetingFlow.test.tsx: Tests 1-3 |
| FR-002 (SelectedCourseCard AbortController) | Step 3 | SelectedCourseCard.test.tsx: Tests 1-4 |
| FR-003 (HealthBadge AbortController) | Step 1 | HealthBadge.test.tsx: Tests 1-3 |
| NFR-001 (AbortError handling) | Steps 1-3 | All test files: "silently ignore AbortError" tests |
| NFR-002 (No post-abort state updates) | Steps 1-3 | All test files: "abort on unmount" tests |
