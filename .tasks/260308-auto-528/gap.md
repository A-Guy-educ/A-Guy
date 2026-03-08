# Gap Analysis: 260308-auto-528

## Summary

- Gaps Found: 5
- Spec Revised: Yes

## Gaps Found

### Gap 1: Missing Formula Sheet Collection

**Severity:** Critical
**Location:** `src/server/payload/collections/`
**Issue:** The spec references a formula sheet collection that does not exist in the codebase. The feature cannot be implemented without creating this collection first.
**Fix Applied:** Added FR-001: Create FormulaSheets collection with fields for name, content (richText), pdfFile (media), locale, and tenant support. Referenced similar pattern from Prompts collection.

### Gap 2: Missing Formula Sheet Fields in Lessons and Courses Collections

**Severity:** Critical
**Location:** `src/server/payload/collections/Lessons.ts`, `src/server/payload/collections/Courses.ts`
**Issue:** The spec requires lesson-level override and course-level default formula sheets, but neither Lessons nor Courses collections have a formulaSheet field.
**Fix Applied:** 
- Added FR-002: Add formulaSheet field to Lessons collection (optional relationship to FormulaSheets)
- Added FR-003: Add defaultFormulaSheet field to Courses collection (optional relationship to FormulaSheets)

### Gap 3: Missing Data Seeding/Migration Requirement

**Severity:** High
**Location:** Backend/Data
**Issue:** The spec mentions "Seeding: Course 471 equation paper content from Figma must be backfilled to course 'כיתה יא - 4 יח'ל - 471' via one-time idempotent migration script" but this is listed under Technical Constraints rather than as a formal requirement. This is a critical data migration task.
**Fix Applied:** Added FR-004: Create one-time idempotent migration script to populate formula sheet for course 471 with content from Figma.

### Gap 4: Missing Translation Keys for Formula Sheet UI

**Severity:** Medium
**Location:** `src/i18n/he.json`, `src/i18n/en.json`
**Issue:** The spec requires Hebrew (he) and English (en) support with fallback. While the i18n structure exists, specific translation keys for formula sheet button and error messages are not defined.
**Fix Applied:** Added NFR-002: Add translation keys for formula sheet UI strings (button label, loading states, error messages, empty states).

### Gap 5: PDF Viewer Mobile Responsiveness Not Specified

**Severity:** Medium
**Location:** Frontend/Viewer Component
**Issue:** The spec mentions PDF must be "responsive and allow zoom/scroll on mobile viewports" but the existing PDFMedia component uses an iframe with PDF.js viewer which may not be optimal for mobile. The spec should clarify if a custom mobile-friendly viewer is needed.
**Fix Applied:** Added to acceptance criteria: AC-06: PDF renders correctly on mobile with zoom/scroll support, or clarify fallback behavior.

## Changes Made to Spec

### Added Functional Requirements:

- **FR-001**: Create FormulaSheets collection in Payload CMS with:
  - name (text, required)
  - content (richText with LaTeX support via Lexical)
  - pdfFile (relationship to media, optional)
  - locale (content locale field)
  - tenant (tenant field)
  - admin-only CRUD access

- **FR-002**: Add formulaSheet field to Lessons collection as optional relationship to FormulaSheets

- **FR-003**: Add defaultFormulaSheet field to Courses collection as optional relationship to FormulaSheets

- **FR-004**: Create one-time idempotent migration script to populate formula sheet content for course "כיתה יא - 4 יח'ל - 471" (course code 471)

### Added Non-Functional Requirements:

- **NFR-001**: Formula sheet fetching must use efficient queries with depth=0 to avoid over-fetching
- **NFR-002**: All user-facing strings must be localized with he→en fallback pattern

### Updated Acceptance Criteria:

- **AC-06 (NEW)**: PDF rendering supports zoom/scroll on mobile viewports

### Clarified Edge Cases:

- Added: "Mobile PDF viewer behavior" to Edge Cases section
- Clarified: Loading skeleton should match both PDF and RichText content types

## Validation Notes

The spec is now aligned with existing codebase patterns:

1. **Collection patterns** - FormulaSheets follows Prompts collection structure (tenant, locale, admin-only)
2. **RichText rendering** - MathMarkdown component exists and is already used in chat
3. **PDF viewer** - Existing PDFMedia and PDFEmbed components can be reused
4. **Chat integration** - ChatInterface already accepts lessonId/courseId for context
5. **i18n** - contentLocaleField pattern already exists in Courses and Prompts

## Dependencies Confirmed

- MathMarkdown: `@/ui/web/shared/MathMarkdown` ✓
- PDFViewer: `@/ui/web/media/PDFMedia`, `@/ui/web/courses/PDFViewer/PDFEmbed.tsx` ✓
- ChatInterface: accepts lessonId, courseId props ✓
- i18n: he.json, en.json with contentLocaleField pattern ✓
