# Spec: 260223-auto-38

## Overview

The `VideoMedia` component currently attaches a `suspend` event listener to its `<video>` element inside a `useEffect` hook without providing a cleanup function. This causes a memory leak where duplicate event listeners accumulate every time the component is mounted (e.g., during navigation). This task will refactor the `useEffect` to properly manage the event listener lifecycle and add corresponding unit tests to verify the behavior.

## Requirements

### FR-001: Video Event Listener Cleanup

**Priority**: MUST
**Description**: The `VideoMedia` component (`src/ui/web/media/VideoMedia/index.tsx`) must properly clean up the `suspend` event listener on unmount. The handler function must be extracted to a named function (e.g. `handleSuspend`) inside the effect, and a cleanup function returning `removeEventListener` with the exact same handler reference must be returned.

### FR-002: Null-Reference Safety

**Priority**: MUST
**Description**: The `useEffect` hook must check if `videoRef.current` (or the local `video` variable) exists before attempting to add or remove event listeners.

### FR-003: Idiomatic React Implementation

**Priority**: MUST
**Description**: The `useEffect` must have a correct dependency array and the implementation should be safe for re-renders without adding duplicate listeners.

### FR-004: Event Listener Test Coverage

**Priority**: MUST
**Description**: Add 8 tests in `tests/unit/ui/web/media/VideoMedia.test.tsx` to cover the listener lifecycle, navigation cycles, and edge cases.

### NFR-001: Code Maintainability

**Priority**: SHOULD
**Description**: Add a short inline comment explaining why the cleanup is required to prevent listener accumulation. Type annotations `(call: any[])` on `spy.mock.calls` filters should be used to resolve TS7006 errors in tests.

## Acceptance Criteria

- [ ] The `VideoMedia` component defines the `suspend` event handler inside the `useEffect` and attaches it to the video element.
- [ ] The `useEffect` returns a cleanup function that calls `removeEventListener` with the same handler reference.
- [ ] No duplicate `suspend` listeners are added when navigating away and back to a page containing the component.
- [ ] `tests/unit/ui/web/media/VideoMedia.test.tsx` contains 8 tests covering listener lifecycle, navigation cycles, and edge cases.
- [ ] Tests explicitly annotate types to resolve TS7006 errors.

## Guardrails

- Do NOT change unrelated logic in the `VideoMedia` component.
- Keep the fix minimal and focused on the event listener memory leak.
- Ensure the component remains safe for re-renders.

## Out of Scope

- Refactoring other media components.
- Adding features to the `VideoMedia` component not related to the `suspend` event listener cleanup.
