# Spec: 260223-auto-97

## Overview

Fix a memory leak in the `VideoMedia` React component caused by an improperly managed `suspend` event listener on a `<video>` DOM node. Currently, the component attaches an inline anonymous function on mount without returning a cleanup function, resulting in orphaned event listeners if the component unmounts and remounts. Additionally, the `<video>` tag uses an implicit `muted` attribute rather than an explicit `muted={true}`.

## Requirements

### FR-001: Stable Event Handler Reference
**Priority**: MUST
**Description**: The `suspend` event listener callback currently defined as an inline anonymous function must be extracted into a stable handler function within the `useEffect` block so it can be reliably added and removed.

### FR-002: Event Listener Cleanup
**Priority**: MUST
**Description**: The `useEffect` hook that attaches the `suspend` event listener to the video element must return a cleanup function. This cleanup function must call `removeEventListener` using the exact same stable handler reference.

### FR-003: Explicit Boolean Attributes
**Priority**: MUST
**Description**: The `<video>` element must explicitly set the `muted` attribute to `{true}` (i.e. `muted={true}`) rather than using the shorthand `muted` attribute, which aligns with robust React JSX attribute practices.

### NFR-001: Memory Management
**Priority**: MUST
**Description**: Ensure that unmounting the `VideoMedia` component successfully deallocates all event listeners tied to it, leaving zero residual DOM event listeners behind.

## Acceptance Criteria

- [ ] A named function (e.g., `handleSuspend`) is declared inside the `useEffect` and passed to `addEventListener`.
- [ ] A cleanup function is returned by the `useEffect` calling `video.removeEventListener('suspend', handleSuspend)`.
- [ ] The video component's JSX renders `<video ... muted={true} ...>`.
- [ ] No other behavior in `VideoMedia` is functionally changed (e.g., other attributes like `autoPlay`, `loop`, and `playsInline` may remain as they are or be explicitly typed, but `muted` must be explicit).

## Guardrails

- Do not alter the functional logic inside the `suspend` handler. 
- Do not refactor other media rendering logic unless explicitly fixing the memory leak.
- Ensure the fix passes standard TypeScript compilation (`pnpm tsc --noEmit`).

## Out of Scope

- Implementing fallback UI rendering for suspended videos (currently commented out).
- Refactoring `ImageMedia` or any other media component.
