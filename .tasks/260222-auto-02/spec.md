# Spec: 260222-auto-02

## Overview

Three React frontend components currently execute `fetch()` requests inside a `useEffect` hook without utilizing an `AbortController`. If a user navigates away and the component unmounts before the fetch operation completes, the Promise callback attempts to update state on an unmounted component. This behavior can lead to memory leaks and React console warnings. The fix implements request cancellation by attaching an `AbortController` signal to the `fetch` calls and aborting the request within the `useEffect` cleanup function.

## Requirements

### FR-001: Implement AbortController in GreetingFlow
**Priority**: MUST
**Description**: Update the `useEffect` hook in `src/ui/web/homepage/GreetingFlow/index.tsx` to instantiate an `AbortController`. Pass `controller.signal` to the `fetch` call, and return a cleanup function that calls `controller.abort()`. 

### FR-002: Implement AbortController in SelectedCourseCard
**Priority**: MUST
**Description**: Update the `useEffect` hook in `src/app/(frontend)/account/_components/SelectedCourseCard.tsx` to instantiate an `AbortController`. Pass `controller.signal` to the `fetch` call, and return a cleanup function that calls `controller.abort()`. Additionally, refactor the `fetchCourse` function to accept an optional `AbortSignal` parameter so it can be used both in the useEffect (with AbortController) and in the `handleRetry` function (without signal or with a new signal). The `handleRetry` function should create its own `AbortController` to allow manual retry while ensuring cleanup on unmount.

### FR-003: Implement AbortController in HealthBadge
**Priority**: MUST
**Description**: Update the `useEffect` hook in `src/ui/web/components/HealthBadge.tsx` to instantiate an `AbortController`. Pass `controller.signal` to the `fetch` call, and return a cleanup function that calls `controller.abort()`.

### NFR-001: Error Handling for Aborted Requests
**Priority**: MUST
**Description**: Ensure that when a fetch request is aborted, the resulting `AbortError` exception is properly caught and silently ignored (not logged to the console or propagated as an application crash), while other legitimate network or parsing errors continue to be logged. 

**Implementation Details**:
- In GreetingFlow: Check if `error.name === 'AbortError'` before logging. Only log non-AbortError exceptions.
- In SelectedCourseCard: The catch block is currently empty. Add check for `error.name === 'AbortError'` and silently ignore it while other errors set `loadingState` to 'error'.
- In HealthBadge: Check if `error.name === 'AbortError'` in the catch block. Only set error state for non-AbortError exceptions.

## Acceptance Criteria

- [ ] `src/ui/web/homepage/GreetingFlow/index.tsx` safely cancels its `fetch` request on unmount using an `AbortController`.
- [ ] `src/app/(frontend)/account/_components/SelectedCourseCard.tsx` safely cancels its `fetch` request on unmount using an `AbortController`.
- [ ] `src/ui/web/components/HealthBadge.tsx` safely cancels its `fetch` request on unmount using an `AbortController`.
- [ ] In all three components, the `useEffect` cleanup function calls `controller.abort()`.
- [ ] In all three components, `AbortError` exceptions are explicitly caught and suppressed (not logged to console for GreetingFlow, not setting error state for HealthBadge).
- [ ] In SelectedCourseCard, the `fetchCourse` function accepts an optional `AbortSignal` parameter to support both useEffect and handleRetry scenarios.
- [ ] In SelectedCourseCard, the `handleRetry` function creates its own `AbortController` for manual retry functionality.

## Guardrails

- MUST NOT alter the actual endpoint URLs being fetched in these components.
- MUST NOT alter the business logic or state update logic inside the successful `.then()` or `await` resolution paths.
- MUST NOT change the dependency arrays of the modified `useEffect` hooks unless directly required to fix an existing bug alongside the `AbortController`.
- MUST ONLY modify the local frontend component files specified. 
- MUST ensure that `handleRetry` in SelectedCourseCard continues to work after adding AbortController (by creating its own AbortController for manual retries).

## Out of Scope

- Refactoring data fetching to use libraries like React Query, SWR, or RTK Query.
- Refactoring the components from Client Components to Server Components.
- Modifying or optimizing the backend API routes serving these fetch requests.
