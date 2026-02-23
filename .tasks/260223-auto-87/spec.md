# Spec: 260223-auto-87

## Overview

Fix a memory leak in the `VideoMedia` component caused by:
1. An un-removed `suspend` event listener on the `<video>` element (no cleanup function)
2. Using an anonymous inline function instead of a stable handler reference
3. Using implicit `muted` attribute instead of explicit `muted={true}`

**Status**: The fixes described below have NOT yet been implemented in the codebase. This spec defines what needs to be done.

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

- [ ] A stable named handler function is defined inside the `useEffect` (not inline anonymous).
- [ ] The `suspend` event listener is only added when `videoRef.current` is truthy.
- [ ] A cleanup function is returned that calls `removeEventListener` with the same handler.
- [ ] The `<video>` element explicitly sets `muted={true}` (not shorthand `muted`).
- [ ] An inline comment explains why cleanup is required to avoid listener accumulation.
- [ ] Navigating away and back to the component multiple times does not accumulate duplicate event listeners in memory.
- [ ] Tests exist for the VideoMedia component, particularly testing the `muted` attribute.
- [ ] No TypeScript type errors exist in the modified file.

## Guardrails

- Do NOT change unrelated logic in `VideoMedia` or other components.
- The `useEffect` dependency array must be correct and stable for safe re-renders.

## Out of Scope

- Changes to other media types (like images or audio) in the application.
- Global event listener cleanup beyond the scope of the `VideoMedia` component.
