# Spec: 260223-auto-74

## Overview

Fix a memory leak in the `VideoMedia` component where a `suspend` event listener is attached to the `<video>` element inside a `useEffect` but never removed on cleanup. This causes duplicate listeners to accumulate when navigating away and back.

## Requirements

### FR-001: Event Listener Cleanup
**Priority**: MUST
**Description**: Refactor the existing `useEffect` in `src/ui/web/media/VideoMedia/index.tsx` to properly clean up the `suspend` event listener. 
- The handler function must be defined inside the effect and stored in a stable reference within that scope.
- The listener must be added only if `videoRef.current` exists.
- A proper cleanup function must be returned that removes the exact same handler reference using `removeEventListener`.
- No duplicate listeners should be added on re-mount.

### FR-002: Controls Attribute (Verify Need)
**Priority**: VERIFY
**Description**: The current code uses `controls={false}` which is valid React/TypeScript syntax. Verify if any changes are needed:
- No TypeScript errors exist in the current codebase (verified by `pnpm tsc --noEmit`)
- No specific test exists for VideoMedia's controls attribute
- If changes needed, keep minimal - either retain `controls={false}` or use approach that satisfies test expectations if any exist

### NFR-001: Code Safety and Idiomatic React
**Priority**: MUST
**Description**: Ensure the effect dependency array is correct, avoid null-reference errors, and ensure the solution is idiomatic React and safe for re-renders. Keep the fix minimal and focused, avoiding changes to unrelated logic.

### NFR-002: Documentation
**Priority**: SHOULD
**Description**: Add a short inline comment explaining why cleanup is required to avoid listener accumulation.

## Acceptance Criteria

- [ ] Navigating to a page with a video component, then navigating away and back several times, only results in one active `suspend` listener at a time.
- [ ] The `controls` attribute behavior is verified - retain `controls={false}` or adjust only if a specific test requirement exists
- [ ] The `muted` boolean attribute remains properly implemented.

## Guardrails

- MUST NOT change unrelated logic in `VideoMedia` component.
- MUST keep the fix minimal and focused solely on the event listener cleanup.
- MUST NOT change any other event listeners if they are already handled properly or unrelated.

## Out of Scope

- Refactoring the entire `VideoMedia` component.
- Changing video player library or adding new video player features.

## Open Questions

- Does the proposed UI match our design system patterns? (The change is purely logical and does not affect the visual UI).
- Are translations properly accounted for? (N/A - No user-facing text is modified).
- Does the routing approach work with Next.js? (N/A - No routing changes).
- Is there a specific test requirement for VideoMedia's controls attribute? (Current search shows no VideoMedia-specific tests exist)