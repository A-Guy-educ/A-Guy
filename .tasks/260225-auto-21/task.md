# Task

## Issue Title

Account Page – Collapsible Sections
## 1. Goal

Replace the continuous scroll layout with a structured **Accordion-based Account Hub** under `/account`, improving clarity and scalability.

---

## 2. Route

All sections live under:
`/account`

---

## 3. Layout Pattern (Phase 1)

Vertical **Collapsible Sections (Single-Expand Mode)** instead of tab switching.

* Full-width section rows
* Inline expansion
* Only one section open at a time

---

## 4. Sections

### Details (Default Open)

* Name
* Email
* Profile Picture

### Courses

* List of enrolled courses
* Reuse `SelectedCourseCard`
* Empty state if none exist

### Preferences

* User/platform settings
* Phase 1: structured placeholder if not implemented

### Teachers Profile

* Phase 1: placeholder only

---

## 5. Interaction

* Section title + chevron
* Click toggles expand/collapse
* Chevron rotates based on state
* Opening one section collapses others

---

## 6. Default State

On `/account` load:

* Details open
* Others collapsed

---

## 7. Deep Linking

Support query param:

* `/account?section=courses`
* `/account?section=preferences`

Rules:

* Valid value → open matching section
* Invalid value → fallback to Details

---

## 8. UI Consistency

* Match spacing/typography of learning interface
* Respect RTL/LTR for chevron direction
* Use existing design system components

---

## 9. Performance

* If Courses >5 items → consider lazy rendering
* Avoid unnecessary heavy renders

---

## 10. Success Metrics

* Clear content grouping
* Full UI consistency
* Extensible for Billing, Notifications, Security, Teacher controls

---

## 11. Out of Scope (Phase 1)

* Billing logic
* Advanced Preferences logic
* Teacher management system
* Cross-tenant changes

---

## 12. Definition of Done

* `/account` implemented
* Accordion functional (single-expand)
* Details populated
* Courses reuse existing component
* Placeholders implemented
* Deep link works
* RTL verified

---
