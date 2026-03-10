# Course Studying Page Redesign - Specification

## Project Overview

Transform the "Course Studying" experience into a modern, highly interactive, and intuitive educational interface with high-fidelity visual alignment to the Figma Prototype.

**Core Objective**: Implement visual patterns of soft geometry, glassmorphism, and state-based color coding from Figma while maintaining existing functional logic.

**Reference**: https://beaver-snack-74767221.figma.site

---

## Visual Design Requirements

### Soft Geometry
- Primary containers (lesson blocks, exercise cards, sidebars): high-radius corners (24px+)
- Secondary elements (buttons, input fields): 12-16px radii

### Chromatic States / Mode Colors
| Mode | Accent Palette | Background |
|------|-----------------|------------|
| Study/Default | Lavender/Soft Blue | #F5F7FF |
| Hint/Ask Mode | Purple/Indigo | (AI tutor presence) |
| Practice Mode | Emerald Green | Active "doing" state |
| Test Mode | Sunset Orange/Warm Red | Formal assessment |

### Glassmorphism & Depth
- Use `backdrop-blur` for floating panels
- Semi-transparent backgrounds: `bg-white/80` or `bg-slate-900/80`
- Layered depth for hint popovers and chat interface

---

## Functional Requirements

### 3.1 Master Workspace Layout

**Split-Pane Architecture** (Figma workspace layout):

- **Contextual Navigation Sidebar**
  - Floating pill-shaped buttons and progress indicators
  - Mode-specific accent color updates
  - Circular lesson progress indicators

- **Responsive Content Canvas**
  - Centered, maximum-width container: `max-w-4xl`
  - High-fidelity LaTeX rendering support for math

### 3.2 Dynamic Mode Interaction Logic

Toggle between visual states without full page reloads:

- **Study Mode**: Baseline clean state for text/media consumption
- **Practice Mode**: Interactive exercise cards replace static content
  - "3D lift" hover effect
  - "flip" transitions
- **Hint/Ask Mode (A-Guy Integration)**:
  - High-radius glassmorphic panel sliding from right
  - Chat bubbles with mode-specific gradients
  - Persona-specific avatars
- **Test Mode**:
  - Header and border accents shift to orange
  - Restricted navigation
  - Floating timer in top-right corner

### 3.3 Interactive Exercise Components

- **Selection Inputs**: Large circular radio buttons, pill-shaped checkboxes with smooth color-fill animations
- **Free Response**: Auto-expanding text areas with translucent backgrounds
- **Math Palette**: Floating, mode-colored contextual toolbar for math input

---

## User Interactions & Transitions

| Action | Trigger | Visual Pattern |
|--------|---------|----------------|
| Enter Practice | Click "Start Practice" | Main content slides left; Practice cards fade in with bottom-to-top motion |
| Get Hint | Click "Hint" button | Background darkens slightly; focused spotlight or mode-colored glow surrounds exercise |
| Correct Answer | Validation passes | Soft green pulse on card edges; milestone confetti |
| Switch Persona | Change AI Teacher | Chat avatar cross-fades; primary accent color updates |

---

## Mobile & Accessibility

- **Touch Fidelity**: Minimum 48x48px hit areas for buttons and tabs
- **Bottom Sheet Navigation**: Sidebar transforms to rounded bottom sheet on small screens
- **Contrast**: Mathematical formulas must remain legible against tinted mode backgrounds

---

## Acceptance Criteria

1. [ ] Split-pane layout implemented matching Figma workspace
2. [ ] Mode-based color theming working for all 4 modes
3. [ ] Soft geometry (24px+ corners on primary containers) applied
4. [ ] Glassmorphism effects on floating panels and chat interface
5. [ ] Practice Mode cards with 3D lift hover and flip transitions
6. [ ] Hint/Ask Mode chat panel slides from right with glassmorphic style
7. [ ] Test Mode shows orange accents and floating timer
8. [ ] Interactive exercise components with smooth animations
9. [ ] Mobile responsive with bottom sheet navigation
10. [ ] LaTeX rendering working in content canvas
