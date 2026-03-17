# Task

## Issue Title

Course Page Redesign
# UI Redesign Task

## Goal

Update the UI of the existing page to match the new design reference while **preserving all current functionality and data behavior**.

Design reference:
[https://beaver-snack-74767221.figma.site/](https://beaver-snack-74767221.figma.site/)

The task is **visual redesign only**, not a functional rewrite.

---

# Scope

## What SHOULD change

1. **Layout structure**

   * Update page layout to match the structure shown in the design reference.
   * Align spacing, sections order, and container structure.

2. **Typography**

   * Match font sizes, weights, and hierarchy from the design.

3. **Spacing**

   * Update padding, margins, and section spacing.

4. **Buttons**

   * Update button styles:

     * shape
     * color
     * hover states
     * size

5. **Cards / blocks**

   * Update visual styling of cards and content blocks:

     * borders
     * radius
     * shadows
     * background colors

6. **Icons**

   * Replace icons where the new design uses different icons.

7. **Responsive layout**

   * Ensure layout behaves correctly on:

     * desktop
     * tablet
     * mobile

---

# What MUST NOT change

These are **strict constraints**.

Do NOT change:

1. Backend logic
2. API calls
3. Data models
4. Payload collections
5. Business logic
6. Routing
7. Chat logic
8. Any server code
9. Form submission behavior

This task is **UI layer only**.

---

# Implementation rules

1. Reuse existing components whenever possible.
2. If a component needs redesign, refactor it instead of duplicating.
3. Avoid introducing new UI libraries.
4. Follow existing Tailwind + shadcn patterns.

---

# Acceptance Criteria

The task is complete when:

1. Page visually matches the reference design.
2. All existing functionality still works.
3. No console errors.
4. No TypeScript errors.
5. Existing tests pass.
6. Layout works on desktop and mobile.

---

# Deliverables

The agent must provide:

1. List of modified files
2. Confirmation that functionality was not changed

---
