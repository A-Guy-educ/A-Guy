# Gap Analysis: 260310-auto-171

## Summary

- Gaps Found: 12
- Spec Revised: Yes

## Gaps Found

### Gap 1: Missing Animation Library (Critical)

**Severity:** Critical
**Location:** package.json dependencies
**Issue:** The spec mentions framer-motion as an open question (#198), but the codebase currently only uses `tailwindcss-animate` for simple CSS animations. Complex animations required by the spec (3D lift effects, flip transitions, slide-ins, crossfades, confetti) need a proper animation library. The frontend-patterns skill references framer-motion but it's not installed.
**Fix Applied:** Added FR-025 (below) to spec.md requiring animation library decision and implementation.

### Gap 2: No Mode-Based Theming System (Critical)

**Severity:** Critical
**Location:** src/app/(frontend)/study/ - No existing mode context
**Issue:** The spec requires dynamic color shifts for Study/Hint/Practice/Test modes, but there's no existing theming context. The current design system only has static color tokens. Need to create a ModeContext provider that wraps the studying page and provides mode-specific colors.
**Fix Applied:** Added FR-026 to spec.md requiring a mode theming system with CSS variables for each mode palette.

### Gap 3: No Glassmorphism CSS Patterns (High)

**Severity:** High
**Location:** tailwind.tokens.mjs, tailwind.config.mjs
**Issue:** The spec requires glassmorphism (backdrop blur + semi-transparent surfaces + subtle border/shadow) for floating panels, but no glassmorphism tokens/classes exist. Need to add blur, opacity, and glass-specific tokens.
**Fix Applied:** Added FR-027 to spec.md requiring glassmorphism design tokens with fallback.

### Gap 4: No High-Radius Corner Tokens (High)

**Severity:** High
**Location:** tailwind.config.mjs
**Issue:** The spec requires ≈24px+ radii for primary containers and 12-16px for secondary controls. Current config only has up to `2xl` (~16px). Need to add 24px+ radius tokens.
**Fix Applied:** Added FR-028 to spec.md requiring new border radius tokens.

### Gap 5: No Split-Pane Workspace Layout (Critical)

**Severity:** Critical
**Location:** New component to create
**Issue:** The spec requires a master workspace with contextual navigation sidebar and content canvas. Current study page uses simple grid layout. Need to create a new split-pane component.
**Fix Applied:** Spec already has FR-003 and FR-004 covering this, but added implementation guidance.

### Gap 6: No Slide-In Chat Panel Animation (High)

**Severity:** High
**Location:** Existing ChatInterface component
**Issue:** Existing chat at `src/ui/web/chat/ChatInterface/index.tsx` is a static component. Spec requires slide-in from logical end side (RTL-aware). Need to wrap existing chat in an animated container.
**Fix Applied:** Added FR-029 to spec.md requiring slide-in animation wrapper.

### Gap 7: No Mobile Bottom Sheet (High)

**Severity:** High
**Location:** Mobile responsive behavior
**Issue:** Spec requires sidebar transforms to bottom sheet on mobile with snap points, backdrop, scroll locking, and safe areas. No existing bottom sheet component for navigation.
**Fix Applied:** Added FR-030 to spec.md requiring mobile bottom sheet with behavior specification.

### Gap 8: No Test Mode Timer (Medium)

**Severity:** Medium
**Location:** No existing timer component for test mode
**Issue:** Spec requires floating timer in top-right, safe-area aware. Search shows no existing test timer - only access gate timer exists which is different.
**Fix Applied:** Added FR-031 to spec.md requiring Test mode timer component.

### Gap 9: No Practice Mode Flip Cards (High)

**Severity:** High
**Location:** New component to create
**Issue:** Spec requires 3D lift hover effect and flip transitions for exercise cards. Existing ExerciseCard at `src/app/(frontend)/courses/_components/ExerciseCard/index.tsx` is static.
**Fix Applied:** Added FR-032 to spec.md requiring interactive flip cards with animations.

### Gap 10: Unanswered Open Questions (High)

**Severity:** High
**Location:** Implementation decisions needed
**Issue:** The spec has 10 open questions that need answers before implementation:
1. Replace existing page or new variant?
2. Mode in URL or local state only?
3. RTL slide direction?
4. Test mode navigation restriction policy?
5. Chat allowed in Test mode?
6. Scroll position policy?
7. Glassmorphism exact tokens?
8. Animation library (framer-motion)?
9. Timer persistence?
10. Chat conversation scope?

**Fix Applied:** Added NFR-007 to spec.md requiring resolution of open questions before implementation.

### Gap 11: Missing i18n Keys for New UI Elements

**Severity:** Medium
**Location:** src/i18n/en.json
**Issue:** New UI elements (mode labels, transitions, bottom sheet labels) need translation keys. Current study translations are in `study` and `coursePage` namespaces.
**Fix Applied:** Added NFR-008 to spec.md requiring i18n key planning before implementation.

### Gap 12: No Explicit Focus Management for Bottom Sheet/Dialogs

**Severity:** Medium
**Location:** Accessibility patterns
**Issue:** Spec mentions keyboard operability and focus management, but no existing pattern for trap focus in bottom sheets/dialogs in this codebase.
**Fix Applied:** Added to NFR-003 in spec.md specifying focus trap requirements.

## Changes Made to Spec

### Added Requirements

- **FR-025: Animation Library Selection**
  - Priority: MUST
  - Description: Select and install an animation library (recommended: framer-motion) to support complex interactions including 3D lift, flip transitions, slide-ins, crossfades, and confetti. CSS-only animations are insufficient for the required interactions.

- **FR-026: Mode-Based Theming System**
  - Priority: MUST
  - Description: Implement a ModeContext provider that wraps the studying page and provides CSS custom properties for each mode palette. Theme should include mode-specific colors for backgrounds, accents, borders, and shadows.

- **FR-027: Glassmorphism Design Tokens**
  - Priority: MUST
  - Description: Add glassmorphism tokens to tailwind.tokens.mjs including: backdrop blur values (8px, 12px, 16px), surface opacity levels (0.7, 0.8, 0.9), border opacity (0.1, 0.2), and shadow variants. Must include non-blur fallback classes.

- **FR-028: Extended Border Radius Tokens**
  - Priority: MUST
  - Description: Add new border radius tokens: '4xl' (24px), '5xl' (32px), 'full' for pill shapes. Primary containers should use '4xl' minimum.

- **FR-029: Slide-In Chat Animation Wrapper**
  - Priority: MUST
  - Description: Wrap existing ChatInterface component in an animated container that slides from logical end side. Must support RTL-aware direction and respect reduced-motion preferences.

- **FR-030: Mobile Bottom Sheet Navigation**
  - Priority: MUST
  - Description: Implement a mobile bottom sheet for sidebar that includes: snap points (collapsed, half, full), drag affordance (handle indicator), backdrop with tap-to-dismiss, scroll locking for underlying content, and safe-area insets handling.

- **FR-031: Test Mode Timer Component**
  - Priority: MUST
  - Description: Create a floating timer component for Test mode positioned top-right. Must include safe-area awareness for mobile, pause/resume capability, and configurable duration.

- **FR-032: Practice Mode Interactive Cards**
  - Priority: MUST
  - Description: Create new exercise card component with 3D lift hover effect (transform: translateY + shadow increase) and flip transition (rotateY 180deg). Must support keyboard activation (Enter/Space) and follow reduced-motion preferences.

### Updated Requirements

- **NFR-003: Accessibility Baseline** - Added explicit mention of focus trap for dialogs/bottom sheets and keyboard focus visible states for all interactive elements.

- **NFR-004: Reduced Motion Support** - Clarified that flip transitions, 3D lifts, and slide-ins must be disabled or significantly reduced when prefers-reduced-motion is active.

### New Non-Functional Requirements

- **NFR-007: Open Questions Resolution**
  - Priority: MUST
  - Description: Resolve the following before implementation:
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

- **NFR-008: i18n Planning**
  - Priority: MUST
  - Description: Create a translation key plan for all new UI elements including mode labels, transition labels, bottom sheet labels, timer labels, and error messages before implementation.

### Updated Acceptance Criteria

Added validation steps for:
- Animation library presence in dependencies
- Mode context wrapper implementation
- Glassmorphism fallback testing in browsers without backdrop-filter
- Bottom sheet snap points and behavior on mobile
- Timer component in Test mode
- Flip card keyboard accessibility
- Reduced-motion preference respected in all animations
