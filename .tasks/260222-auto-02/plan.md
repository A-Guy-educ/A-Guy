# Plan: 260222-auto-02 — Add AbortController to fetch-in-useEffect Components

## Summary

Three React client components (`GreetingFlow`, `SelectedCourseCard`, `HealthBadge`) fire `fetch()` inside `useEffect` without an `AbortController`. If the component unmounts before the fetch completes, state updates on an unmounted component cause memory leaks and React warnings. This plan adds `AbortController` + proper cleanup to all three, with `AbortError` silencing per NFR-001.

## Assumptions

- Tests will use `vitest` + `@testing-library/react` with `jsdom` environment (matching existing patterns in `tests/unit/components/`).
- We mock `global.fetch` to control abort behavior in tests.
- The `I18nProvider` wrapper from existing tests (`@/ui/web/providers/I18n`) is used for components that call `useTranslations`.
- The `next/navigation` module is mocked for `SelectedCourseCard` (uses `useRouter`).
- `@/client/state/localStorage/userProfile` and `@/infra/utils/getURL` are mocked for `SelectedCourseCard`.

## Test Commands

```bash
# Run just these tests
pnpm test:unit -- --grep "AbortController"

# Run all unit tests
pnpm test:unit

# Typecheck
pnpm -s tsc --noEmit
```

---

## Step 1: Add AbortController to GreetingFlow (FR-001, NFR-001)

**Estimated time**: 15 minutes

**Root Cause**: `useEffect` in `GreetingFlow` calls `fetch()` without `AbortController`. On unmount during an in-flight request, `.then()` callbacks attempt `setCourses` and `setIsLoadingCourses` on an unmounted component.

### Files to Touch

- `src/ui/web/homepage/GreetingFlow/index.tsx` (MODIFIED — lines 28-45)
- `tests/unit/components/GreetingFlow.test.tsx` (NEW)

### Reproduction Test

**Test location**: `tests/unit/components/GreetingFlow.test.tsx`

**Test 1: "should abort fetch when component unmounts during courses loading"**
- Setup: Render `GreetingFlow` with step driven to `'courses'`. Mock `global.fetch` to return a promise that never resolves (simulates slow network). Capture the `signal` passed to `fetch`.
- Action: Unmount the component.
- Assert: The `signal.aborted` is `true` (proves `controller.abort()` was called in cleanup).
- **Why it fails now**: No `signal` is passed to `fetch()` — test sees `undefined` for the signal argument, and no abort occurs on unmount.

**Test 2: "should NOT log AbortError when fetch is aborted"**
- Setup: Mock `global.fetch` to reject with an `AbortError` (`new DOMException('Aborted', 'AbortError')`). Spy on `console.error`.
- Action: Render component with step at `'courses'`, then unmount.
- Assert: `console.error` was NOT called with `'Failed to load courses:'`.
- **Why it fails now**: Current catch block at line 38-40 always calls `console.error('Failed to load courses:', error)` — including for `AbortError`.

### Fix

In the `useEffect` at lines 28-45:
1. Add `const controller = new AbortController()` at the start of the `useEffect` body (before the `if (step === 'courses')` block).
2. Pass `{ signal: controller.signal }` as the second argument to `fetch(...)`.
3. In the `.catch()` block, check `if (error.name === 'AbortError') return` before logging.
4. Return a cleanup function: `return () => { controller.abort() }` (at the end of the `useEffect` callback).

### Acceptance Criteria

- [ ] `fetch()` call receives `{ signal: controller.signal }` — **FR-001**
- [ ] `useEffect` returns cleanup that calls `controller.abort()` — **FR-001**
- [ ] `AbortError` is silently ignored (not logged) — **NFR-001**
- [ ] Non-AbortError exceptions still log via `console.error` — **NFR-001**
- [ ] Dependency array `[step]` is unchanged — Guardrail
- [ ] Fetch URL is unchanged — Guardrail
- [ ] State update logic in `.then()` is unchanged — Guardrail

---

## Step 2: Add AbortController to HealthBadge (FR-003, NFR-001)

**Estimated time**: 15 minutes

**Root Cause**: `useEffect` in `HealthBadge` calls `fetch('/api/health')` without `AbortController`. If the component unmounts mid-flight, `setState`, `setData`, `setError` are called on an unmounted component.

### Files to Touch

- `src/ui/web/components/HealthBadge.tsx` (MODIFIED — lines 24-44)
- `tests/unit/components/HealthBadge.test.tsx` (NEW)

### Reproduction Test

**Test location**: `tests/unit/components/HealthBadge.test.tsx`

**Test 1: "should abort health check fetch on unmount"**
- Setup: Mock `global.fetch` to return a never-resolving promise. Render `HealthBadge`. Capture the `signal` passed to `fetch`.
- Action: Unmount component.
- Assert: `signal.aborted === true`.
- **Why it fails now**: No `signal` passed to `fetch`, no abort on unmount.

**Test 2: "should NOT set error state when fetch is aborted"**
- Setup: Mock `global.fetch` to reject with `AbortError`. Render `HealthBadge`.
- Action: Wait for the effect to run, then unmount.
- Assert: The component does NOT display "API ERROR" text (i.e., `state` was not set to `'error'`).
- **Why it fails now**: Current catch block (line 37-39) unconditionally sets error state, meaning an `AbortError` would show the error badge.

### Fix

In the `useEffect` at lines 24-44:
1. Add `const controller = new AbortController()` before the `checkHealth` function definition.
2. Modify the `fetch` call to `const response = await fetch('/api/health', { signal: controller.signal })`.
3. In the `catch` block, check `if (error instanceof Error && error.name === 'AbortError') return` before setting error state.
4. Return cleanup: `return () => { controller.abort() }` (after `checkHealth()` call).

### Acceptance Criteria

- [ ] `fetch()` call receives `{ signal: controller.signal }` — **FR-003**
- [ ] `useEffect` returns cleanup that calls `controller.abort()` — **FR-003**
- [ ] `AbortError` does NOT set error state — **NFR-001**
- [ ] Non-AbortError exceptions still set error state — **NFR-001**
- [ ] Dependency array `[]` is unchanged — Guardrail
- [ ] Fetch URL `/api/health` is unchanged — Guardrail

---

## Step 3: Add AbortController to SelectedCourseCard (FR-002, NFR-001)

**Estimated time**: 20 minutes

**Root Cause**: `useEffect` in `SelectedCourseCard` calls `fetchCourse()` which internally calls `fetch()` without a signal. On unmount, state updates (`setLoadingState`, `setCourse`) fire on an unmounted component. Additionally, `handleRetry` needs its own `AbortController` for manual retry without conflicting with the useEffect's controller.

### Files to Touch

- `src/app/(frontend)/account/_components/SelectedCourseCard.tsx` (MODIFIED — lines 29-38, 40-75, 82-87)
- `tests/unit/components/SelectedCourseCard.test.tsx` (NEW)

### Reproduction Test

**Test location**: `tests/unit/components/SelectedCourseCard.test.tsx`

**Test 1: "should abort fetch on unmount when loading course"**
- Setup: Mock `getUserProfile` to return `{ gradeLevel: '8' }`. Mock `global.fetch` to return a never-resolving promise. Render `SelectedCourseCard`. Capture the `signal` passed to `fetch`.
- Action: Unmount component.
- Assert: `signal.aborted === true`.
- **Why it fails now**: `fetchCourse` does not accept or pass a signal to `fetch`.

**Test 2: "fetchCourse should accept optional AbortSignal parameter"**
- Setup: Mock `getUserProfile` to return `{ gradeLevel: '8' }`. Mock `global.fetch` to resolve with course data. Render `SelectedCourseCard`.
- Assert: `fetch` was called with a URL and an options object containing a `signal` property.
- **Why it fails now**: `fetchCourse` does not accept a signal parameter.

**Test 3: "should NOT set error state when fetch is aborted (AbortError is silenced)"**
- Setup: Mock `getUserProfile` to return `{ gradeLevel: '8' }`. Mock `global.fetch` to reject with `AbortError`.
- Action: Render component, then unmount.
- Assert: `setLoadingState('error')` was NOT called / component does not show error UI.
- **Why it fails now**: Current catch block (line 72-74) unconditionally sets `loadingState` to `'error'`.

**Test 4: "handleRetry creates its own AbortController"**
- Setup: Mock `getUserProfile` to return `{ gradeLevel: '8' }`. Mock first `fetch` to resolve with error, showing error state with retry button. Mock second `fetch` to resolve successfully.
- Action: Click "Try Again" button.
- Assert: A second `fetch` call is made with a new `signal` (not the same signal from the `useEffect`).
- **Why it fails now**: `handleRetry` doesn't create its own `AbortController`.

### Fix

1. **Refactor `fetchCourse`** (lines 40-75): Add an optional `signal?: AbortSignal` parameter. Pass `{ signal }` to `fetch()`.
2. **Update `useEffect`** (lines 29-38):
   - Create `const controller = new AbortController()`.
   - Pass `controller.signal` to `fetchCourse(profile.gradeLevel, controller.signal)`.
   - Return cleanup: `return () => { controller.abort() }`.
3. **Update `handleRetry`** (lines 82-87):
   - Create `const controller = new AbortController()` inside `handleRetry`.
   - Pass `controller.signal` to `fetchCourse(profile.gradeLevel, controller.signal)`.
4. **Update catch block** (lines 72-74): Check `if (error instanceof Error && error.name === 'AbortError') return` before setting `loadingState` to `'error'`.

### Acceptance Criteria

- [ ] `fetchCourse` accepts an optional `AbortSignal` parameter — **FR-002**
- [ ] `useEffect` creates `AbortController` and passes signal to `fetchCourse` — **FR-002**
- [ ] `useEffect` returns cleanup that calls `controller.abort()` — **FR-002**
- [ ] `handleRetry` creates its own `AbortController` — **FR-002**
- [ ] `AbortError` does NOT set `loadingState` to `'error'` — **NFR-001**
- [ ] Non-AbortError exceptions still set `loadingState` to `'error'` — **NFR-001**
- [ ] Dependency array `[]` is unchanged — Guardrail
- [ ] Fetch URL is unchanged — Guardrail
- [ ] Business logic (state updates on success) is unchanged — Guardrail

---

## Step 4: TypeCheck and Lint Verification

**Estimated time**: 5 minutes

### Commands

```bash
pnpm -s tsc --noEmit
pnpm -s lint
```

### Acceptance Criteria

- [ ] TypeScript compilation succeeds with no errors
- [ ] ESLint passes with no new warnings or errors
- [ ] All unit tests pass: `pnpm test:unit`

---

## Test Utilities & Mocking Notes for Build Agent

### Global fetch mock pattern (use in all 3 test files)

```typescript
// Mock fetch that captures the signal and never resolves (for unmount tests)
let capturedSignal: AbortSignal | undefined
const fetchMock = vi.fn().mockImplementation((_url: string, options?: RequestInit) => {
  capturedSignal = options?.signal
  return new Promise(() => {}) // Never resolves
})
vi.stubGlobal('fetch', fetchMock)
```

### AbortError creation

```typescript
// Create an AbortError for mock rejections
const abortError = new DOMException('The operation was aborted.', 'AbortError')
```

### I18n wrapper for GreetingFlow and SelectedCourseCard

```typescript
import { I18nProvider } from '@/ui/web/providers/I18n'
import enMessages from '../../../src/i18n/en.json'

const renderWithI18n = (component: React.ReactElement) => {
  return render(
    <I18nProvider locale="en" messages={enMessages}>
      {component}
    </I18nProvider>
  )
}
```

### next/navigation mock for SelectedCourseCard

```typescript
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))
```

### localStorage and userProfile mocks for SelectedCourseCard

```typescript
vi.mock('@/client/state/localStorage/userProfile', () => ({
  getUserProfile: vi.fn(),
  clearUserProfile: vi.fn(),
}))

vi.mock('@/infra/utils/getURL', () => ({
  getClientSideURL: () => 'http://localhost:3000',
}))
```

---

## Files Changed Summary

| File | Action | Spec Req |
|------|--------|----------|
| `src/ui/web/homepage/GreetingFlow/index.tsx` | MODIFIED | FR-001, NFR-001 |
| `src/ui/web/components/HealthBadge.tsx` | MODIFIED | FR-003, NFR-001 |
| `src/app/(frontend)/account/_components/SelectedCourseCard.tsx` | MODIFIED | FR-002, NFR-001 |
| `tests/unit/components/GreetingFlow.test.tsx` | NEW | FR-001, NFR-001 |
| `tests/unit/components/HealthBadge.test.tsx` | NEW | FR-003, NFR-001 |
| `tests/unit/components/SelectedCourseCard.test.tsx` | NEW | FR-002, NFR-001 |
