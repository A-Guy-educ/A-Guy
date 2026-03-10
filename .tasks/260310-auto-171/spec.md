# Spec: 260310-auto-171

## Overview

Redesign the Course Studying page UI to match the Figma prototype’s visual language (soft geometry, glassmorphism, and mode-based chromatic states) while preserving existing functional logic for course navigation/progress, exercise validation, and A-Guy (AI tutor) integration.

## Requirements

### FR-001: Figma-first visual fidelity
**Priority**: MUST
**Description**: The initial look-and-feel (layout, spacing, typography, color balance) must match the Figma prototype at https://beaver-snack-74767221.figma.site before adding any optional enhancements.

### FR-002: Soft geometry across primary/secondary surfaces
**Priority**: MUST
**Description**: Primary containers (lesson blocks, exercise cards, sidebars, chat panel) must use high-radius corner patterns (≈24px or greater). Secondary controls (buttons, inputs) must use ≈12–16px radii, consistent with Figma.

### FR-003: Master workspace split-pane layout
**Priority**: MUST
**Description**: Implement a split-pane workspace that matches Figma, consisting of (a) a contextual navigation sidebar and (b) a responsive content canvas.

### FR-004: Contextual navigation sidebar with progress indicators
**Priority**: MUST
**Description**: Sidebar must present contextual navigation using floating pill-shaped controls and circular progress indicators; indicators and accents must update to reflect the current mode.

### FR-005: Content canvas readability constraints
**Priority**: MUST
**Description**: Main content must be rendered in a centered, readability-first canvas with a maximum width equivalent to `max-w-4xl` (or the exact Figma-aligned value if different).

### FR-006: High-fidelity math/LaTeX rendering
**Priority**: MUST
**Description**: The studying content and related UI (including chat bubbles where applicable) must render LaTeX/math with high fidelity and remain legible across all mode tints.

### FR-007: Dynamic mode system (Study / Hint-Ask / Practice / Test)
**Priority**: MUST
**Description**: The page must support four modes that can be toggled without full page reloads and without losing the user’s studying context.

### FR-008: Mode-based chromatic theming
**Priority**: MUST
**Description**: The UI theme must dynamically shift colors to match Figma mode palettes:
- Study/Default: lavender/soft blue (e.g., #F5F7FF backgrounds)
- Hint/Ask: purple/indigo accents
- Practice: emerald green accents
- Test: sunset orange / warm red accents

### FR-009: Mode toggle state persistence contract
**Priority**: MUST
**Description**: Define and implement what state is preserved across mode toggles at minimum:
- currently selected lesson/exercise context
- exercise in-progress answers and validation feedback (unless explicitly reset)
- scroll position (policy must be explicitly defined)
- chat conversation state (messages, streaming state, draft input; see FR-013–FR-017)

### FR-010: Glassmorphism surfaces (with fallback)
**Priority**: MUST
**Description**: Floating panels (hint popovers, chat panel, overlays) must use glassmorphism patterns (backdrop blur + semi-transparent surfaces + subtle border/shadow) as per Figma, and must provide a functional/legible fallback when `backdrop-filter` is unsupported.

### FR-011: Practice mode exercise card experience
**Priority**: MUST
**Description**: In Practice mode, interactive exercise cards must replace static content where applicable. Cards must match Figma interactions including a “3D lift” hover effect and flip transitions.

### FR-012: Practice mode card interaction rules
**Priority**: MUST
**Description**: Define when cards flip (e.g., click/tap vs hover) and what content appears on each side (prompt, inputs, feedback, explanation). Must include keyboard-equivalent interactions.

### FR-013: Hint/Ask mode slide-in chat panel
**Priority**: MUST
**Description**: Hint/Ask mode must display a high-radius glassmorphic chat panel that slides in from the logical “end” side of the viewport (direction-aware for RTL). Chat bubbles must use mode-specific gradients and show persona-specific avatars.

### FR-014: Chat session identity & persistence
**Priority**: MUST
**Description**: Chat must have a stable session identity (e.g., conversationId) scoped to the studying context (scope must be specified: per lesson/exercise, per course, etc.). The message list must persist across:
- Hint ↔ Ask toggles
- opening/closing the panel
- persona switches

### FR-015: Hint vs Ask behavioral policy
**Priority**: MUST
**Description**: Hint and Ask must be defined as behavioral policies (constraints) that affect future responses without resetting the conversation. The spec must define differences (e.g., scaffolding vs direct answer) and how the UI indicates which policy applied.

### FR-016: Persona switching behavior
**Priority**: SHOULD
**Description**: Users can switch AI teacher/persona. Switching must cross-fade the avatar and update chat accent colors. Persona changes must affect subsequent responses deterministically and must not rewrite prior messages.

### FR-017: Chat streaming, errors, and recovery
**Priority**: MUST
**Description**: Define behavior for streaming and failures:
- single vs multiple concurrent in-flight requests
- cancel behavior and UI state (cancelled/partial)
- network loss/timeouts/rate limits/auth expiry handling
- retry/regenerate actions with idempotency to prevent duplicate sends

### FR-018: Test mode UX and enforcement
**Priority**: MUST
**Description**: In Test mode, header/border accents shift to Test palette. Navigation is restricted per an explicit policy (disabled/hidden/confirmed). A prominent floating timer appears top-right and respects safe-area insets on mobile.

### FR-019: Interactive input patterns
**Priority**: MUST
**Description**: Exercise inputs must match Figma tactile patterns:
- selection inputs: large circular radios and pill-shaped checkboxes with smooth fill animations
- free response: auto-expanding textareas with translucent backgrounds
- include complete state set: default/hover/focus/selected/disabled/error

### FR-020: Contextual math palette toolbar
**Priority**: SHOULD
**Description**: When math input is required, display a floating, mode-colored math palette toolbar that appears contextually and is keyboard/touch accessible.

### FR-021: Defined transitions for key interactions
**Priority**: MUST
**Description**: Implement the following transitions to match Figma patterns:
- Enter Practice: content shifts and practice cards fade/move in bottom-to-top
- Get Hint: background dims subtly; focus glow/spotlight around the active exercise
- Correct Answer: soft green pulse on card edges; milestone celebration consistent with prototype
- Switch Persona: avatar cross-fade and accent update

### FR-022: Mobile responsive behavior (bottom sheet)
**Priority**: MUST
**Description**: On small screens, sidebar transforms into a rounded bottom sheet as per Figma. The bottom sheet must define snap points, drag affordance, backdrop behavior, scroll locking, and safe-area handling.

### FR-023: Touch target sizing
**Priority**: MUST
**Description**: All interactive controls must meet minimum 48×48px hit areas (buttons, pills, progress indicators, close buttons, flip controls, math palette controls).

### FR-024: i18n + RTL correctness
**Priority**: MUST
**Description**: All user-facing strings must be translatable (no hardcoded labels). Directional UI behaviors must be RTL-aware (slide-ins from logical end, start/end spacing, icons/chevrons). Math and mixed-direction text must remain readable.

### NFR-001: Preserve existing functional logic and integrations
**Priority**: MUST
**Description**: Existing business logic for course progress, lesson/exercise selection, exercise validation, and AI tutor integration points must be preserved; the redesign is UI/UX-first.

### NFR-002: No full reload on mode toggles
**Priority**: MUST
**Description**: Switching modes must not trigger full page reloads and must not remount/reset core providers that would drop studying/chat context.

### NFR-003: Accessibility baseline
**Priority**: MUST
**Description**: Meet WCAG 2.1 AA for text/icon contrast including on tinted/glass surfaces. Ensure full keyboard operability, visible focus, proper focus trap for dialogs/bottom sheets, and proper semantics for dialogs/bottom sheets, progress indicators, and custom inputs. All interactive elements must have visible focus states.

### NFR-004: Reduced motion support
**Priority**: MUST
**Description**: Respect `prefers-reduced-motion` by disabling or significantly reducing non-essential animations (3D lift, flips, slide-ins, crossfades, confetti) while preserving functionality. Flip transitions and 3D lifts must be disabled; slide-ins should use instant visibility.

### NFR-005: Performance and stability
**Priority**: SHOULD
**Description**: Mode transitions and panel animations must avoid layout shift and remain responsive under large content (e.g., long lesson content, many sidebar items, long chat history). Define any virtualization or summarization strategy as needed.

### NFR-006: Visual robustness across browsers
**Priority**: SHOULD
**Description**: Glassmorphism and blur effects must degrade gracefully on browsers without `backdrop-filter` support, maintaining legibility and functional affordances.

### FR-025: Animation Library Selection
**Priority**: MUST
**Description**: Select and install an animation library (recommended: framer-motion) to support complex interactions including 3D lift, flip transitions, slide-ins, crossfades, and confetti. CSS-only animations are insufficient for the required interactions.

### FR-026: Mode-Based Theming System
**Priority**: MUST
**Description**: Implement a ModeContext provider that wraps the studying page and provides CSS custom properties for each mode palette. Theme should include mode-specific colors for backgrounds, accents, borders, and shadows.

### FR-027: Glassmorphism Design Tokens
**Priority**: MUST
**Description**: Add glassmorphism tokens to tailwind.tokens.mjs including: backdrop blur values (8px, 12px, 16px), surface opacity levels (0.7, 0.8, 0.9), border opacity (0.1, 0.2), and shadow variants. Must include non-blur fallback classes.

### FR-028: Extended Border Radius Tokens
**Priority**: MUST
**Description**: Add new border radius tokens: '4xl' (24px), '5xl' (32px), 'full' for pill shapes. Primary containers should use '4xl' minimum.

### FR-029: Slide-In Chat Animation Wrapper
**Priority**: MUST
**Description**: Wrap existing ChatInterface component in an animated container that slides from logical end side. Must support RTL-aware direction and respect reduced-motion preferences.

### FR-030: Mobile Bottom Sheet Navigation
**Priority**: MUST
**Description**: Implement a mobile bottom sheet for sidebar that includes: snap points (collapsed, half, full), drag affordance (handle indicator), backdrop with tap-to-dismiss, scroll locking for underlying content, and safe-area insets handling.

### FR-031: Test Mode Timer Component
**Priority**: MUST
**Description**: Create a floating timer component for Test mode positioned top-right. Must include safe-area awareness for mobile, pause/resume capability, and configurable duration.

### FR-032: Practice Mode Interactive Cards
**Priority**: MUST
**Description**: Create new exercise card component with 3D lift hover effect (transform: translateY + shadow increase) and flip transition (rotateY 180deg). Must support keyboard activation (Enter/Space) and follow reduced-motion preferences.

### NFR-007: Open Questions Resolution
**Priority**: MUST
**Description**: Resolve the following before implementation:
1. Replacement vs variant approach for studying page
2. URL-based vs local state mode persistence
3. RTL slide direction (logical end vs visual right)
4. Test mode navigation restriction policy
5. Chat policy in Test mode
6. Scroll position preservation policy
7. Exact glassmorphism token values
8. Animation library selection (recommend framer-motion)
9. Timer persistence strategy
10. Chat conversation scope and persistence

### NFR-008: i18n Planning
**Priority**: MUST
**Description**: Create a translation key plan for all new UI elements including mode labels, transition labels, bottom sheet labels, timer labels, and error messages before implementation.

## Acceptance Criteria

- [ ] Animation library (framer-motion recommended) is installed in package.json and available for import.
- [ ] The Course Studying page visually matches the Figma prototype for spacing, typography, radii, and color balance (fidelity-first).
- [ ] The workspace uses a split-pane layout with (a) a contextual navigation sidebar and (b) a centered readability canvas (max width aligned to `max-w-4xl` or Figma-defined equivalent).
- [ ] LaTeX/math renders crisply and remains legible in all modes, including against tinted/glass surfaces.
- [ ] Mode toggle (Study/Hint/Practice/Test) updates theme accents and key UI elements without a full reload and without losing user context.
- [ ] Mode-specific palettes apply as specified (Study lavender/soft blue, Hint purple/indigo, Practice green, Test orange/warm red) and are reflected in sidebar progress indicators and primary accents.
- [ ] Glassmorphic floating surfaces (chat/poppers/overlays) match Figma and have a non-blur fallback that remains readable.
- [ ] Practice mode replaces relevant static content with interactive exercise cards exhibiting Figma-aligned 3D lift and flip transitions; flip behavior works on touch and via keyboard.
- [ ] Hint/Ask mode shows a slide-in glassmorphic chat panel from the logical end side (RTL-aware), with gradient bubbles and persona avatars.
- [ ] Chat conversation state (messages, streaming state, and draft input) persists across mode toggles, persona switches, and panel open/close.
- [ ] Persona switching cross-fades avatar and updates chat accents; it affects future responses without rewriting earlier messages.
- [ ] Chat error states are handled: failed/timeout/rate-limited/auth-expired requests show an error bubble and provide retry/regenerate; cancel stops streaming and marks the message cancelled.
- [ ] Test mode applies orange accents, restricts navigation per a defined policy, and displays a floating timer in the top-right that is accessible and safe-area aware.
- [ ] All interactive inputs match Figma tactile patterns and include complete UI states (default/hover/focus/selected/disabled/error) with correct semantics.
- [ ] Mobile: sidebar becomes a rounded bottom sheet with defined behavior (snap points, backdrop, scroll locking, safe areas).
- [ ] All interactive targets meet ≥48×48px hit area.
- [ ] All user-facing strings are i18n-ready; directional UI adapts to RTL locales.
- [ ] `prefers-reduced-motion` is respected: essential information is still conveyed without relying on animation.
- [ ] Keyboard-only users can operate mode toggles, sidebar navigation, exercise interactions, chat panel, and bottom sheet with visible focus and correct focus management.

## Guardrails

- Do not change backend data models, database schema, or Payload collections as part of this redesign (UI/UX only unless explicitly required).
- Preserve existing functional logic for progress tracking, exercise validation, navigation, and existing A-Guy integration points.
- Do not introduce hardcoded strings; all new UI text must go through the existing i18n system.
- Ensure RTL locales behave correctly (use logical start/end, not hardcoded left/right).
- Do not add animations that block usability; always support reduced-motion.
- Any new theming tokens must integrate with the existing design system approach (avoid scattered per-mode hardcoded class duplication).
- The animation library (recommended: framer-motion) must be added to package.json dependencies before implementing complex animations.
- Mode theming must use CSS custom properties (CSS variables) injected via context, not hardcoded class combinations.

## Out of Scope

- Creating new course/exercise content types or changing content structure.
- Changing grading/validation algorithms or progress computation rules.
- Replacing the AI provider/model stack, changing prompt pipelines, or adding new AI capabilities beyond UI/state expectations.
- Building new admin features or Payload admin customizations.
- Content migration or rewriting existing lesson copy.

## Open Questions

**These questions MUST be resolved before implementation begins (see NFR-007):**

1. Should this redesign replace the existing studying page entirely, or ship as a feature-flagged variant / new route?
2. Should the current mode be reflected in the URL (e.g., `?mode=...`) to support refresh/share, or remain in local state only?
3. In RTL locales, should the chat panel and other slide-ins originate from the logical “end” (recommended) or always from the visual right?
4. What exactly is “restricted navigation” in Test mode (disabled controls, hidden controls, confirmation dialog on leave, route guard)?
5. Does Test mode allow Hint/Ask chat at all? If allowed, what policy applies (e.g., hints only, no full solutions)?
6. Should mode changes preserve one shared scroll position, or independent scroll positions per mode/panel?
7. What are the exact glassmorphism tokens required (blur amount, opacity, border, shadow) and required contrast thresholds for math on tinted surfaces?
8. Are there existing animation/transition libraries to use (e.g., framer-motion), or should transitions be implemented with CSS only?
9. Should the Test mode timer persist across refresh and/or across tabs (and what is the source of truth for the timer state)?
10. What is the desired chat conversation scope (per lesson/exercise vs per course) and should chat history persist across refresh (server-stored) or session-only (client)?
