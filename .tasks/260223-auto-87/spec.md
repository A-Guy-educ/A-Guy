# Spec: 260223-auto-87

## Overview

Fix a memory leak in the `VideoMedia` component caused by an un-removed `suspend` event listener on the `<video>` element. The fix ensures the listener is properly removed in the `useEffect` cleanup function. Additionally, the component's test coverage, TypeScript types, and explicit `muted` attribute setting have been addressed.

## Requirements

### FR-001: Event Listener Initialization
**Priority**: MUST
**Description**: The `VideoMedia` component must attach a `suspend` event listener to the `<video>` element inside a `useEffect` only if the video reference exists. A stable handler function must be used.

### FR-002: Event Listener Cleanup
**Priority**: MUST
**Description**: The `useEffect` must return a cleanup function that explicitly calls `removeEventListener` using the exact same handler reference for the `suspend` event to prevent memory leaks and duplicate listeners on remount.

### FR-003: Explicit Muted Attribute
**Priority**: MUST
**Description**: The `<video>` element must explicitly set `muted={true}` rather than relying on the implicit boolean shorthand, ensuring better compatibility with testing libraries.

### NFR-001: Idiomatic React
**Priority**: MUST
**Description**: The fix must follow idiomatic React patterns, ensuring no null-reference errors and using correct dependency arrays for the `useEffect`.

### NFR-002: Code Minimization
**Priority**: SHOULD
**Description**: Keep the fix minimal and focused without changing unrelated logic. Add a short inline comment explaining why cleanup is required to avoid listener accumulation.

## Acceptance Criteria

- [ ] A stable handler function is defined inside the `useEffect`.
- [ ] The `suspend` event listener is only added when `videoRef.current` is truthy.
- [ ] A cleanup function is returned that calls `removeEventListener` with the same handler.
- [ ] The `<video>` element explicitly sets `muted={true}`.
- [ ] Navigating away and back to the component multiple times does not accumulate duplicate event listeners in memory.
- [ ] Tests pass correctly, particularly the "renders a video element with correct attributes" test for the `muted` attribute.
- [ ] No TypeScript type errors exist in the modified file.

## Guardrails

- Do NOT change unrelated logic in `VideoMedia` or other components.
- The `useEffect` dependency array must be correct and stable for safe re-renders.

## Out of Scope

- Changes to other media types (like images or audio) in the application.
- Global event listener cleanup beyond the scope of the `VideoMedia` component.
