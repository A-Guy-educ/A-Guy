# Spec: 260225-auto-21

## Overview

Replace the continuous scroll layout with a structured Accordion-based Account Hub under `/account`, improving clarity and scalability.

## Requirements

### FR-001: Accordion Layout (Single-Expand Mode)
**Priority**: MUST
**Description**: Vertical collapsible sections instead of tab switching. Full-width section rows, inline expansion. Only one section open at a time. Click toggles expand/collapse. **Must create or add Shadcn/Radix UI Accordion component first - it does not exist in the codebase.**

### FR-002: Details Section
**Priority**: MUST
**Description**: Default open section. Includes Name, Email. 
**NOTE**: Profile Picture is OUT OF SCOPE - the Users collection does not have a profilePicture field.

### FR-003: Courses Section
**Priority**: MUST
**Description**: Reuses the existing `SelectedCourseCard` component. Shows selected course or empty state.

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
**Description**: Support query parameter (e.g. `?section=courses`, `?section=preferences`). Valid value opens the matching section. Invalid value falls back to the Details section. Use `useSearchParams` hook in client component for shallow routing.

### NFR-001: UI Consistency
**Priority**: MUST
**Description**: Match spacing and typography of the learning interface. Use existing design system components. **Must ADD Shadcn Accordion to src/ui/web/components/ first.** Respect RTL/LTR for chevron direction by using logical properties (e.g. `ps-4`, `me-2`, `justify-between`).

### NFR-002: Performance
**Priority**: SHOULD
**Description**: If Courses > 5 items, consider lazy rendering. Avoid unnecessary heavy renders. Rely on Accordion's native unmounting of collapsed content.

### NFR-003: Internationalization (i18n)
**Priority**: MUST
**Description**: All text must be translatable. **NOTE: This project uses custom I18nProvider (src/ui/web/providers/I18n/index.tsx), NOT next-intl.** Add translation keys to src/i18n/en.json and src/i18n/he.json under `auth.account.sections`. Required keys:
- `sections.details`
- `sections.courses`  
- `sections.preferences`
- `sections.teachersProfile`
- `sections.expand`
- `sections.collapse`

### NFR-004: RTL Chevron Direction
**Priority**: MUST
**Description**: Chevron rotation must respect RTL:
- LTR: Chevron points down → rotates to right on expand
- RTL: Chevron points down → rotates to left on expand
Use `document.dir` or `useLocale()` hook for direction detection.

## Acceptance Criteria

- [ ] `/account` route is implemented with an accordion-based layout.
- [ ] Accordion component is added (Shadcn/Radix UI) - **prerequisite**
- [ ] Accordion is functional in single-expand mode (only one section open at a time).
- [ ] Details section is populated with Name, Email only (no profile picture - not available).
- [ ] Courses section reuses the `SelectedCourseCard` component and handles empty states.
- [ ] Placeholders are implemented for Preferences and Teachers Profile.
- [ ] Deep linking via `?section=...` query param works and handles invalid values properly (fallback to Details).
- [ ] URL updates shallowly when sections are clicked to keep `?section=...` in sync.
- [ ] RTL chevron direction is verified and layout uses logical CSS properties.
- [ ] All translation keys are added to src/i18n/en.json and src/i18n/he.json.

## Guardrails

- Must use Next.js App Router patterns correctly (AccountPageContent is already a client component, can use useSearchParams).
- Must add Accordion component to src/ui/web/components/ before implementing.
- Must use existing design system components (Card, Button, Badge).
- Must ensure only one section is open at a time (single-expand).
- Must add translation keys to src/i18n/ JSON files (NOT next-intl).

## Out of Scope

- Billing logic
- Advanced Preferences logic
- Teacher management system
- Cross-tenant changes
- Profile Picture (not available in Users collection)
