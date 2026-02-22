# Spec: 260222-auto-23

## Overview

This task addresses a potential memory leak and React warning caused by setting state on unmounted components. Specifically, three React components (`GreetingFlow`, `SelectedCourseCard`, and `HealthBadge`) currently trigger a `fetch()` call inside a `useEffect` hook without utilizing an `AbortController`. If the component unmounts mid-fetch (e.g., due to fast navigation), the promise resolution attempts to update state, triggering a React warning. Adding an `AbortController` will cleanly cancel the fetch request and prevent state updates on unmounted components.

## Requirements

### FR-001: Implement AbortController in `GreetingFlow`
**Priority**: MUST
**Description**: Instantiate an `AbortController` in the `useEffect` hook of `src/ui/web/homepage/GreetingFlow/index.tsx`. Pass its signal to the `fetch` call and call `abort()` in the cleanup function. 

### FR-002: Implement AbortController in `SelectedCourseCard`
**Priority**: MUST
**Description**: Update the fetch logic in `src/app/(frontend)/account/_components/SelectedCourseCard.tsx`. If the fetch is extracted into a helper function (e.g., `fetchCourse`), update its signature to accept an optional `AbortSignal`, pass the signal to the `fetch` call, and integrate the `AbortController` in the `useEffect` that calls it.

### FR-003: Implement AbortController in `HealthBadge`
**Priority**: MUST
**Description**: Instantiate an `AbortController` in the `useEffect` hook of `src/ui/web/components/HealthBadge.tsx`. Pass its signal to the `fetch` call and call `abort()` in the cleanup function.

### NFR-001: Safe Error Handling
**Priority**: MUST
**Description**: The `.catch()` block for these fetch calls must check if the error is an `AbortError` (i.e., `err.name === 'AbortError'`). If it is, the error should be silently ignored (no console error, no error state update). Real network errors should continue to be handled/logged as they are currently.

### NFR-002: Prevent State Updates Post-Abort
**Priority**: MUST
**Description**: Any `.finally()` blocks or `.then()` callbacks must not update component state (e.g., `setIsLoading(false)`) if the fetch has been aborted. This can be verified by checking `!controller.signal.aborted` before applying the state update.

## Acceptance Criteria

- [ ] `src/ui/web/homepage/GreetingFlow/index.tsx` uses `AbortController` in its `useEffect` fetch.
- [ ] `src/app/(frontend)/account/_components/SelectedCourseCard.tsx` uses `AbortController` in its `useEffect` fetch, and correctly passes the signal to the fetch call.
- [ ] `src/ui/web/components/HealthBadge.tsx` uses `AbortController` in its `useEffect` fetch.
- [ ] All modified `useEffect` hooks return a cleanup function that calls `controller.abort()`.
- [ ] All modified fetch promise chains catch and ignore `AbortError` without updating state or logging to the console.
- [ ] Any loading state cleanup explicitly respects the abort signal to prevent updating unmounted components.

## Guardrails

- What must NOT change: Do not alter the API endpoints being called, the HTTP methods, or the Payload CMS backend logic.
- Constraints to follow: Stick strictly to React and DOM API standards (`AbortController`). Do not introduce third-party fetching libraries like SWR or React Query for this fix.

## Out of Scope

- Applying `AbortController` to fetch calls outside of the three specified files.
- Refactoring the components to use Server Components.
- Modifying the visual UI or styling of the components.

## Open Questions

- *None. The @web-expert subagent has reviewed the proposed pattern and confirmed it perfectly aligns with React 18 Strict Mode and Next.js App Router requirements.*
