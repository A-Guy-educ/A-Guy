# Equation Paper (דף נוסחאות) - Feature Specification

## Overview

Provide students with immediate access to relevant mathematical formulas during their interaction with the AI teacher. This mimics a real exam environment and reduces cognitive load by preventing students from needing to leave the chat to look up standard equations.

## Requirements

### Visibility & Access

- Target Audience: The button and sheet are visible to all users (public or authenticated) who are viewing a published lesson
- Empty State: If neither the lesson nor the course has an attached formula sheet, the "דף נוסחאות" button must be hidden
- Localization: Formula sheets are localized per locale
- Fallback Rule: If a sheet is missing in the user's current locale (e.g., he), attempt to render the en version. If both are missing, hide the button

### Content Precedence

The system follows a strict fallback hierarchy:

- Lesson Override: If a Lesson has a specific sheet attached, display it
- Course Default: If the Lesson has no sheet, use the parent Course default
- None: Hide the UI

### Interaction Rules

- Persistence: Opening or closing the viewer must not interrupt the chat session, clear input text, or reset scroll positions
- Responsive Display: On mobile, the sheet opens as a full-screen drawer. On desktop, it renders as a side panel or modal (per Figma)

### Content Formats

- Lexical richText: Must be rendered via the existing MathMarkdown component to support LaTeX formulas
- PDF: Max file size 5MB. Must be responsive and allow zoom/scroll on mobile viewports

### Admin & Governance

- Shared Assets: Formula Sheets are shared entities. A single sheet (e.g., "Standard Trigonometry") can be linked to multiple courses or lessons
- Global Updates: Editing a shared sheet updates its content everywhere it is linked immediately
- Naming Convention: Admins must name sheets using the pattern: [Course Code] - [Topic] - [Version] (e.g., 471 - Calc - v1)

### Edge Cases

- Missing PDF File: If a sheet is type PDF but the file is missing, display: "Formula sheet could not be loaded."
- Empty Content: If a RichText sheet is linked but has no content, hide the button
- Slow Load: Provide a loading skeleton while content is fetching

## Acceptance Criteria

- [ ] Button styling matches Figma (Telescope theme) and is added to the chat
- [ ] "דף נוסחאות" button is hidden if no sheet is linked
- [ ] Lesson-level override correctly replaces Course-level default
- [ ] LaTeX equations render clearly in RichText mode using MathMarkdown
- [ ] Closing the viewer preserves the active chat input and scroll state

## Technical Constraints

- Frontend Scope: Only add the sheet toggle button within the chat interface and the presentation component for the content itself. No editing, searching, or management capabilities in the student-facing frontend
- Seeding: Course 471 equation paper content from Figma must be backfilled to course "כיתה יא - 4 יח"ל - 471" via one-time idempotent migration script
