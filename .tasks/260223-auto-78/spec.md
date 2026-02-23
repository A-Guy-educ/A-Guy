# Spec: 260223-auto-78

## Overview

Fix a memory leak in the `VideoMedia` React component caused by an improperly managed `suspend` event listener on a `<video>` DOM node. Currently, the component attaches an inline anonymous function on mount without returning a cleanup function, resulting in orphaned event listeners if the component unmounts and remounts. Additionally, the `<video>` tag uses an implicit `muted` attribute rather than an explicit `muted={true}`.

## Requirements

### FR-001: Fix `suspend` Event Listener Memory Leak
**Priority**: MUST
**Description**: The `VideoMedia` component must properly clean up the `suspend` event listener. 
- Prefer using React's synthetic `onSuspend` prop on the `<video>` element if applicable.
- If a manual DOM event listener inside a `useEffect` is required, the effect must capture the `videoRef.current` node into a local variable and return a cleanup function that calls `removeEventListener` using that captured variable.

### FR-002: Explicit Video Attributes
**Priority**: MUST
**Description**: The `<video>` tag must use explicit boolean attributes for React compatibility.
- Replace the implicit `muted` attribute with explicit `muted={true}`.
- Add `defaultMuted={true}` to ensure reliable behavior across browsers (especially for autoplay policies).
- Ensure `playsInline` is set to prevent unexpected fullscreen playback on iOS devices.

### FR-003: Client Component Verification
**Priority**: MUST
**Description**: Since the `VideoMedia` component relies on client-side React hooks (`useEffect`, `useRef`) and DOM events, verify it includes the `'use client'` directive at the top of the file, adhering to Next.js App Router patterns.
**Note**: This requirement is already satisfied. The component at `src/ui/web/media/VideoMedia/index.tsx` already includes `'use client'` at line 1.

### NFR-001: Performance and Resource Management
**Priority**: SHOULD
**Description**: 
- Explicitly define the `preload` attribute (e.g., `preload="metadata"` or `preload="none"`) to prevent unnecessary bandwidth consumption when multiple videos are rendered, unless autoplay requires otherwise.
- **Note**: The component uses `getMediaUrl()` for video sources, NOT `URL.createObjectURL()`. Therefore, the `URL.revokeObjectURL()` cleanup requirement is NOT applicable for this component. Only apply this if the implementation changes to use Object URLs.

**Note**: The component already has `playsInline` set (verified at line 37 of the current implementation).

## Acceptance Criteria

- [ ] The `VideoMedia` component successfully cleans up the `suspend` event listener on unmount (either via React's `onSuspend` prop or a properly structured `useEffect` cleanup function).
- [ ] The `<video>` element explicitly uses `muted={true}` (and ideally `defaultMuted={true}`).
- [ ] The `<video>` element includes a `preload` attribute (e.g., `preload="metadata"` or `preload="none"`).
- [ ] Navigating away from a page containing the `VideoMedia` component does not leave orphaned `suspend` event listeners in memory.
- [ ] The video component functions correctly across browsers, respecting `muted`, `defaultMuted`, and `playsInline` attributes.
- [ ] The `'use client'` directive is present at the top of the component file (already verified: present at line 1).

## Guardrails

- **DOM Node Stale References**: When returning a cleanup function from `useEffect`, `ref.current` MUST be captured *inside* the effect block before returning the cleanup function. Do not read `videoRef.current` directly inside the cleanup function, as it may evaluate to `null` on unmount.
- **Do NOT break existing functionality**: Ensure that replacing or cleaning up the event listener does not alter the underlying logic or side-effects intended by the original `suspend` handler.
- **Component File Location**: Do not move the component; modify it in its current location at `src/ui/web/media/VideoMedia/index.tsx`.

## Out of Scope

- Refactoring the entire media handling system or adding new video player features (e.g., custom custom controls, new tracking events).
- Changing how video files are hosted, encoded, or served from Payload CMS.
- Fixing memory leaks or performance issues in components other than `VideoMedia`.