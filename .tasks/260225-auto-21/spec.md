# Spec: 260225-auto-21

## Overview

Replace the continuous scroll layout with a structured Accordion-based Account Hub under `/account`, improving clarity and scalability.

## Requirements

### FR-001: Accordion Layout (Single-Expand Mode)
**Priority**: MUST
**Description**: Vertical collapsible sections instead of tab switching. Full-width section rows, inline expansion. Only one section open at a time. Click toggles expand/collapse. Should use Radix/Shadcn UI Accordion with `type="single"` and `collapsible`.

### FR-002: Details Section
**Priority**: MUST
**Description**: Default open section. Includes Name, Email, and Profile Picture. 

### FR-003: Courses Section
**Priority**: MUST
**Description**: List of enrolled courses. Reuse the `SelectedCourseCard` component. Show an empty state if none exist.

### FR-004: Preferences Section
**Priority**: MUST
**Description**: User/platform settings. For Phase 1, display a structured placeholder if not implemented.

### FR-005: Teachers Profile Section
**Priority**: MUST
**Description**: Phase 1: placeholder only.

### FR-006: Interaction and UI State
**Priority**: MUST
**Description**: Section title + chevron. Chevron rotates based on state. Opening one section collapses others. Default state on `/account` load is Details open, others collapsed.

### FR-007: Deep Linking
**Priority**: MUST
**Description**: Support query parameter (e.g. `?section=courses`, `?section=preferences`). Valid value opens the matching section. Invalid value falls back to the Details section. The URL should sync shallowly when a section is expanded.

### NFR-001: UI Consistency
**Priority**: MUST
**Description**: Match spacing and typography of the learning interface. Use existing design system components (e.g., Shadcn Accordion). Respect RTL/LTR for chevron direction by using logical properties (e.g. `ps-4`, `me-2`, `justify-between`).

### NFR-002: Performance
**Priority**: SHOULD
**Description**: If Courses > 5 items, consider lazy rendering. Avoid unnecessary heavy renders. Rely on Accordion's native unmounting of collapsed content.

### NFR-003: Internationalization (i18n)
**Priority**: MUST
**Description**: All text must be translatable using `next-intl`. No hardcoded strings. Add keys to English and Hebrew message files (Hebrew is default).

## Acceptance Criteria

- [ ] `/account` route is implemented with an accordion-based layout.
- [ ] Accordion is functional in single-expand mode (only one section open at a time).
- [ ] Details section is populated with Name, Email, and Profile Picture and defaults to open.
- [ ] Courses section reuses the `SelectedCourseCard` component and handles empty states.
- [ ] Placeholders are implemented for Preferences and Teachers Profile.
- [ ] Deep linking via `?section=...` query param works and handles invalid values properly (fallback to Details).
- [ ] URL updates shallowly when sections are clicked to keep `?section=...` in sync.
- [ ] RTL chevron direction is verified and layout uses logical CSS properties.
- [ ] All text is fully translated using `next-intl`.

## Guardrails

- Must use Next.js App Router patterns correctly (read `searchParams` on the server component and pass initial state to the client component).
- Must use existing design system components (add Shadcn Accordion if missing).
- Must ensure only one section is open at a time (single-expand).
- Must respect standard i18n translation practices for all text content.

## Out of Scope

- Billing logic
- Advanced Preferences logic
- Teacher management system
- Cross-tenant changes
